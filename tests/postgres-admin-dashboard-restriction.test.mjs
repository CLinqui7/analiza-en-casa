import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migration = await readFile(
  new URL('../database/postgresql/migrations/027_admin_dashboard_restriction.sql', import.meta.url),
  'utf8',
);
const operator = await readFile(
  new URL('../scripts/deployment/grant-workspace-admin-access-20261008.mjs', import.meta.url),
  'utf8',
);
const authStore = await readFile(
  new URL('../apps/web/src/server/persistence/postgres-auth.ts', import.meta.url),
  'utf8',
);

test('Dashboard exclusion is opt-in and the access-change ledger is tenant-scoped', () => {
  assert.match(migration, /dashboard_restricted boolean NOT NULL DEFAULT false/);
  assert.match(migration, /CREATE TABLE analiza\.membership_access_changes/);
  assert.match(migration, /FOREIGN KEY \(target_user_id,organization_id\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /CREATE POLICY tenant_scope/);
  assert.doesNotMatch(migration, /password_hash|patient_id|diagnosis/i);
  assert.match(authStore, /dashboard_restricted AS "dashboardRestricted"/);
});

test('the eight-account plan matches the explicit client list and Dashboard exceptions', () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            '../scripts/deployment/grant-workspace-admin-access-20261008.mjs',
            import.meta.url,
          ),
        ),
      ],
      {
        encoding: 'utf8',
      },
    ),
  );
  assert.equal(plan.operation, 'PLAN_ONLY');
  assert.equal(plan.organizationId, 'analiza-main');
  assert.deepEqual(
    Object.fromEntries(
      plan.targets.map(({ email, dashboardRestricted }) => [email, dashboardRestricted]),
    ),
    {
      'karla@analizaencasa.com': true,
      'nancy.vasquez@analizaencasa.com': true,
      'abigailsv92@analizaencasa.com': true,
      'analiza@analizaencasa.com': true,
      'claudia.pinzon@analizaencasa.com': false,
      'nelly.viscarra@analizaencasa.com': true,
      'olaya.deras@analizaencasa.com': true,
      'sissy.chavez@analizaencasa.com': false,
    },
  );
  assert.equal(plan.targets.length, 8);
});

test('the account grant is scoped, audited, transactional and does not store credentials', () => {
  assert.match(operator, /ANALIZA_ACCESS_CHANGE_APPROVED/);
  assert.match(operator, /const organizationId = 'analiza-main'/);
  assert.match(operator, /karla@analizaencasa\.com'.*dashboardRestricted: true/);
  assert.match(operator, /nancy\.vasquez@analizaencasa\.com'.*dashboardRestricted: true/);
  assert.match(operator, /abigailsv92@analizaencasa\.com'.*dashboardRestricted: true/);
  assert.match(operator, /analiza@analizaencasa\.com'.*dashboardRestricted: true/);
  assert.match(operator, /claudia\.pinzon@analizaencasa\.com'.*dashboardRestricted: false/);
  assert.match(operator, /nelly\.viscarra@analizaencasa\.com'.*dashboardRestricted: true/);
  assert.match(operator, /olaya\.deras@analizaencasa\.com'.*dashboardRestricted: true/);
  assert.match(operator, /sissy\.chavez@analizaencasa\.com'.*dashboardRestricted: false/);
  assert.match(
    operator,
    /BEGIN[\s\S]+FOR UPDATE OF u,m[\s\S]+INSERT INTO analiza\.membership_access_changes[\s\S]+UPDATE analiza\.sessions[\s\S]+COMMIT/,
  );
  assert.doesNotMatch(operator, /password_hash|password:|service_role/i);
});
