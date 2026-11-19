import { describe, expect, it } from 'vitest';
import { orderActionSchema, purchaseOrderSchema, type OrderAction } from '@/lib/purchase-order';
import { purchaseTotals } from '@/lib/purchase-totals';
import { buildReceiptLines } from './postgres-purchase-receipt';

const now = '2026-11-18T16:00:00.000Z';
const order = purchaseOrderSchema.parse({
  id: '21c325fa-f43c-46d1-8c30-b5fb98b13436',
  orderNumber: 'OC-QA',
  supplierName: 'Proveedor de prueba',
  supplierCatalogItemId: 'qa-provider',
  items: [
    {
      catalogItemId: 'qa-supply',
      sku: 'QA01',
      name: 'Insumo',
      quantity: 5,
      referenceUnitPrice: 1.23,
      lineTotal: 6.15,
    },
    {
      catalogItemId: 'qa-equipment',
      sku: 'QA02',
      name: 'Equipo',
      quantity: 2,
      referenceUnitPrice: 1.725,
      lineTotal: 3.45,
    },
  ],
  total: 10.85,
  fingerprint: 'c'.repeat(64),
  issuedAt: now,
});
const common = {
  quantity: 4,
  lotNumber: 'A',
  expiresOn: '2027-12-01',
  serialNumbers: [],
  usefulLife: '',
  isFixedAsset: false,
};
const input: Extract<OrderAction, { action: 'receive' }> = {
  action: 'receive',
  revision: 2,
  destination: 'KIT',
  documentKind: 'FISCAL_CREDIT',
  documentNumber: 'QA1',
  lines: [
    { ...common, index: 0 },
    {
      ...common,
      index: 1,
      quantity: 2,
      lotNumber: '',
      expiresOn: '',
      serialNumbers: ['S1', 'S2'],
      isFixedAsset: true,
    },
  ],
};
const categories = new Map([
  ['qa-supply', 'SUPPLIES'],
  ['qa-equipment', 'EQUIPMENT'],
]);
const build = (data: typeof input) => buildReceiptLines(order, data, categories, 'w', now);
describe('recepción de una orden aprobada', () => {
  it('recibe cantidades reales, conserva series y separa inventario físico y saldo disponible', () => {
    const records = build(input);
    expect(records.map((r) => r.trace.receivedQuantity)).toEqual([4, 1, 1]);
    expect(records.every((r) => r.trace.qualityStatus === 'QUARANTINED')).toBe(true);
    expect(records.map((r) => r.purchase.traceRecordId)).toEqual(records.map((r) => r.trace.id));
    expect(records.every((r) => r.purchase.invoiceGroupId === order.id)).toBe(true);
    expect(records.every((r) => r.purchase.providerDocumentKind === 'FISCAL_CREDIT')).toBe(true);
    expect(purchaseTotals(records.map((r) => r.purchase))).toEqual({
      subtotal: 8.37,
      iva: 1.09,
      perception: 0,
      total: 9.46,
    });
    expect(build(input)).toEqual(records);
  });
  it('rechaza sobre-recepción, líneas repetidas, lotes sin vencimiento y series repetidas', () => {
    const [s, e] = input.lines;
    for (const lines of [
      [{ ...s, quantity: 6 }, e],
      [s, s],
      [{ ...s, expiresOn: '' }, e],
      [s, { ...e, serialNumbers: ['id', 'ID'] }],
      [s, { ...e, serialNumbers: ['id'] }],
      [s],
    ]) {
      expect(() => build({ ...input, lines })).toThrow();
    }
  });
  it('permite faltantes y conserva la identidad de los reintentos', () => {
    const records = build({
      ...input,
      lines: [{ ...input.lines[0], quantity: 0 }, input.lines[1]],
    });
    expect(records.length).toBe(2);
    expect(records[1].id).toBe(build(input)[2].id);
    expect(() =>
      build({ ...input, lines: input.lines.map((x) => ({ ...x, quantity: 0 })) }),
    ).toThrow();
  });
  it('requere motivo, revisiones, bodega admitida, número y documentos conocidos', () => {
    expect(
      orderActionSchema.safeParse({ action: 'cancel', revision: 2, reason: '   ' }).success,
    ).toBe(false);
    for (const invalid of [
      { destination: 'EXT' },
      { documentNumber: ' ' },
      { revision: 0 },
      { documentKind: 'OTHER' },
    ]) {
      expect(orderActionSchema.safeParse({ ...input, ...invalid }).success).toBe(false);
    }
  });
});
