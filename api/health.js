import pg from 'pg';

export default async function handler(request, response) {
  const started = Date.now();
  const checks = {
    runtime: 'ok',
    dataMode: process.env.ANALIZA_DATA_MODE || 'not-configured',
    notificationsMode: process.env.NOTIFICATIONS_MODE || 'mock',
  };

  let database = 'not-configured';
  const connectionString = process.env.ANALIZA_DATABASE_URL || process.env.DATABASE_URL;
  if (checks.dataMode === 'postgresql' && connectionString) {
    let client;
    try {
      const target = new URL(connectionString);
      if (target.protocol !== 'postgresql:' || !target.hostname.endsWith('.neon.tech')) {
        throw new Error('Unsupported database target');
      }
      target.searchParams.set('sslmode', 'verify-full');
      client = new pg.Client({
        connectionString: target.toString(),
        ssl: { rejectUnauthorized: true },
        connectionTimeoutMillis: 3000,
        statement_timeout: 3000,
      });
      await client.connect();
      const result = await client.query(
        "SELECT 1 FROM analiza.schema_migrations WHERE version='008_quotes.sql' LIMIT 1",
      );
      database = result.rowCount === 1 ? 'ready' : 'schema-outdated';
    } catch {
      database = 'unreachable';
    } finally {
      await client?.end().catch(() => undefined);
    }
  }

  response.setHeader('Cache-Control', 'no-store');
  const ready = database === 'ready';
  response.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'unavailable',
    version: '2026.09.16',
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    checks: { ...checks, database },
  });
}
