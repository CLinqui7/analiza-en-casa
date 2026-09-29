import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../database/postgresql/migrations/018_inventory_traceability.sql', import.meta.url),
  'utf8',
);
const postgres = await readFile(
  new URL('../apps/web/src/server/persistence/postgres.ts', import.meta.url),
  'utf8',
);
const mongo = await readFile(
  new URL('../apps/web/src/server/mongo-operations.ts', import.meta.url),
  'utf8',
);
const grants = await readFile(
  new URL('../scripts/deployment/db-command.mjs', import.meta.url),
  'utf8',
);

test('traceability schema is tenant-scoped, relational and append-only', () => {
  for (const table of [
    'inventory_trace_records',
    'inventory_trace_balances',
    'inventory_trace_events',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE analiza\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE analiza\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`ALTER TABLE analiza\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /CREATE UNIQUE INDEX inventory_trace_serial_unique/);
  assert.match(migration, /WHERE kind='SERIAL'/);
  assert.match(migration, /quantity integer NOT NULL CHECK \(quantity >= 0\)/);
  assert.match(migration, /REFERENCES analiza\.warehouses\(organization_id,id\)/);
  assert.match(migration, /inventory_movements_trace_record_fk/);
  assert.doesNotMatch(grants, /DELETE ON analiza\.inventory_trace/);
});

test('receipt stays quarantined and state release/removal changes stock atomically', () => {
  const receiveStart = postgres.indexOf("if (command.command === 'inventory.trace.receive')");
  const statusStart = postgres.indexOf("if (command.command === 'inventory.trace.status')");
  const issueStart = postgres.indexOf("if (command.command === 'inventory.trace.issue')");
  assert.ok(receiveStart >= 0 && statusStart > receiveStart && issueStart > statusStart);
  const receive = postgres.slice(receiveStart, statusStart);
  const status = postgres.slice(statusStart, issueStart);
  assert.match(receive, /qualityStatus: 'QUARANTINED'/);
  assert.doesNotMatch(receive, /insertTraceMovement/);
  assert.match(status, /Un lote vencido no puede liberarse ni distribuirse/);
  assert.match(status, /QUARANTINED: \['AVAILABLE', 'BLOCKED', 'REJECTED'\]/);
  assert.match(status, /insertTraceMovement/);
  assert.match(status, /INVENTORY_TRACE_/);
});

test('FEFO issue and transfers lock and preserve trace balances', () => {
  const issueStart = postgres.indexOf("if (command.command === 'inventory.trace.issue')");
  const transferStart = postgres.indexOf("if (command.command === 'inventory.transfer')");
  const issue = postgres.slice(issueStart, transferStart);
  const transferEnd = postgres.indexOf(
    "if (command.command === 'configuration.save')",
    transferStart,
  );
  const transfer = postgres.slice(transferStart, transferEnd);
  assert.match(issue, /ORDER BY record\.expires_on ASC NULLS LAST,record\.received_at,record\.id/);
  assert.match(issue, /FOR UPDATE OF record,balance/);
  assert.match(issue, /quantity=quantity-\$4/);
  assert.match(issue, /INVENTORY_FEFO_ISSUED/);
  assert.match(transfer, /inventory_trace_balances/);
  assert.match(transfer, /event_type,idempotency_key,body,occurred_at/);
  assert.match(transfer, /'TRANSFERRED'/);
  assert.match(transfer, /traceNumber: candidate\.number_normalized/);
});

test('both persistence engines block generic movements after tracing starts', () => {
  for (const source of [postgres, mongo]) {
    assert.match(source, /Este artículo usa trazabilidad/);
    assert.match(source, /inventory\.trace\.receive/);
    assert.match(source, /inventory\.trace\.status/);
    assert.match(source, /inventory\.trace\.issue/);
  }
});
