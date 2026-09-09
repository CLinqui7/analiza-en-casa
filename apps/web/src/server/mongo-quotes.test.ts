import { describe, expect, it } from 'vitest';
import { parseQuoteCreate, parseQuoteReplace } from './mongo-quotes';

const quote = {
  id: 'quote-safe-001', caseId: 'case-safe-001', patientId: 'patient-safe-001',
  version: 1, status: 'DRAFT' as const, summary: 'Cotización sintética',
  items: [{ id: 'item-1', category: 'SERVICES' as const, name: 'Servicio sintético', quantity: 2, unitPrice: 25, discountAmount: 0 }],
  subtotal: 999, discountAmount: 0, total: 999, insurerAmount: 10, patientAmount: 989,
  immutable: false, createdAt: '2026-09-09T12:00:00.000Z',
  originalQuoteId: 'quote-safe-001', rootQuoteId: 'quote-safe-001',
};

describe('Mongo quote commands', () => {
  it('recalculates totals instead of trusting browser totals', () => {
    const parsed = parseQuoteCreate({ quote });
    expect(parsed.subtotal).toBe(50);
    expect(parsed.total).toBe(50);
    expect(parsed.patientAmount).toBe(40);
  });

  it('rejects browser-controlled tenant authority and sent mutations', () => {
    expect(() => parseQuoteCreate({ quote, organizationId: 'foreign' })).toThrow();
    expect(() => parseQuoteReplace({ quote: { ...quote, status: 'SENT', immutable: true }, expectedVersion: 1 })).toThrow();
  });
});
