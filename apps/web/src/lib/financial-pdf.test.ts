import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { Payment, Quote } from '@analiza/contracts';
import { buildPaymentReceiptPdf, buildQuotePdf } from './financial-pdf';

const quote: Quote = {
  id: 'quote-pdf-test',
  caseId: 'case-test',
  patientId: 'patient-test',
  version: 2,
  status: 'SENT',
  summary: 'Cotización sintética de prueba',
  items: [
    {
      id: 'item-test',
      category: 'SERVICES',
      name: 'Servicio sintético',
      quantity: 2,
      unitPrice: 25,
      discountAmount: 0,
    },
  ],
  subtotal: 50,
  discountAmount: 0,
  total: 50,
  insurerAmount: 0,
  patientAmount: 50,
  immutable: true,
  createdAt: '2026-09-28T12:00:00.000Z',
  sentAt: '2026-09-28T12:30:00.000Z',
};

describe('financial PDF documents', () => {
  it('creates a valid PDF only from an immutable sent quote', async () => {
    const bytes = await buildQuotePdf(quote);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(0);
    await expect(buildQuotePdf({ ...quote, status: 'DRAFT', immutable: false })).rejects.toThrow(
      'enviadas e inmutables',
    );
  });

  it('creates a valid non-fiscal payment receipt', async () => {
    const payment: Payment = {
      id: 'payment-test',
      quoteId: quote.id,
      amount: 20,
      reference: 'REF-SINTETICA',
      idempotencyKey: 'payment-test-key',
      status: 'APPLIED',
      createdAt: '2026-09-28T13:00:00.000Z',
    };
    const bytes = await buildPaymentReceiptPdf(payment, quote);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
