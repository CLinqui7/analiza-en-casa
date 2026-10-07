import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../database/postgresql/migrations/016_payments_visits_goals.sql', import.meta.url),
  'utf8',
);
const repository = await readFile(
  new URL('../apps/web/src/server/persistence/postgres.ts', import.meta.url),
  'utf8',
);
const migrationRunner = await readFile(
  new URL('../scripts/deployment/db-command.mjs', import.meta.url),
  'utf8',
);

test('PostgreSQL payments, visits and goals remain tenant scoped and idempotent', () => {
  for (const table of ['payments', 'home_visits', 'visit_goals']) {
    assert.match(migration, new RegExp(`CREATE TABLE analiza\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE analiza\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`ALTER TABLE analiza\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /UNIQUE \(organization_id,idempotency_key\)/);
  assert.match(migration, /UNIQUE \(organization_id,professional_user_id,month\)/);
});

test('PostgreSQL payment command locks the quote chain and rejects overpayment', () => {
  assert.match(repository, /payment\.apply/);
  assert.match(repository, /pg_advisory_xact_lock/);
  assert.match(repository, /última versión enviada/);
  assert.match(repository, /pago supera el saldo pendiente/);
  assert.match(repository, /PAYMENT_APPLIED/);
  assert.match(repository, /PAYMENT_VOIDED/);
});

test('PostgreSQL operations never overlap queries on one transactional client', () => {
  const start = repository.indexOf("const operations: Persistence['operations']");
  const end = repository.indexOf('async execute(actor, input)', start);
  assert.ok(start >= 0 && end > start, 'operations.list source must remain identifiable');
  assert.doesNotMatch(repository.slice(start, end), /Promise\.all/);
});

test('migration grants only the required new-table operations to the discovered runtime role', () => {
  assert.match(migrationRunner, /has_schema_privilege\(rolname,'analiza','USAGE'\)/);
  assert.match(migrationRunner, /SELECT,INSERT,UPDATE ON analiza\.payments/);
  assert.match(migrationRunner, /SELECT,INSERT ON analiza\.home_visits/);
  assert.match(migrationRunner, /SELECT,INSERT,UPDATE ON analiza\.visit_goals/);
  assert.doesNotMatch(migrationRunner, /GRANT ALL[^\n]+analiza\.(payments|home_visits|visit_goals)/);
});
