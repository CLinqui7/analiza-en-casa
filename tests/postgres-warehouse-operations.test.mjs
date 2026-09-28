import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../database/postgresql/migrations/017_warehouses_and_transfers.sql', import.meta.url),
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

// test-id: node:postgres-warehouse-tenant-integrity
test('warehouse and transfer tables are tenant-scoped and preserve referential integrity', () => {
  for (const table of ['warehouses', 'inventory_transfers']) {
    assert.match(migration, new RegExp(`CREATE TABLE analiza\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE analiza\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`ALTER TABLE analiza\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /UNIQUE \(organization_id,code_normalized\)/);
  assert.match(migration, /UNIQUE \(organization_id,idempotency_key\)/);
  assert.match(migration, /CHECK \(source_warehouse_id <> destination_warehouse_id\)/);
  assert.match(migration, /REFERENCES analiza\.warehouses\(organization_id,id\)/);
});

// test-id: node:postgres-warehouse-transfer-atomicity
test('warehouse transfers lock both balances and create equal opposite movements atomically', () => {
  const start = repository.indexOf("if (command.command === 'inventory.transfer')");
  const end = repository.indexOf("if (command.command === 'configuration.save')", start);
  assert.ok(start >= 0 && end > start, 'transfer command must remain identifiable');
  const source = repository.slice(start, end);
  assert.match(source, /lockKeys[\s\S]+\.sort\(\)/);
  assert.match(source, /sourceBalance < transfer\.quantity/);
  assert.match(source, /transferDirection: 'OUT'/);
  assert.match(source, /transferDirection: 'IN'/);
  assert.match(source, /-transfer\.quantity/);
  assert.match(source, /INVENTORY_TRANSFER_RECORDED/);
});

test('warehouse deactivation requires zero stock and runtime grants exclude delete', () => {
  assert.match(repository, /Traslade o ajuste todas las existencias antes de desactivar la bodega/);
  assert.match(migrationRunner, /SELECT,INSERT,UPDATE ON analiza\.warehouses/);
  assert.match(migrationRunner, /SELECT,INSERT ON [^\n]+analiza\.inventory_transfers/);
  assert.doesNotMatch(migrationRunner, /DELETE ON analiza\.(warehouses|inventory_transfers)/);
});
