import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  patientSchema,
  inventoryMovementSchema,
  catalogItemSchema,
} from '../packages/contracts/src/index';
import { postgresPersistence } from '../apps/web/src/server/persistence/postgres';
import {
  postgresPool,
  transaction,
  closePostgresPool,
} from '../apps/web/src/server/persistence/postgres-pool';
import { inventoryLedger, stockByWarehouse } from '../apps/web/src/lib/inventory-ledger';

assert.equal(process.env.ANALIZA_QA_MODE, '1');
assert.equal(process.env.PGDATABASE, 'analiza_qa');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.notEqual(process.env.PGUSER, 'postgres');
const actor = { userId: 'qa-admin', organizationId: 'qa-org-a', role: 'ADMIN' as const };
const foreign = { userId: 'qa-foreign', organizationId: 'qa-org-c', role: 'ADMIN' as const };
const denied = { ...actor, role: 'DOCTOR' as const };
const backend = postgresPersistence(),
  pool = postgresPool();
const run = randomUUID().slice(0, 8);
const now = () => new Date().toISOString();
const id = (label: string) => `stock-qa-${run}-${label}`;
const patientId = id('patient'),
  itemId = id('equipment'),
  warehouseId = id('origin'),
  destination = id('destination');
const send = (command: unknown) => backend.operations.execute(actor, command);
try {
  await backend.patients.create(actor, {
    patient: patientSchema.parse({
      id: patientId,
      fullName: `Paciente sintético ${run}`,
      documentType: 'OTHER',
      documentId: id('document'),
      referralOrigin: 'FAMILY_FRIENDS',
    }),
  });
  for (const [catalogId, category] of [
    [itemId, 'EQUIPMENT'],
    [id('supply'), 'SUPPLIES'],
    [id('supplier'), 'PROVIDERS'],
  ]) {
    await send({
      command: 'catalog.save',
      item: catalogItemSchema.parse({
        id: catalogId,
        name: catalogId,
        sku: catalogId,
        status: 'ACTIVE',
        category,
        createdAt: now(),
        ...(category === 'PROVIDERS'
          ? {
              contactName: 'Contacto QA',
              address: 'Dirección sintética',
              email: 'qa@example.invalid',
              landlinePhone: '0000-0000',
            }
          : {}),
      }),
    });
  }
  for (const w of [warehouseId, destination])
    await send({
      command: 'warehouse.save',
      warehouse: { id: w, code: w, name: w, status: 'ACTIVE' },
    });
  const entry = {
    id: randomUUID(),
    itemId,
    warehouseId,
    kind: 'ENTRY',
    quantity: 7,
    createdAt: now(),
    reason: 'Entrada manual',
  };
  await send({ command: 'inventory.record', idempotencyKey: entry.id, movement: entry });
  await assert.rejects(
    send({
      command: 'inventory.record',
      idempotencyKey: randomUUID(),
      movement: {
        ...entry,
        id: randomUUID(),
        kind: 'ADJUSTMENT',
        adjustmentDirection: 'IN',
      },
    }),
  );
  const transfer = {
    id: randomUUID(),
    idempotencyKey: randomUUID(),
    itemId,
    sourceWarehouseId: warehouseId,
    destinationWarehouseId: destination,
    quantity: 2,
    reason: 'Traslado entre bodegas',
    occurredAt: now(),
  };
  await Promise.all([1, 2].map(() => send({ command: 'inventory.transfer', transfer })));
  const loan = {
    id: randomUUID(),
    idempotencyKey: randomUUID(),
    patientId,
    itemId,
    warehouseId,
    quantity: 3,
    sentAt: now(),
    reference: id('loan'),
  };
  const request = { command: 'home.equipment.loan', dispatch: loan };
  await assert.rejects(backend.operations.execute(denied, request));
  await assert.rejects(send({ ...request, dispatch: { ...loan, itemId: id('supply') } }));
  await assert.rejects(send({ ...request, dispatch: { ...loan, warehouseId: destination } }));
  await Promise.all([1, 2].map(() => send(request)));
  const part = { id: randomUUID(), custodyId: loan.id, quantity: 1, receivedAt: now() };
  const returnCmd = { command: 'home.equipment.return', receipt: part };
  await Promise.all([1, 2].map(() => send(returnCmd)));
  await assert.rejects(backend.operations.execute(foreign, returnCmd));
  await assert.rejects(backend.operations.execute(denied, returnCmd));
  await assert.rejects(send({ ...returnCmd, receipt: { ...part, quantity: 2 } }));
  await assert.rejects(send({ ...returnCmd, receipt: { ...part, id: randomUUID(), quantity: 3 } }));
  const last = await Promise.allSettled(
    [1, 2].map(() => send({ ...returnCmd, receipt: { ...part, id: randomUUID(), quantity: 2 } })),
  );
  assert.equal(last.filter((v) => v.status === 'fulfilled').length, 1);
  const receipt = {
    id: randomUUID(),
    idempotencyKey: randomUUID(),
    itemId: id('supply'),
    warehouseId,
    supplierCatalogItemId: id('supplier'),
    kind: 'LOT',
    number: id('lot'),
    quantity: 4,
    expiresOn: '2035-01-10',
    receivedAt: now(),
    receiptReference: id('receipt'),
    reason: 'Recepción sintética',
  };
  await send({ command: 'inventory.trace.receive', receipt });
  await send({
    command: 'inventory.trace.status',
    change: {
      id: randomUUID(),
      idempotencyKey: randomUUID(),
      recordId: receipt.id,
      status: 'AVAILABLE',
      reason: 'Verificación QA',
      occurredAt: now(),
    },
  });
  const operations = await backend.operations.list(actor);
  const movements = await transaction(pool, actor, async (c) =>
    (
      await c.query(
        'SELECT body FROM analiza.inventory_movements WHERE organization_id=$1 AND item_id=ANY($2)',
        [actor.organizationId, [itemId, id('supply')]],
      )
    ).rows.map((r) => inventoryMovementSchema.parse(r.body)),
  );
  const custody = operations.homeCustodies.find((c) => c.id === loan.id)!;
  assert.equal(custody.returnedQuantity, 3);
  assert.equal(custody.status, 'CLOSED');
  assert.equal(custody.returns?.length, 2);
  const rows = inventoryLedger(
    movements,
    operations.traceRecords,
    operations.inventoryLedgerReceipts,
    [],
    [custody],
    [],
  );
  const physical = rows.find((r) => r.traceRecordId === receipt.id && r.heldReceipt);
  assert.equal(physical?.warehouseId, warehouseId);
  assert.equal(physical?.quantity, 4);
  assert.equal(physical?.delta, 0);
  assert.equal(
    rows.filter((r) => r.traceRecordId === receipt.id).reduce((sum, r) => sum + r.delta, 0),
    4,
  );
  assert.equal(rows.filter((r) => r.patientId === patientId && r.kind === 'EXIT').length, 1);
  assert.equal(rows.filter((r) => r.patientId === patientId && r.kind === 'RETURN').length, 2);
  const stock = stockByWarehouse(movements, operations.traceRecords, [custody]);
  assert.equal(
    stock.find((p) => p.itemId === itemId && p.warehouseId === warehouseId)?.available,
    2,
  );
  assert.equal(
    stock.find((p) => p.itemId === itemId && p.warehouseId === destination)?.available,
    2,
  );
  assert.equal(stock.find((p) => p.itemId === itemId && p.warehouseId === warehouseId)?.held, 3);
  console.log(
    'PASS PostgreSQL: per-row transfer, physical receipt versus release, equipment-only loan, patient attribution, partial return, duplicate retry, concurrent over-return, quarantine, permissions and tenant isolation.',
  );
} finally {
  await closePostgresPool();
}
