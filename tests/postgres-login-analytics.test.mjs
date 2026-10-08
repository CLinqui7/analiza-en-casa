import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../database/postgresql/migrations/020_login_analytics.sql', import.meta.url),
  'utf8',
);
const webmasterMigration = await readFile(
  new URL('../database/postgresql/migrations/022_webmaster_role.sql', import.meta.url),
  'utf8',
);
const multipleWebmastersMigration = await readFile(
  new URL('../database/postgresql/migrations/025_multiple_webmasters.sql', import.meta.url),
  'utf8',
);
const runner = await readFile(
  new URL('../scripts/deployment/db-command.mjs', import.meta.url),
  'utf8',
);
const authStore = await readFile(
  new URL('../apps/web/src/server/persistence/postgres-auth.ts', import.meta.url),
  'utf8',
);
const permissions = await readFile(
  new URL('../apps/web/src/lib/permissions.ts', import.meta.url),
  'utf8',
);

test('successful-login ledger is tenant-scoped, minimal and indexed', () => {
  assert.match(migration, /CREATE TABLE analiza\.login_events/);
  assert.match(migration, /FOREIGN KEY \(user_id,organization_id\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /CREATE POLICY tenant_scope ON analiza\.login_events/);
  assert.match(migration, /login_events_org_user_time/);
  assert.doesNotMatch(migration, /password_hash|ip_address|user_agent/i);
});

test('ANALYTICS is a single-purpose, single-active account per organization', () => {
  assert.match(migration, /memberships_single_active_analytics/);
  assert.match(migration, /WHERE active AND role='ANALYTICS'/);
  assert.match(permissions, /ANALYTICS: \['login-analytics:read'\]/);
  assert.doesNotMatch(permissions, /ANALYTICS:[^\n]+patients:read/);
});

test('WEBMASTER receives ADMIN capabilities plus analytics and allows multiple explicit accounts', () => {
  assert.match(webmasterMigration, /'WEBMASTER'/);
  assert.match(webmasterMigration, /memberships_single_active_webmaster/);
  assert.match(webmasterMigration, /WHERE active AND role='WEBMASTER'/);
  assert.match(multipleWebmastersMigration, /DROP INDEX IF EXISTS analiza\.memberships_single_active_webmaster/);
  assert.match(permissions, /WEBMASTER: \[\.\.\.allRead, \.\.\.allWrite, 'login-analytics:read'\]/);
});

test('session issuance and login event commit together and runtime has least privilege', () => {
  assert.match(authStore, /async createLoginSession/);
  assert.match(
    authStore,
    /BEGIN[\s\S]+INSERT INTO analiza\.sessions[\s\S]+INSERT INTO analiza\.login_events[\s\S]+COMMIT/,
  );
  assert.match(runner, /GRANT SELECT,INSERT ON analiza\.login_events/);
  assert.doesNotMatch(runner, /GRANT (?:ALL|DELETE|UPDATE) ON analiza\.login_events/);
});
