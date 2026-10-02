import { describe, expect, it } from 'vitest';
import type { InventoryTraceRecord } from '@analiza/contracts';
import {
  expiredTraceQuantity,
  inventoryTraceEffectiveStatus,
  inventoryTraceQuantity,
} from './inventory-traceability';

const record: InventoryTraceRecord = {
  id: 'trace-1',
  kind: 'LOT',
  itemId: 'item-1',
  supplierCatalogItemId: 'provider-1',
  number: 'LOT-SYN-1',
  receivedQuantity: 5,
  expiresOn: '2027-01-31',
  receiptReference: 'REC-SYN-1',
  qualityStatus: 'AVAILABLE',
  receivedAt: '2026-09-28T12:00:00.000Z',
  createdAt: '2026-09-28T12:00:00.000Z',
  updatedAt: '2026-09-28T12:00:00.000Z',
  balances: [
    { warehouseId: 'warehouse-a', quantity: 2 },
    { warehouseId: 'warehouse-b', quantity: 3 },
  ],
};

describe('inventory traceability projections', () => {
  it('sums balances and derives expired/depleted without mutating quality history', () => {
    expect(inventoryTraceQuantity(record)).toBe(5);
    expect(inventoryTraceEffectiveStatus(record, '2027-02-01')).toBe('EXPIRED');
    expect(
      inventoryTraceEffectiveStatus({ ...record, qualityStatus: 'REJECTED' }, '2027-02-01'),
    ).toBe('REJECTED');
    expect(inventoryTraceEffectiveStatus({ ...record, balances: [] }, '2026-09-28')).toBe(
      'DEPLETED',
    );
    expect(record.qualityStatus).toBe('AVAILABLE');
  });

  it('excludes only expired released stock from the requested warehouse', () => {
    expect(expiredTraceQuantity([record], 'item-1', 'warehouse-a', '2027-02-01')).toBe(2);
    expect(expiredTraceQuantity([record], 'item-1', 'warehouse-a', '2026-12-31')).toBe(0);
    expect(
      expiredTraceQuantity(
        [{ ...record, qualityStatus: 'BLOCKED' }],
        'item-1',
        'warehouse-a',
        '2027-02-01',
      ),
    ).toBe(0);
  });
});
