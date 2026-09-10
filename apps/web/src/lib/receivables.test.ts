import { describe, expect, it } from 'vitest';
import { quoteSchema, paymentSchema } from '@analiza/contracts';
import { receivableAccounts } from './receivables';
const quote = quoteSchema.parse({
  id: 'q1',
  rootQuoteId: 'q1',
  caseId: 'c',
  patientId: 'p',
  version: 1,
  status: 'SENT',
  summary: 'QA',
  patientAmount: 10.1,
  createdAt: '2026-09-10',
});
const payment = paymentSchema.parse({
  id: 'p1',
  quoteId: 'q1',
  amount: 3.1,
  reference: 'QA',
  idempotencyKey: 'p1',
  status: 'APPLIED',
  createdAt: '2026-09-10',
});
describe('Receivables from recorded quote versions and payments', () => {
  it('uses cents and excludes void payments', () =>
    expect(
      receivableAccounts(
        [quote],
        [payment, { ...payment, id: 'p2', amount: 9, status: 'VOIDED' }],
      )[0],
    ).toMatchObject({ responsibility: 10.1, paid: 3.1, balance: 7 }));
  it('does not duplicate sent versions or include unsent revisions', () => {
    const rows = receivableAccounts(
      [
        quote,
        { ...quote, id: 'q2', version: 2, patientAmount: 20 },
        { ...quote, id: 'q3', version: 3, status: 'DRAFT', patientAmount: 99 },
      ],
      [payment],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ quote: { id: 'q2' }, paid: 3.1, balance: 16.9 });
  });
  it('keeps overpayment visible as credit rather than silently dropping it', () =>
    expect(receivableAccounts([quote], [{ ...payment, amount: 20 }])[0].balance).toBe(-9.9));
});
