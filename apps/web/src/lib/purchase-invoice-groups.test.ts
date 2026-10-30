import { purchaseSchema } from '@analiza/contracts';
import { describe, expect, it } from 'vitest';
import { invoiceVoidSource } from './purchase-invoice-groups';

const line = purchaseSchema.parse({
  id: 'synthetic-line-1',
  catalogItemId: 'synthetic-item',
  reference: 'synthetic-reference',
  invoiceNumber: 'synthetic-invoice',
  invoiceGroupId: 'synthetic-group',
  status: 'DRAFT',
  createdAt: '2026-10-14T00:00:00Z',
});

describe('invoice group actions', () => {
  it('offers an atomic invoice cancellation only while every grouped line is draft', () => {
    const second = { ...line, id: 'synthetic-line-2' };
    expect(invoiceVoidSource([line, second])).toEqual(line);
    expect(invoiceVoidSource([line])).toBeNull();
    expect(invoiceVoidSource([line, { ...second, invoiceNumber: 'another' }])).toBeNull();
  });
  it('uses a received line when the first line was cancelled', () => {
    const received = { ...line, id: 'synthetic-line-2', status: 'RECEIVED' as const };
    expect(invoiceVoidSource([{ ...line, status: 'CANCELLED' }, received])).toEqual(received);
  });

  it('withholds invoice voiding while any line is draft or already voided', () => {
    const received = { ...line, id: 'synthetic-line-2', status: 'RECEIVED' as const };
    expect(invoiceVoidSource([line, received])).toBeNull();
    expect(
      invoiceVoidSource([
        { ...line, status: 'CANCELLED' },
        { ...received, invoiceVoidedAt: '2026-10-14T01:00:00Z' },
      ]),
    ).toBeNull();
    expect(
      invoiceVoidSource([{ ...line, status: 'CANCELLED', invoiceNumber: 'other' }, received]),
    ).toBeNull();
  });
});
