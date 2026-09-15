import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { AuthService, RegistrationError, SessionError, CsrfError } from '../apps/web/src/server/auth-service';
import { mongoAuthStore } from '../apps/web/src/server/mongo-auth';
import { MongoWorkspaceSetupRepository } from '../apps/web/src/server/mongo-workspace-setup';
import { mongoDatabase, closeMongoClient } from '../apps/web/src/server/mongodb';
import { MongoAccessError, MongoConflictError } from '../apps/web/src/server/validation/patients';
import { emptyWorkspaceSetup } from '../apps/web/src/lib/workspace-setup';

async function main() {
  if (!process.env.MONGODB_COLLECTION_PREFIX?.startsWith('registration_qa_'))
    throw new Error('This test requires dedicated registration_qa_ collections.');
  let database = await mongoDatabase();
  let auth = new AuthService(mongoAuthStore(database));
  const input = (tag: string) => ({ displayName: `Persona QA ${tag}`, email: `qa-${tag}-${randomUUID()}@example.test`, password: randomUUID() });
  const firstInput = input('a');
  const first = await auth.register(firstInput);
  const second = await auth.register(input('b'));
  assert.notEqual(first.session.organizationId, second.session.organizationId);
  const user = await database.collection('users').findOne({ id: first.session.userId });
  assert.ok(user?.passwordHash.startsWith('scrypt$'));
  assert.notEqual(user?.passwordHash, firstInput.password);
  await assert.rejects(auth.register({ ...input('forged'), organizationId: first.session.organizationId }), RegistrationError);
  const organizationCount = await database.collection('organizations').countDocuments();
  await assert.rejects(auth.register(firstInput), RegistrationError);
  assert.equal(await database.collection('organizations').countDocuments(), organizationCount);

  // Inject a mid-transaction storage failure. The real Mongo transaction must roll back the user.
  const failedInput = input('rollback');
  const faultyDatabase = new Proxy(database, {
    get(target, property) {
      if (property === 'collection') return (name: string) => name === 'memberships'
        ? { insertOne: async () => { throw new Error('injected transaction failure'); } }
        : target.collection(name);
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Db;
  await assert.rejects(new AuthService(mongoAuthStore(faultyDatabase)).register(failedInput));
  assert.equal(await database.collection('users').countDocuments({ emailNormalized: failedInput.email }), 0);
  assert.equal(await database.collection('organizations').countDocuments(), organizationCount);

  const repository = new MongoWorkspaceSetupRepository(database);
  const data = emptyWorkspaceSetup();
  data.organization = { name: 'Organización QA sintética', contactName: 'Contacto QA', email: 'contacto@example.test', phone: '', address: 'Dirección de prueba', city: 'Ciudad de prueba', country: '', coverage: 'Zona sintética' };
  data.staff = [{ id: randomUUID(), name: 'Personal QA', position: 'Administración', specialty: '', registrationNumber: '', email: 'personal@example.test', phone: '', active: true }];
  data.services = [{ id: randomUUID(), name: 'Servicio sintético', description: 'Descripción para QA', modality: 'OTHER', currency: '', active: true }];
  const saved = await repository.save(first.session, data);
  assert.equal(saved.expectedVersion, 1);
  assert.deepEqual(await repository.get(first.session), saved);
  assert.deepEqual((await repository.get(second.session)).staff, []);
  assert.deepEqual((await repository.get(second.session)).services, []);
  await assert.rejects(repository.save(first.session, data), MongoConflictError);
  await assert.rejects(repository.get({ ...first.session, role: 'AUDITOR' }), MongoAccessError);
  await assert.rejects(repository.save({ ...first.session, role: 'AUDITOR' }, saved), MongoAccessError);
  await assert.rejects(auth.requireCsrf(first.sessionToken, 'not-a-token'), CsrfError);
  await auth.requireCsrf(first.sessionToken, first.csrfToken);
  const edited = await repository.save(first.session, { ...saved, organization: { ...saved.organization, name: 'Organización QA editada' } });
  assert.equal(edited.expectedVersion, 2);

  // Closing every application connection must preserve session and questionnaire data in Atlas.
  await closeMongoClient();
  database = await mongoDatabase();
  auth = new AuthService(mongoAuthStore(database));
  await auth.requireSession(first.sessionToken);
  assert.equal((await new MongoWorkspaceSetupRepository(database).get(first.session)).organization.name, 'Organización QA editada');
  const login = await auth.login({ email: firstInput.email.toUpperCase(), password: firstInput.password });
  await auth.logout(login.sessionToken);
  await assert.rejects(auth.requireSession(login.sessionToken), SessionError);
  await database.collection('users').updateOne({ id: first.session.userId }, { $set: { disabledAt: new Date() } });
  await assert.rejects(auth.requireSession(first.sessionToken), SessionError);
  console.log(JSON.stringify({ status: 'PASS', backend: 'MongoDB Atlas', checks: [
    'registration', 'password/token hashing', 'isolated organizations', 'browser authority rejected',
    'duplicate account atomicity', 'mid-transaction rollback', 'questionnaire read/write/update',
    'cross-organization isolation', 'role rejection', 'optimistic concurrency', 'CSRF',
    'connection restart persistence', 'login', 'logout revocation', 'disabled user rejected',
  ] }));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ status: 'FAIL', errorType: error instanceof Error ? error.name : 'Unknown',
    code: error && typeof error === 'object' && 'code' in error ? error.code : undefined }));
  process.exitCode = 1;
}).finally(closeMongoClient);
