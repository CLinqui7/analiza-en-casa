import assert from 'node:assert/strict';
import { Client, Pool } from 'pg';
import { PostgresClinicalScaleRepository } from '../apps/web/src/server/persistence/postgres-clinical-scales';

assert.equal(process.env.ANALIZA_QA_MODE, '1');
assert.ok(['127.0.0.1', 'localhost'].includes(process.env.PGHOST ?? ''));
assert.equal(process.env.PGDATABASE, 'analiza_qa');
assert.notEqual(process.env.VERCEL, '1');

const operator = new Client();
const runtime = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: 'analiza_runtime',
  password: process.env.ANALIZA_PG_RUNTIME_PASSWORD,
});
try {
  await operator.connect();
  await operator.query(`
    INSERT INTO analiza.organizations(id,name) VALUES
      ('clinical-qa-a','Clinical QA A'),('clinical-qa-b','Clinical QA B');
    INSERT INTO analiza.users(id,email_normalized,password_hash,display_name)
      VALUES('clinical-qa-user','clinical-qa@example.invalid','test-only','Enfermera QA');
    INSERT INTO analiza.memberships(user_id,organization_id,role)
      VALUES('clinical-qa-user','clinical-qa-a','NURSE'),('clinical-qa-user','clinical-qa-b','NURSE');
    INSERT INTO analiza.patients(organization_id,id,document_key,body) VALUES
      ('clinical-qa-a','patient-1','DOC-A1','{"id":"patient-1"}'::jsonb),
      ('clinical-qa-a','patient-2','DOC-A2','{"id":"patient-2"}'::jsonb),
      ('clinical-qa-b','patient-1','DOC-B1','{"id":"patient-1"}'::jsonb);
    INSERT INTO analiza.hospitalizations(organization_id,id,patient_id,body) VALUES
      ('clinical-qa-a','case-other','patient-2','{"id":"case-other","patientId":"patient-2"}'::jsonb);
  `);

  const repository = new PostgresClinicalScaleRepository(runtime);
  const nurseA = { userId: 'clinical-qa-user', organizationId: 'clinical-qa-a', role: 'NURSE' } as const;
  const nurseB = { ...nurseA, organizationId: 'clinical-qa-b' } as const;
  const base = { scaleId: 'eva', observedAt: new Date().toISOString(), values: { score: 5 }, notes: 'Prueba sintética' };
  await assert.rejects(repository.create(nurseA, 'patient-1', { ...base, caseId: 'case-other' }), /no pertenece/);
  await assert.rejects(repository.create(nurseA, 'patient-1', { ...base, values: { score: 12 } }), /Revisa/);
  const created = await repository.create(nurseA, 'patient-1', base);
  assert.ok(created);
  assert.equal(created.patientId, 'patient-1');
  assert.equal(created.authorName, 'Enfermera QA');
  assert.equal(created.clinicalValidated, false);
  assert.equal((await repository.listForPatient(nurseA, 'patient-1'))?.[0].id, created.id);
  assert.deepEqual(await repository.listForPatient(nurseB, 'patient-1'), []);
  assert.equal(await repository.listForPatient(nurseA, 'not-found'), null);
  const privileges = await operator.query<{ update_allowed: boolean; delete_allowed: boolean }>(
    `SELECT has_table_privilege('analiza_runtime','analiza.clinical_scale_captures','UPDATE') AS update_allowed,
            has_table_privilege('analiza_runtime','analiza.clinical_scale_captures','DELETE') AS delete_allowed`,
  );
  assert.equal(privileges.rows[0].update_allowed, false);
  assert.equal(privileges.rows[0].delete_allowed, false);
  console.log('clinical scale PostgreSQL integration passed: patient scope, writes, audit, immutable grants');
} finally {
  await runtime.end();
  await operator.end();
}
