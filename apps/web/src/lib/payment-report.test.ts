import { describe, expect, it } from 'vitest';
import type { Patient, Payment, Quote } from '@analiza/contracts';
import { paymentLocalDate, paymentReportCsv, paymentReportRows } from './payment-report';

const patients = [{ id: 'patient-1', fullName: 'Paciente Sintético' }] as Patient[];
const quotes = [{ id: 'quote-1', patientId: 'patient-1' }] as Quote[];
const payments: Payment[] = [
  {
    id: 'payment-1',
    quoteId: 'quote-1',
    amount: 25.5,
    paymentMethod: 'TRANSFER',
    reference: 'REF-1',
    idempotencyKey: 'key-1',
    status: 'APPLIED',
    createdAt: '2026-10-28T01:00:00.000Z',
  },
  {
    id: 'payment-2',
    quoteId: 'quote-1',
    amount: 10,
    paymentMethod: 'CASH',
    reference: '=HYPERLINK("https://example.test")',
    idempotencyKey: 'key-2',
    status: 'VOIDED',
    voidReason: 'Corrección sintética',
    createdAt: '2026-10-28T15:00:00.000Z',
  },
];

describe('payment report', () => {
  it('lists all reported payments including reversals, newest first', () => {
    const rows = paymentReportRows(payments, quotes, patients, {
      query: '',
      status: 'ALL',
      from: '',
      to: '',
    });
    expect(rows.map((row) => row.payment.id)).toEqual(['payment-2', 'payment-1']);
    expect(rows[0].patientName).toBe('Paciente Sintético');
  });

  it('uses local Salvador dates and combines search, status and date filters', () => {
    expect(paymentLocalDate(payments[0].createdAt)).toBe('2026-10-27');
    const rows = paymentReportRows(payments, quotes, patients, {
      query: 'REF-1',
      status: 'APPLIED',
      from: '2026-10-27',
      to: '2026-10-27',
    });
    expect(rows.map((row) => row.payment.id)).toEqual(['payment-1']);
    expect(
      paymentReportRows(payments, quotes, patients, {
        query: '',
        status: 'VOIDED',
        from: '2026-10-27',
        to: '2026-10-27',
      }),
    ).toEqual([]);
  });

  it('exports every visible row and neutralizes spreadsheet formulas in references', () => {
    const rows = paymentReportRows(payments, quotes, patients, {
      query: '',
      status: 'ALL',
      from: '',
      to: '',
    });
    const csv = paymentReportCsv(rows);
    expect(csv).toContain('"Reversado"');
    expect(csv).toContain('"Aplicado"');
    expect(csv).toContain('"\'=HYPERLINK(');
    expect(csv).toContain('"Corrección sintética"');
  });
});
