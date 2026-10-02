import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const organizationId = 'analiza-main';
const oldEmail = 'webmaste@analizaencasa.com';
const requestedEmail = 'webmaster@analizaencasa.com';
const apply = process.argv.includes('--apply');
if (apply) {
  assert.equal(process.env.ANALIZA_WEBMASTER_EMAIL_CORRECTION_APPROVED, '1');
  assert.equal(process.env.ANALIZA_MANAGED_POSTGRES, 'neon');
}
const connectionString = process.env.DATABASE_URL_UNPOOLED;
assert.ok(connectionString && new URL(connectionString).hostname.endsWith('.neon.tech'));

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
});

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SELECT set_config('analiza.organization_id',$1,true)", [organizationId]);
  const webmaster = await client.query(
    `SELECT u.id,u.email_normalized AS email,u.disabled_at IS NULL AS enabled,m.active
       FROM analiza.users u JOIN analiza.memberships m ON m.user_id=u.id
      WHERE m.organization_id=$1 AND m.role='WEBMASTER'
      FOR UPDATE OF u,m`,
    [organizationId],
  );
  assert.equal(webmaster.rowCount, 1, 'Expected exactly one webmaster account.');
  const account = webmaster.rows[0];
  assert.ok(account.enabled && account.active, 'Webmaster account must remain active.');
  assert.ok(
    [oldEmail, requestedEmail].includes(account.email),
    `Unexpected webmaster email: ${account.email}`,
  );
  const conflict = await client.query('SELECT id FROM analiza.users WHERE email_normalized=$1', [
    requestedEmail,
  ]);
  assert.ok(
    conflict.rowCount === 0 || conflict.rows[0].id === account.id,
    'Requested email belongs to another account.',
  );
  const needsCorrection = account.email === oldEmail;
  if (apply && needsCorrection) {
    const owner = await client.query(
      `SELECT u.id FROM analiza.users u JOIN analiza.memberships m ON m.user_id=u.id
        WHERE u.email_normalized=$1 AND m.organization_id=$2 AND m.role='ADMIN' AND m.active`,
      ['linquicarloss@gmail.com', organizationId],
    );
    assert.equal(owner.rowCount, 1, 'Owner ADMIN is required for the audit record.');
    await client.query('UPDATE analiza.users SET email_normalized=$1 WHERE id=$2', [
      requestedEmail,
      account.id,
    ]);
    await client.query(
      `INSERT INTO analiza.audit_events
         (organization_id,id,actor_user_id,action,resource_type,resource_id)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [
        organizationId,
        randomUUID(),
        owner.rows[0].id,
        'WEBMASTER_EMAIL_CORRECTED',
        'user',
        account.id,
      ],
    );
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  console.log(
    JSON.stringify({
      operation: apply ? 'APPLIED' : 'PLAN_ONLY',
      previousEmail: account.email,
      requestedEmail,
      corrected: apply && needsCorrection,
      passwordPreserved: true,
      rolePreserved: true,
    }),
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
