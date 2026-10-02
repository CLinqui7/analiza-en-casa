import { describe, expect, it } from 'vitest';
import type { CatalogItem, Purchase } from '@analiza/contracts';
import { normalizePurchaseTraceability } from './purchase-catalog';

const item: CatalogItem = {
  id: 'item-synthetic-01',
  sku: 'EQU-0002',
  name: 'Concentradores de 5 LT',
  category: 'EQUIPMENT',
  status: 'ACTIVE',
  createdAt: '2026-09-28T00:00:00.000Z',
};

const purchase: Purchase = {
  id: 'purchase-synthetic-01',
  catalogItemId: item.id,
  supplierCatalogItemId: 'supplier-synthetic-01',
  reference: 'PURCHASE-SYNTHETIC-01',
  expirationDate: '2027-01-01',
  lotNumber: 'LOT-SYNTHETIC-01',
  serialNumber: 'SERIAL-SYNTHETIC-01',
  status: 'DRAFT',
  createdAt: '2026-09-28T00:00:00.000Z',
};

describe('purchase catalog selection', () => {
  it('keeps only serial traceability for equipment', () => {
    const normalized = normalizePurchaseTraceability(purchase, 'EQUIPMENT');
    expect(normalized).toMatchObject({
      catalogItemId: item.id,
      serialNumber: 'SERIAL-SYNTHETIC-01',
    });
    expect(normalized).not.toHaveProperty('expirationDate');
    expect(normalized).not.toHaveProperty('lotNumber');
  });

  it('keeps lot and expiration but removes serials for medication and supplies', () => {
    const medication = normalizePurchaseTraceability(purchase, 'MEDICATIONS');
    expect(medication).not.toHaveProperty('serialNumber');
    expect(medication.expirationDate).toBe('2027-01-01');
    expect(medication.lotNumber).toBe('LOT-SYNTHETIC-01');
  });
});
