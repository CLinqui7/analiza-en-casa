import assert from 'node:assert/strict';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { Client } from 'pg';

const accounts = [
  ['sophia.gonzalez@analizaencasa.com', 'Sophia Gonzalez'],
  ['wendy.estrada@analizaencasa.com', 'Wendy Estrada'],
  ['luis.aguilar@analizaencasa.com', 'Luis Aguilar'],
  ['gabriela.cabrera@analizaencasa.com', 'Gabriela Cabrera'],
];

if (!process.argv.includes('--apply')) {
  console.log(
    JSON.stringify({
      operation: 'PLAN_ONLY',
      accounts: accounts.map(([login, name]) => ({ login, name, role: 'ADMIN' })),
      existingUsers: 'preserved',
      temporaryPassword: 'read from ANALIZA_TEMP_ADMIN_PASSWORD at apply time',
    }),
  );
  process.exit(0);
}

const password = process.env.ANALIZA_TEMP_ADMIN_PASSWORD;
assert.ok(
  password && password.length >= 10 && password.length <= 1024,
  'Provide the requested temporary password through ANALIZA_TEMP_ADMIN_PASSWORD.',
);
assert.ok(
  process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL ||
    (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD),
  'Private operator PostgreSQL connection required.',
);
const managed = process.env.ANALIZA_MANAGED_POSTGRES === 'neon';
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
assert.ok(!connectionString || managed, 'A DATABASE_URL requires ANALIZA_MANAGED_POSTGRES=neon; refusing an ambiguous target.');
if (managed)
  assert.ok(
    connectionString && new URL(connectionString).hostname.endsWith('.neon.tech'),
    'Expected an explicit Neon target.',
  );
const client = new Client(
  managed
    ? { connectionString, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 5000 }
    : { connectionTimeoutMillis: 5000 },
);
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('analiza:admin-provision',0))");
  const schema = await client.query("SELECT 1 FROM analiza.schema_migrations WHERE version='020_account_profile.sql'");
  assert.equal(schema.rowCount, 1, 'Apply migration 020_account_profile.sql before provisioning.');
  const owner = await client.query(
    "SELECT m.organization_id FROM analiza.users u JOIN analiza.memberships m ON m.user_id=u.id WHERE u.email_normalized='linquicarloss@gmail.com' AND m.role='ADMIN' AND m.active AND u.disabled_at IS NULL",
  );
  assert.equal(
    owner.rowCount,
    1,
    'Expected exactly one active ADMIN organization for linquicarloss@gmail.com.',
  );
  const organizationId = owner.rows[0].organization_id;
  await client.query("SELECT set_config('analiza.organization_id',$1,true)", [organizationId]);
  const created = [];
  const retained = [];
  for (const [login, name] of accounts) {
    const existing = await client.query(
      'SELECT u.id,m.organization_id,m.role,m.active FROM analiza.users u LEFT JOIN analiza.memberships m ON m.user_id=u.id WHERE u.email_normalized=$1',
      [login],
    );
    if (existing.rowCount) {
      assert.equal(existing.rowCount, 1);
      assert.equal(
        existing.rows[0].organization_id,
        organizationId,
        `Existing login ${login} belongs to another organization.`,
      );
      assert.equal(existing.rows[0].role, 'ADMIN', `Existing login ${login} is not ADMIN.`);
      assert.equal(existing.rows[0].active, true, `Existing login ${login} is inactive.`);
      retained.push(login);
      continue;
    }
    const id = randomUUID();
    const salt = randomBytes(16).toString('base64url');
    const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('base64url')}`;
    await client.query(
      'INSERT INTO analiza.users(id,email_normalized,password_hash,display_name,must_change_password) VALUES($1,$2,$3,$4,true)',
      [id, login, hash, name],
    );
    await client.query(
      "INSERT INTO analiza.memberships(user_id,organization_id,role,active) VALUES($1,$2,'ADMIN',true)",
      [id, organizationId],
    );
    await client.query(
      "INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,(SELECT id FROM analiza.users WHERE email_normalized='linquicarloss@gmail.com'),'account.admin_provisioned','users',$3)",
      [organizationId, randomUUID(), id],
    );
    created.push(login);
  }
  await client.query('COMMIT');
  console.log(
    JSON.stringify({
      created,
      retained,
      organization: 'owner ADMIN organization',
      mustChangePassword: true,
    }),
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error instanceof Error ? error.message : 'Provision failed.');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
