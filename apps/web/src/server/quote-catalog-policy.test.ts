import { describe, expect, it } from 'vitest';
import type { Quote } from '@analiza/contracts';
import { quoteCatalogPriceError } from './quote-catalog-policy';

const base: Quote = {
  id: 'quote-policy',
  patientId: 'patient-demo',
  version: 1,
  status: 'DRAFT',
  summary: 'Cotización sintética',
  items: [
    {
      id: 'line-1',
      category: 'MEDICATIONS',
      name: 'Ítem sintético',
      inventoryItemId: 'catalog-1',
      quantity: 1,
      unitPrice: 12,
      discountAmount: 0,
    },
  ],
  subtotal: 12,
  discountAmount: 0,
  total: 12,
  insurerAmount: 0,
  patientAmount: 12,
  immutable: false,
  createdAt: new Date(0).toISOString(),
};

describe('quote catalog price policy', () => {
  const catalog = [
    {
      id: 'catalog-1',
      category: 'MEDICATIONS',
      status: 'ACTIVE',
      salePriceExcludingTax: 12,
    },
  ];
  it('accepts only the current registered price for a new line', () => {
    expect(quoteCatalogPriceError(base, catalog, [])).toBeNull();
    expect(
      quoteCatalogPriceError(
        { ...base, items: [{ ...base.items[0], unitPrice: 11 }] },
        catalog,
        [],
      ),
    ).toContain('catálogo');
    expect(quoteCatalogPriceError(base, [], [])).toContain('catálogo');
  });
  it('preserves a historical price while permitting a manual quantity change', () => {
    const changed = { ...base, items: [{ ...base.items[0], quantity: 3 }] };
    expect(quoteCatalogPriceError(changed, [], [], base)).toBeNull();
  });
  it('requires a configured doctor fee for a new honorarium', () => {
    const fee = {
      ...base,
      items: [
        {
          ...base.items[0],
          category: 'FEES' as const,
          doctorId: 'doctor-1',
          inventoryItemId: undefined,
        },
      ],
    };
    expect(quoteCatalogPriceError(fee, [], [{ id: 'doctor-1', medicalFee: 12 }])).toBeNull();
    expect(quoteCatalogPriceError(fee, [], [{ id: 'doctor-1', medicalFee: 14 }])).toContain(
      'honorario',
    );
  });
});
