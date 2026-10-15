import { describe, expect, it } from 'vitest';
import { purchaseOrderInputSchema, purchaseOrderLineTotal } from './purchase-order';
import { buildPurchaseOrderPdf } from './purchase-order-pdf';

describe('supplier purchase orders', () => {
  const input = {
    id: '40496278-19a9-45b3-a499-f088f40b3bcc',
    supplierCatalogItemId: 'supplier-1',
    items: [
      { catalogItemId: 'product-1', quantity: 3, referenceUnitPrice: 1.25 },
      { catalogItemId: 'product-2', quantity: 2, referenceUnitPrice: 2.1 },
    ],
  };

  it('requires whole quantities and user entered two-decimal reference prices', () => {
    expect(purchaseOrderInputSchema.safeParse(input).success).toBe(true);
    expect(
      purchaseOrderInputSchema.safeParse({
        ...input,
        items: [{ ...input.items[0], quantity: 1.5 }],
      }).success,
    ).toBe(false);
    expect(
      purchaseOrderInputSchema.safeParse({
        ...input,
        items: [{ ...input.items[0], referenceUnitPrice: 1.001 }],
      }).success,
    ).toBe(false);
    expect(purchaseOrderInputSchema.safeParse({ ...input, items: [] }).success).toBe(false);
    expect(purchaseOrderLineTotal(3, 1.25) + purchaseOrderLineTotal(2, 2.1)).toBe(7.95);
  });

  it('creates a printable multi-item PDF from an immutable order snapshot', async () => {
    const bytes = await buildPurchaseOrderPdf({
      ...input,
      orderNumber: `OC-${input.id}`,
      issuedAt: '2026-10-14T00:00:00.000Z',
      supplierName: 'Proveedor ficticio',
      items: [
        { ...input.items[0], sku: 'A-1', name: 'Producto sintético A', lineTotal: 3.75 },
        { ...input.items[1], sku: 'B-2', name: 'Producto sintético B', lineTotal: 4.2 },
      ],
      total: 7.95,
      fingerprint: 'f'.repeat(64),
    });
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(500);
  });
});
