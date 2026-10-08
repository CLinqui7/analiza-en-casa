import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

assert.equal(process.env.ANALIZA_PROFILE_QA_APPROVED, '1', 'Explicit synthetic rollback verification required');
assert.equal(process.env.ANALIZA_MANAGED_POSTGRES, 'neon', 'This verifier targets only managed PostgreSQL');
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
assert.ok(connectionString, 'Operator connection is required');
assert.ok(new URL(connectionString).hostname.endsWith('.neon.tech'), 'Neon target required');

const organizationId = `synthetic-profile-${randomUUID()}`;
const userId = randomUUID();
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
let transactionOpen = false;
try {
  await client.connect();
  assert.equal((await client.query("SELECT 1 FROM analiza.schema_migrations WHERE version='028_account_profiles.sql'")).rowCount, 1);
  await client.query('BEGIN');
  transactionOpen = true;
  await client.query("SELECT set_config('analiza.organization_id',$1,true)", [organizationId]);
  await client.query('INSERT INTO analiza.organizations(id,name) VALUES($1,$2)', [organizationId, 'Synthetic profile verification']);
  await client.query('INSERT INTO analiza.users(id,email_normalized,password_hash,display_name) VALUES($1,$2,$3,$4)', [userId, `profile-${userId}@example.test`, 'synthetic-hash-not-for-login', 'Synthetic User']);
  await client.query('INSERT INTO analiza.memberships(user_id,organization_id,role,active) VALUES($1,$2,$3,true)', [userId, organizationId, 'NURSE']);

  const rename = `UPDATE analiza.users u SET display_name=$3 FROM analiza.memberships m
    WHERE u.id=$1 AND m.organization_id=$2 AND m.active AND u.disabled_at IS NULL AND m.user_id=u.id
    RETURNING u.email_normalized AS email,u.display_name,u.avatar_version`;
  assert.equal((await client.query(rename, [userId, 'synthetic-foreign-org', 'Wrong Name'])).rowCount, 0);
  assert.equal((await client.query(rename, [userId, organizationId, 'Verified Name'])).rows[0].display_name, 'Verified Name');

  const avatar = `UPDATE analiza.users u SET avatar_bytes=$3,avatar_mime=$4,avatar_version=avatar_version+1
    FROM analiza.memberships m WHERE u.id=$1 AND m.organization_id=$2 AND m.active AND u.disabled_at IS NULL AND m.user_id=u.id
    RETURNING u.avatar_version`;
  assert.equal((await client.query(avatar, [userId, organizationId, Buffer.alloc(16), 'image/webp'])).rows[0].avatar_version, '1');
  assert.equal((await client.query(
    `SELECT u.avatar_mime FROM analiza.users u JOIN analiza.memberships m ON m.user_id=u.id
     WHERE u.id=$1 AND m.organization_id=$2 AND m.active AND u.disabled_at IS NULL`,
    [userId, organizationId],
  )).rows[0].avatar_mime, 'image/webp');
  await client.query('ROLLBACK');
  transactionOpen = false;
  console.log(JSON.stringify({ status: 'PASS', migration: '028_account_profiles.sql', tenantBoundary: true, rollback: true }));
} finally {
  if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  await client.end().catch(() => undefined);
}
