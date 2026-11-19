import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../database/postgresql/migrations/019_purchase_destination_warehouse.sql', import.meta.url),
  'utf8',
);
const repository = await readFile(
  new URL('../apps/web/src/server/persistence/postgres.ts', import.meta.url),
  'utf8',
);
const receipt = await readFile(
  new URL('../apps/web/src/server/persistence/postgres-purchase-receipt.ts', import.meta.url),
  'utf8',
);

test('purchase destinations remain tenant scoped and historical drafts stay unassigned', () => {
  assert.match(migration, /ADD COLUMN warehouse_id text/);
  assert.match(migration, /FOREIGN KEY \(organization_id,warehouse_id\)/);
  assert.match(migration, /REFERENCES analiza\.warehouses\(organization_id,id\)/);
  assert.match(migration, /warehouse_id IS NULL AND NOT body \? 'warehouseId'/);
  const update = repository.slice(
    repository.indexOf("if (command.command === 'purchase.update')"),
    repository.indexOf("if (command.command === 'inventory.record')"),
  );
  assert.match(update, /status='ACTIVE'/);
  assert.match(update, /purchase\.warehouseId/);
  assert.match(receipt, /SELECT id,status FROM analiza\.warehouses WHERE organization_id=\$1/);
  assert.match(receipt, /status !== 'ACTIVE'/);
  assert.match(receipt, /INSERT INTO analiza\.purchases\(organization_id,id,warehouse_id,body\)/);
});
