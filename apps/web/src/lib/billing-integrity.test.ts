import { describe, expect, it } from 'vitest';
import { paymentInputSchema, paymentSchema, quoteSchema } from '@analiza/contracts';
import {
  calculateQuoteBalance,
  hasSameQuoteVersionIdentity,
  insurerForQuote,
} from '@analiza/domain';

const payment = {
  id: 'p',
  quoteId: 'q',
  amount: 1,
  status: 'APPLIED',
  idempotencyKey: 'payment-key',
  createdAt: '2026-11-04T00:00:00Z',
};
const quote = quoteSchema.parse({
  id: 'q',
  patientId: 'synthetic',
  version: 1,
  status: 'DRAFT',
  summary: 'QA',
  createdAt: '2026-11-04',
  patientAmount: 100,
});
describe('Billing precision and immutable version identity', () => {
  it.each([0, -1, 0.001, 0.014, 0.015, 1.999, Infinity, NaN])(
    'rejects invalid new payment %s',
    (amount) => {
      expect(paymentInputSchema.safeParse({ ...payment, amount }).success).toBe(false);
    },
  );
  it.each([0.01, 0.29, 1, 123.45, 99.99])('accepts valid cents %s', (amount) => {
    expect(paymentInputSchema.safeParse({ ...payment, amount }).success).toBe(true);
  });
  it('requires reservation references for checks', () => {
    expect(paymentInputSchema.safeParse({ ...payment, paymentMethod: 'CHECK' }).success).toBe(
      false,
    );
    expect(
      paymentInputSchema.safeParse({ ...payment, paymentMethod: 'CHECK', reference: 'RES-QA' })
        .success,
    ).toBe(true);
  });
  it('keeps historical payments readable and reconciles each amount with ledger cents', () => {
    const legacy = paymentSchema.parse({ ...payment, amount: 0.014 });
    expect(calculateQuoteBalance(quote, [legacy, { ...legacy, id: 'p2' }])).toMatchObject({
      paid: 0.02,
      balance: 99.98,
    });
  });
  it.each([
    'patientId',
    'caseId',
    'version',
    'rootQuoteId',
    'originalQuoteId',
    'createdAt',
  ] as const)('rejects replacing version identity %s', (key) => {
    expect(
      hasSameQuoteVersionIdentity(quote, { ...quote, [key]: key === 'version' ? 2 : 'changed' }),
    ).toBe(false);
  });
  it('allows ordinary draft edits', () => {
    expect(hasSameQuoteVersionIdentity(quote, { ...quote, summary: 'Editada', total: 20 })).toBe(
      true,
    );
  });
});
describe('Insurance follows the payer of the quote', () => {
  const patient = { insurer: 'Aseguradora anterior QA' };
  it('prefers the quote insurer over the current patient profile', () => {
    expect(
      insurerForQuote({ accountType: 'SEGURO', insurer: 'Nueva aseguradora QA' }, patient),
    ).toBe('Nueva aseguradora QA');
  });
  it.each(['PARTICULAR', 'EMPRESA'] as const)(
    'excludes explicit %s accounts even when the patient has insurance',
    (accountType) => {
      expect(insurerForQuote({ accountType, insurer: 'QA' }, patient)).toBeUndefined();
    },
  );
  it.each(['Particular', 'SIN SEGURO', 'Ninguna', 'No aplica', 'Sin aseguradora'])(
    'excludes placeholder %s',
    (insurer) => {
      expect(insurerForQuote(undefined, { insurer })).toBeUndefined();
    },
  );
  it('preserves legacy patient insurer fallback', () => {
    expect(insurerForQuote(undefined, patient)).toBe(patient.insurer);
  });
});
