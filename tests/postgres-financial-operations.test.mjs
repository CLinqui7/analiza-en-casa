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
