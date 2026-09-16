import { Client } from 'pg';

function restrictedNeonConnection() {
  if (
    process.env.VERCEL !== '1' ||
    process.env.ANALIZA_DATA_MODE !== 'postgresql' ||
    process.env.ANALIZA_MANAGED_POSTGRES !== 'neon' ||
    !process.env.ANALIZA_DATABASE_URL
  )
    throw new Error('PostgreSQL is not configured.');

  const target = new URL(process.env.ANALIZA_DATABASE_URL);
  if (target.protocol !== 'postgresql:' || !target.hostname.endsWith('.neon.tech'))
    throw new Error('PostgreSQL target is not authorized.');
  return process.env.ANALIZA_DATABASE_URL;
}

/** Public readiness probe. It never returns credentials, topology, or database errors. */
export default async function handler(_request, response) {
  let client;

  try {
    client = new Client({
      connectionString: restrictedNeonConnection(),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
      query_timeout: 6000,
      application_name: 'analiza-health',
    });
    await client.connect();
    const result = await client.query(
      "SELECT (SELECT count(*) FROM analiza.schema_migrations WHERE version IN ('001_core.sql','002_workspace_registration.sql','003_nurse_profiles.sql','004_feedback_reports.sql'))::int AS migrations, r.rolsuper OR r.rolbypassrls AS privileged FROM pg_roles r WHERE r.rolname=current_user",
    );
    const row = result.rows[0];
    if (!row || row.migrations !== 4 || row.privileged)
      throw new Error('Database readiness validation failed.');
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json({ status: 'ready' });
  } catch {
    response.setHeader('Cache-Control', 'no-store');
    response.status(503).json({ status: 'unavailable' });
  } finally {
    await client?.end().catch(() => undefined);
  }
}
