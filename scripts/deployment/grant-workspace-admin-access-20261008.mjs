import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

// Explicit, idempotent reconciliation of the four accounts named by the client.
// No passwords, patient data, or credentials are stored in this script.
const organizationId = 'analiza-main';
const targets = [
  { email: 'karla@analizaencasa.com', dashboardRestricted: true },
  { email: 'nancy.vasquez@analizaencasa.com', dashboardRestricted: true },
  { email: 'claudia.pinzon@analizaencasa.com', dashboardRestricted: false },
  { email: 'sissy.chavez@analizaencasa.com', dashboardRestricted: false },
];
const sourceReference = 'client-chat-2026-10-08-admin-except-dashboard';

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ operation: 'PLAN_ONLY', organizationId, targets }, null, 2));
  process.exit(0);
}

assert.equal(process.env.ANALIZA_ACCESS_CHANGE_APPROVED, '1', 'Explicit approval flag required');
assert.equal(process.env.ANALIZA_MANAGED_POSTGRES, 'neon');
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
assert.ok(connectionString, 'Private PostgreSQL operator connection required');

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
});
await client.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT set_config('analiza.organization_id',$1,true)", [organizationId]);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('analiza:membership-access',0))");
  const migration = await client.query(
    'SELECT 1 FROM analiza.schema_migrations WHERE version=$1',
    ['027_admin_dashboard_restriction.sql'],
  );
  assert.equal(migration.rowCount, 1, 'Apply migration 027 before changing accounts');

  const current = new Map();
  for (const target of targets) {
    const result = await client.query(
      `SELECT u.id,u.disabled_at,m.role,m.active,m.dashboard_restricted
       FROM analiza.users u JOIN analiza.memberships m ON m.user_id=u.id
       WHERE u.email_normalized=$1 AND m.organization_id=$2
       FOR UPDATE OF u,m`,
      [target.email, organizationId],
    );
    assert.equal(result.rowCount, 1, `Expected exactly one membership for ${target.email}`);
    const row = result.rows[0];
    assert.equal(row.disabled_at, null, `Disabled account: ${target.email}`);
    assert.equal(row.active, true, `Inactive membership: ${target.email}`);
    assert.ok(['NURSE', 'ADMIN'].includes(row.role), `Unexpected role: ${target.email}`);
    assert.ok(
      row.role === 'NURSE' || row.dashboard_restricted === target.dashboardRestricted,
      `Existing administrator restriction differs: ${target.email}`,
    );
    const otherActive = await client.query(
      'SELECT 1 FROM analiza.memberships WHERE user_id=$1 AND organization_id<>$2 AND active',
      [row.id, organizationId],
    );
    assert.equal(otherActive.rowCount, 0, `Another active organization: ${target.email}`);
    current.set(target.email, row);
  }

  let updated = 0;
  let revokedSessions = 0;
  for (const target of targets) {
    const row = current.get(target.email);
    if (row.role === 'ADMIN' && row.dashboard_restricted === target.dashboardRestricted) continue;
    const result = await client.query(
      `UPDATE analiza.memberships
       SET role='ADMIN',dashboard_restricted=$3
       WHERE user_id=$1 AND organization_id=$2 AND role='NURSE' AND active`,
      [row.id, organizationId, target.dashboardRestricted],
    );
    assert.equal(result.rowCount, 1, `Membership changed concurrently: ${target.email}`);
    await client.query(
      `INSERT INTO analiza.membership_access_changes
       (organization_id,id,target_user_id,previous_role,next_role,
        previous_dashboard_restricted,next_dashboard_restricted,operator_label,source_reference)
       VALUES($1,$2,$3,$4,'ADMIN',$5,$6,$7,$8)`,
      [
        organizationId,
        randomUUID(),
        row.id,
        row.role,
        row.dashboard_restricted,
        target.dashboardRestricted,
        'codex/manual-production-operator',
        sourceReference,
      ],
    );
    const revoked = await client.query(
      'UPDATE analiza.sessions SET revoked_at=now() WHERE user_id=$1 AND organization_id=$2 AND revoked_at IS NULL',
      [row.id, organizationId],
    );
    updated += 1;
    revokedSessions += revoked.rowCount;
  }
  await client.query('COMMIT');
  console.log(
    JSON.stringify({ operation: 'APPLIED', organizationId, updated, revokedSessions, targets }),
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
