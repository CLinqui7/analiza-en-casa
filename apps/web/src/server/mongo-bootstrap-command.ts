import { MongoAuthService, mongoAuthStore } from './mongo-auth';
import { initializeMongoSchema } from './mongo-bootstrap';
import { closeMongoClient, mongoDatabase, mongoRuntimeConfig } from './mongodb';
import {
  demoHospitalizations,
  demoNursingResources,
  demoPatients,
  demoQuotes,
  demoShifts,
} from '@/lib/demo-data';

type BootstrapEnvironment = NodeJS.ProcessEnv &
  Readonly<{
    MONGODB_BOOTSTRAP_TOKEN?: string;
    MONGODB_INITIAL_ADMIN_EMAIL?: string;
    MONGODB_INITIAL_ADMIN_PASSWORD?: string;
    MONGODB_INITIAL_ORGANIZATION_ID?: string;
    MONGODB_SEED_ORGANIZATION_ID?: string;
  }>;

function initialAdminInput(environment: BootstrapEnvironment) {
  const bootstrapToken = environment.MONGODB_BOOTSTRAP_TOKEN;
  const email = environment.MONGODB_INITIAL_ADMIN_EMAIL;
  const password = environment.MONGODB_INITIAL_ADMIN_PASSWORD;
  const organizationId = environment.MONGODB_INITIAL_ORGANIZATION_ID;
  if (!bootstrapToken || !email || !password || !organizationId) {
    throw new Error('Faltan las variables privadas requeridas para el administrador inicial.');
  }
  return { bootstrapToken, email, password, organizationId };
}

async function seedSyntheticWorkspace(database: Awaited<ReturnType<typeof mongoDatabase>>, organizationId: string) {
  if (!organizationId.trim()) throw new Error('Falta MONGODB_SEED_ORGANIZATION_ID.');
  const createdAt = new Date('2026-08-28T08:00:00.000Z');
  let inserted = 0;
  const upsert = async (collection: string, id: string, document: Record<string, unknown>) => {
    const result = await database.collection(collection).updateOne(
      { organizationId, id },
      { $setOnInsert: { ...document, organizationId } },
      { upsert: true },
    );
    inserted += result.upsertedCount;
  };
  for (const patient of demoPatients.slice(0, 3)) {
    const seededPatient = patient.id === 'patient-demo-001'
      ? { ...patient, notifications: { botmakerConsent: true } }
      : patient;
    await upsert('patients', patient.id, {
      ...seededPatient,
      documentIdNormalized: patient.documentId.replace(/\s/g, '').toUpperCase(),
      version: 1,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    });
  }
  for (const resource of demoNursingResources) await upsert('nursingResources', resource.id, resource);
  for (const hospitalization of demoHospitalizations) await upsert('hospitalizations', hospitalization.id, { ...hospitalization, version: 1, createdAt: createdAt.toISOString(), updatedAt: createdAt.toISOString() });
  for (const shift of demoShifts) await upsert('shifts', shift.id, { ...shift, createdAt: createdAt.toISOString() });
  const sourceQuote = demoQuotes[0];
  const seededQuote = { ...sourceQuote, status: 'SENT' as const, immutable: true, sentAt: createdAt.toISOString(), rootQuoteId: sourceQuote.id, originalQuoteId: sourceQuote.id };
  await upsert('quotes', seededQuote.id, { ...seededQuote, recordVersion: 1, updatedAt: createdAt.toISOString() });
  const request = { id: 'insurance-demo-001', quoteId: seededQuote.id, patientId: seededQuote.patientId, insurer: 'Aseguradora de demostración', status: 'INSURER_REVIEW', createdAt: createdAt.toISOString(), updatedAt: createdAt.toISOString(), lastNote: 'Solicitud sintética en revisión para validar el tablero.' };
  await upsert('insuranceRequests', request.id, request);
  await upsert('insuranceEvents', 'insurance-event-demo-001', { id: 'insurance-event-demo-001', requestId: request.id, status: request.status, date: createdAt.toISOString(), note: request.lastNote, idempotencyKey: 'seed-insurance-event-demo-001', actorUserId: 'bootstrap' });
  await upsert('auditEvents', 'audit-seed-demo-001', { id: 'audit-seed-demo-001', actorUserId: 'bootstrap', action: 'SYNTHETIC_SEED_APPLIED', resourceType: 'workspace', resourceId: organizationId, occurredAt: createdAt });
  return inserted;
}

/**
 * Runs only from a reviewed operator command. It never accepts credentials or tenant authority
 * over HTTP, seeds only when the operator explicitly requests synthetic QA records, and prints no
 * secret values.
 */
export async function runMongoBootstrap(
  argumentsList: readonly string[],
  environment: BootstrapEnvironment = process.env,
): Promise<Readonly<{ dryRun: boolean; initializedAdmin: boolean; seededRecords: number; indexes: number }>> {
  const permitted = new Set(['--dry-run', '--initialize-admin', '--seed-synthetic']);
  if (argumentsList.some((argument) => !permitted.has(argument))) {
    throw new Error('Uso: mongo:bootstrap [--dry-run] [--initialize-admin] [--seed-synthetic]');
  }
  const dryRun = argumentsList.includes('--dry-run');
  const initializeAdmin = argumentsList.includes('--initialize-admin');
  const seedSynthetic = argumentsList.includes('--seed-synthetic');
  if (dryRun && (initializeAdmin || seedSynthetic)) {
    throw new Error('No se puede crear un administrador ni semilla durante un dry-run.');
  }

  mongoRuntimeConfig();
  if (dryRun) {
    const report = await initializeMongoSchema(
      { collection: () => ({ createIndex: async () => 'dry-run' }) },
      { dryRun: true },
    );
    return { dryRun: true, initializedAdmin: false, seededRecords: 0, indexes: report.plannedIndexes.length };
  }
  const database = await mongoDatabase();
  try {
    const report = await initializeMongoSchema(database, { dryRun });
    if (initializeAdmin) {
      const input = initialAdminInput(environment);
      await new MongoAuthService(mongoAuthStore(database)).bootstrapInitialAdmin(
        input,
        input.bootstrapToken,
      );
    }
    const seededRecords = seedSynthetic
      ? await seedSyntheticWorkspace(database, environment.MONGODB_SEED_ORGANIZATION_ID ?? '')
      : 0;
    return {
      dryRun: false,
      initializedAdmin: initializeAdmin,
      seededRecords,
      indexes: report.appliedIndexes.length,
    };
  } finally {
    await closeMongoClient();
  }
}

async function main() {
  try {
    const report = await runMongoBootstrap(process.argv.slice(2));
    console.info(
      report.dryRun
        ? `Mongo bootstrap verificado: ${report.indexes} índices se aplicarían.`
        : `Mongo bootstrap completado: ${report.indexes} índices aplicados${report.initializedAdmin ? '; administrador inicial creado' : ''}${report.seededRecords ? `; ${report.seededRecords} registros sintéticos insertados` : ''}.`,
    );
  } catch {
    console.error(
      'El bootstrap Mongo no pudo completarse. Revise la configuración privada y el acceso de red.',
    );
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('mongo-bootstrap-command.ts')) void main();
