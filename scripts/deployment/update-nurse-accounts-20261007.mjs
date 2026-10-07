import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { Client } from 'pg';

// One-time, reviewed identity reconciliation. Keep passwords out of the repository.
const accounts = [
  [
    '2f14ccd1-59f2-498d-8e9d-bd73f08934ed',
    'abigailsv92@gmail.com',
    'abigailsv92@analizaencasa.com',
    false,
  ],
  [
    '4ef40cd7-d962-4e4b-96d5-d0fc28314645',
    'analiza@intereactivecore.app',
    'analiza@analizaencasa.com',
    false,
  ],
  [
    '6008668a-8df6-4c82-bfd7-532f39a7ee7d',
    'carlos@shiftandcontrol.com',
    'carlos@analizaencasa.com',
    false,
  ],
  [
    'eccdf689-bd9c-4193-9e03-8806ca0b1794',
    'claudia.pinzon@labanaliza.com',
    'claudia.pinzon@analizaencasa.com',
    true,
  ],
  [
    'a1961612-7273-47dd-bb74-c65652141d03',
    'nelly.jva.17@gmail.com',
    'nelly.jva.17@analizaencasa.com',
    false,
  ],
  [
    '6179f0e6-74c3-418c-80f6-d7c369e8c4d4',
    'nelly.viscarra@labanaliza.com',
    'nelly.viscarra@analizaencasa.com',
    false,
  ],
  [
    '68838903-8299-4b81-a5c9-b4c403aa8863',
    'olaya.deras@labanaliza.com',
    'olaya.deras@analizaencasa.com',
    false,
  ],
  [
    '3dfb00b1-3702-4cd8-815d-fd351868e4df',
    'sissy.chavez@labanaliza.com',
    'sissy.chavez@analizaencasa.com',
    true,
  ],
];

if (!process.argv.includes('--apply')) {
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        accounts: accounts.map(([, from, to, dashboardAccess]) => ({ from, to, dashboardAccess })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

assert.equal(
  process.env.ANALIZA_MIGRATION_APPROVED,
  '1',
  'Explicit operator approval flag required',
);
const password = process.env.ANALIZA_NURSE_PASSWORD;
assert.ok(
  password && password.length >= 12,
  'A nurse password of at least 12 characters is required',
);
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
assert.ok(connectionString, 'PostgreSQL operator connection required');

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 5000,
});
await client.connect();
try {
  await client.query('BEGIN');
  const migration = await client.query('SELECT 1 FROM analiza.schema_migrations WHERE version=$1', [
    '024_nurse_dashboard_access.sql',
  ]);
  assert.equal(migration.rowCount, 1, 'Apply migration 024 first');
  for (const [id, previousEmail, nextEmail] of accounts) {
    const result = await client.query(
      `SELECT u.email_normalized, m.role, m.active, u.disabled_at
       FROM analiza.users u JOIN analiza.memberships m ON m.user_id=u.id
       WHERE u.id=$1 AND m.organization_id=$2 FOR UPDATE OF u,m`,
      [id, 'analiza-main'],
    );
    assert.equal(result.rowCount, 1, `Account not found: ${previousEmail}`);
    const row = result.rows[0];
    assert.equal(row.role, 'NURSE', `Refusing to change a non-nurse: ${previousEmail}`);
    assert.equal(row.active, true, `Inactive account: ${previousEmail}`);
    assert.equal(row.disabled_at, null, `Disabled account: ${previousEmail}`);
    assert.ok(
      [previousEmail, nextEmail].includes(row.email_normalized),
      `Unexpected current email: ${previousEmail}`,
    );
    const collision = await client.query(
      'SELECT 1 FROM analiza.users WHERE email_normalized=$1 AND id<>$2',
      [nextEmail, id],
    );
    assert.equal(collision.rowCount, 0, `Email already belongs to another account: ${nextEmail}`);
  }

  let revokedSessions = 0;
  for (const [id, , nextEmail, dashboardAccess] of accounts) {
    const salt = randomBytes(16).toString('base64url');
    const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('base64url')}`;
    await client.query(
      'UPDATE analiza.users SET email_normalized=$2,password_hash=$3 WHERE id=$1',
      [id, nextEmail, hash],
    );
    await client.query(
      'UPDATE analiza.memberships SET dashboard_access=$2 WHERE user_id=$1 AND organization_id=$3 AND role=$4',
      [id, dashboardAccess, 'analiza-main', 'NURSE'],
    );
    const revoked = await client.query(
      'UPDATE analiza.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',
      [id],
    );
    revokedSessions += revoked.rowCount;
  }
  await client.query('COMMIT');
  console.log(
    JSON.stringify({
      updatedNurses: accounts.length,
      dashboardGrants: accounts.filter((account) => account[3]).length,
      revokedSessions,
      emails: accounts.map((account) => account[2]),
    }),
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
