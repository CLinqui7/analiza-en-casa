import { describe, expect, it } from 'vitest';
import type { Purchase } from '@analiza/contracts';
import { purchaseTotals, samePurchaseTaxRates } from './purchase-totals';

const line = (id: string, quantity: number, unitCost: number, perception: 0 | 0.01): Purchase => ({
  id,
  catalogItemId: `item-${id}`,
  supplierCatalogItemId: 'supplier-qa',
  warehouseId: 'warehouse-qa',
  invoiceGroupId: 'invoice-qa',
  invoiceNumber: 'SYN-1',
  reference: 'SYN-1',
  quantity,
  unitCost,
  taxRates: { iva: 0.13, perception },
  status: 'DRAFT',
  createdAt: '2026-10-20T00:00:00.000Z',
});

describe('client-requested purchase arithmetic', () => {
  it('rounds invoice totals once at cents and adds selected perception', () => {
    expect(purchaseTotals([line('1', 3, 1.01, 0.01), line('2', 2, 2.02, 0.01)])).toEqual({
      subtotal: 7.07,
      iva: 0.92,
      perception: 0.07,
      total: 8.06,
    });
  });
  it('multiplies a four-decimal unit price before rounding the line', () => {
    expect(purchaseTotals([line('precision', 12, 1.725, 0)])).toEqual({
      subtotal: 20.7,
      iva: 2.69,
      perception: 0,
      total: 23.39,
    });
  });
  it('does not invent taxes for historical lines or combine mismatched tax choices', () => {
    expect(purchaseTotals([{ ...line('1', 1, 1, 0), taxRates: undefined }])).toBeNull();
    expect(purchaseTotals([line('1', 1, 1, 0), line('2', 1, 1, 0.01)])).toBeNull();
    expect(
      samePurchaseTaxRates({ iva: 0.13, perception: 0 }, { iva: 0.13, perception: 0.01 }),
    ).toBe(false);
  });
});
