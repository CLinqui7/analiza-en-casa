import { Pool, type PoolClient, type PoolConfig } from 'pg';
import type { ServerActor } from '../validation/patients';

type DatabaseTransport = 'cloudsql' | 'unix' | 'tcp';

function databaseTransport(
  env: Readonly<Record<string, string | undefined>>,
  host: string,
): DatabaseTransport {
  const transport = env.ANALIZA_DB_TRANSPORT;
  if (transport !== 'cloudsql' && transport !== 'unix' && transport !== 'tcp')
    throw new Error('ANALIZA_DB_TRANSPORT debe ser cloudsql, unix o tcp.');
  if (transport === 'cloudsql' && !/^\/cloudsql\/[^/]+$/.test(host))
    throw new Error('Cloud SQL requiere un socket /cloudsql/<connection-name>.');
  if (transport === 'unix' && host !== '/var/run/postgresql')
    throw new Error('PostgreSQL Unix requiere PGHOST=/var/run/postgresql.');
  if (transport === 'tcp') {
    const validHostname =
      host.length <= 253 &&
      !host.includes('/') &&
      !host.includes('://') &&
      !/\s/.test(host) &&
      host !== '0.0.0.0' &&
      host !== '::' &&
      /^(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/i.test(host);
    if (!validHostname) throw new Error('TCP requiere un PGHOST válido y explícito.');
  }
  return transport;
}

export function postgresConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PoolConfig {
  if (env.ANALIZA_DATA_MODE !== 'postgresql') throw new Error('PostgreSQL no está configurado.');
  const max = Number(env.PGPOOL_MAX ?? 5);
  if (!Number.isInteger(max) || max < 1 || max > 50)
    throw new Error('Pool PostgreSQL fuera de límites.');
  const connectionString = env.ANALIZA_DATABASE_URL || env.DATABASE_URL;
  if (connectionString) {
    let target: URL;
    try {
      target = new URL(connectionString);
    } catch {
      throw new Error('La conexión PostgreSQL administrada no es válida.');
    }
    if (
      env.ANALIZA_MANAGED_POSTGRES !== 'neon' ||
      env.VERCEL !== '1' ||
      target.protocol !== 'postgresql:' ||
      !target.hostname.endsWith('.neon.tech')
    ) {
      throw new Error('La conexión PostgreSQL administrada no está autorizada.');
    }
    target.searchParams.set('sslmode', 'verify-full');
    return {
      connectionString: target.toString(),
      ssl: { rejectUnauthorized: true },
      max,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 5000,
      query_timeout: 6000,
      idle_in_transaction_session_timeout: 5000,
      application_name: 'analiza-web',
    };
  }
  const { PGHOST: host, PGDATABASE: database, PGUSER: user, PGPASSWORD: password } = env;
  if (!host || !database || !user || !password)
    throw new Error('Falta configuración privada PostgreSQL.');
  databaseTransport(env, host);
  const port = Number(env.PGPORT ?? 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Puerto PostgreSQL inválido.');
  return {
    host,
    database,
    user,
    password,
    port,
    max,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30000,
    // Leave time for rollback and HTTP completion within Cloud Run's 10s SIGTERM grace.
    statement_timeout: 5000,
    query_timeout: 6000,
    idle_in_transaction_session_timeout: 5000,
    application_name: 'analiza-web',
  };
}
const globalPg = globalThis as typeof globalThis & {
  analizaPgPool?: Pool;
  analizaPgClosing?: boolean;
};
export function postgresPool(): Pool {
  if (globalPg.analizaPgClosing) throw new Error('El servicio se está apagando.');
  if (!globalPg.analizaPgPool) {
    globalPg.analizaPgPool = new Pool(postgresConfig());
    // Idle socket errors must not crash a process or print connection credentials.
    globalPg.analizaPgPool.on('error', () =>
      console.error('PostgreSQL idle connection unavailable.'),
    );
  }
  return globalPg.analizaPgPool;
}
export async function closePostgresPool() {
  globalPg.analizaPgClosing = true;
  const pool = globalPg.analizaPgPool;
  if (pool) await pool.end();
}
export async function transaction<T>(
  pool: Pool,
  actor: ServerActor | null,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (actor)
      await client.query("SELECT set_config('analiza.organization_id',$1,true)", [
        actor.organizationId,
      ]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
