import { describe, expect, it } from 'vitest';
import type {
  HomeCustody,
  InventoryMovement,
  InventoryTraceRecord,
  Purchase,
} from '@analiza/contracts';
import { custodyReturns, inventoryLedger, stockByWarehouse } from './inventory-ledger';

const now = '2026-11-18T12:00:00.000Z';
const record: InventoryTraceRecord = {
  id: 'trace',
  kind: 'LOT',
  itemId: 'insumo',
  supplierCatalogItemId: 'prov',
  number: 'LOT-QA',
  receivedQuantity: 5,
  receivedAt: now,
  createdAt: now,
  updatedAt: now,
  receiptReference: 'INT',
  qualityStatus: 'AVAILABLE',
  balances: [{ warehouseId: 'B', quantity: 5 }],
};
const purchase: Purchase = {
  id: 'purchase',
  catalogItemId: 'insumo',
  warehouseId: 'A',
  reference: 'INT',
  quantity: 5,
  invoiceNumber: 'DOC-QA',
  createdAt: now,
  receivedAt: now,
  status: 'RECEIVED',
  traceRecordId: 'trace',
};
const release: InventoryMovement = {
  id: 'release',
  itemId: 'insumo',
  warehouseId: 'A',
  createdAt: now,
  kind: 'ENTRY',
  quantity: 5,
  reason: 'Liberación',
  traceRecordId: 'trace',
  traceNumber: 'LOT-QA',
};
const custody: HomeCustody = {
  id: 'loan',
  patientId: 'paciente',
  itemId: 'equipo',
  warehouseId: 'A',
  quantity: 3,
  sentAt: now,
  reference: 'loan',
  idempotencyKey: 'loan',
  status: 'CLOSED',
  dispatchedBy: 'inventario',
  returnedQuantity: 2,
  receivedAt: now,
  traceAllocations: [],
};

describe('stock workspace ledger', () => {
  it('displays one purchase receipt in the original warehouse and counts only released units as available', () => {
    const rows = inventoryLedger(
      [release],
      [record],
      [{ traceRecordId: 'trace', warehouseId: 'A', purchaseDocumentNumber: 'DOC-QA' }],
      [purchase],
      [],
      [],
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.heldReceipt)).toMatchObject({
      warehouseId: 'A',
      purchaseDocumentNumber: 'DOC-QA',
      quantity: 5,
      delta: 0,
    });
    expect(rows.reduce((sum, r) => sum + r.delta, 0)).toBe(5);
    expect(inventoryLedger([], [record], [], [purchase], [], [])[0]).toMatchObject({
      warehouseId: 'A',
      purchaseDocumentNumber: 'DOC-QA',
    });
  });
  it('keeps historical partial home closures in quarantine with one physical receipt', () => {
    expect(custodyReturns(custody)).toHaveLength(1);
    const rows = inventoryLedger([], [], [], [], [custody], []);
    expect(rows[0]).toMatchObject({
      patientId: 'paciente',
      quantity: 2,
      kind: 'RETURN',
      heldReceipt: true,
      delta: 0,
      balance: 0,
    });
    expect(stockByWarehouse([], [], [custody])).toEqual([
      { itemId: 'equipo', warehouseId: 'A', held: 2, available: 0, expired: 0 },
    ]);
  });
  it('groups tracked expiration by item and warehouse without counting it again as held', () => {
    const positions = stockByWarehouse(
      [{ ...release, warehouseId: 'B' }],
      [{ ...record, expiresOn: '2026-10-01' }],
      [],
      '2026-11-18',
    );
    expect(positions).toEqual([
      { itemId: 'insumo', warehouseId: 'B', available: 0, expired: 5, held: 0 },
    ]);
  });
});
