import assert from 'node:assert/strict';
import { Client } from 'pg';

assert.equal(process.env.ANALIZA_MANAGED_POSTGRES, 'neon');
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
assert.ok(connectionString, 'Managed database URL is required');
const target = new URL(connectionString);
assert.equal(target.protocol, 'postgresql:');
assert.ok(target.hostname.endsWith('.neon.tech'));
target.searchParams.set('sslmode', 'verify-full');
const client = new Client({
  connectionString: target.toString(),
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
});
try {
  await client.connect();
  const result = await client.query(`
    SELECT current_setting('server_version_num')::int AS version,
           to_regclass('analiza.clinical_scale_captures') IS NOT NULL AS capture_table,
           EXISTS (SELECT 1 FROM analiza.schema_migrations
                   WHERE version='019_clinical_scale_captures.sql') AS migration_applied
  `);
  const row = result.rows[0];
  console.log(JSON.stringify({
    supportedVersion: row.version >= 160000 && row.version < 200000,
    captureTable: row.capture_table,
    migrationApplied: row.migration_applied,
  }));
} finally {
  await client.end();
}
