import { MongoAuthService, mongoAuthStore } from './mongo-auth';
import { initializeMongoSchema } from './mongo-bootstrap';
import { closeMongoClient, mongoDatabase, mongoRuntimeConfig } from './mongodb';

type BootstrapEnvironment = NodeJS.ProcessEnv &
  Readonly<{
    MONGODB_BOOTSTRAP_TOKEN?: string;
    MONGODB_INITIAL_ADMIN_EMAIL?: string;
    MONGODB_INITIAL_ADMIN_PASSWORD?: string;
    MONGODB_INITIAL_ORGANIZATION_ID?: string;
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

/**
 * Runs only from a reviewed operator command. It never accepts credentials or tenant authority
 * over HTTP, never seeds patient data, and prints no secret values.
 */
export async function runMongoBootstrap(
  argumentsList: readonly string[],
  environment: BootstrapEnvironment = process.env,
): Promise<Readonly<{ dryRun: boolean; initializedAdmin: boolean; indexes: number }>> {
  const permitted = new Set(['--dry-run', '--initialize-admin']);
  if (argumentsList.some((argument) => !permitted.has(argument))) {
    throw new Error('Uso: mongo:bootstrap [--dry-run] [--initialize-admin]');
  }
  const dryRun = argumentsList.includes('--dry-run');
  const initializeAdmin = argumentsList.includes('--initialize-admin');
  if (dryRun && initializeAdmin) {
    throw new Error('No se puede inicializar un administrador durante un dry-run.');
  }

  mongoRuntimeConfig();
  if (dryRun) {
    const report = await initializeMongoSchema(
      { collection: () => ({ createIndex: async () => 'dry-run' }) },
      { dryRun: true },
    );
    return { dryRun: true, initializedAdmin: false, indexes: report.plannedIndexes.length };
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
    return {
      dryRun: false,
      initializedAdmin: initializeAdmin,
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
        : `Mongo bootstrap completado: ${report.indexes} índices aplicados${report.initializedAdmin ? '; administrador inicial creado.' : '.'}`,
    );
  } catch {
    console.error(
      'El bootstrap Mongo no pudo completarse. Revise la configuración privada y el acceso de red.',
    );
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('mongo-bootstrap-command.ts')) void main();
