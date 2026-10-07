import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import type { Patient, Payment, Quote } from '@analiza/contracts';
import {
  buildPatientStatementPdf,
  buildPaymentReceiptPdf,
  buildQuotePdf,
  quotePdfPresentation,
} from './financial-pdf';

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
  it('uses a date without time, factual payment condition, amount in words and shorter footer', () => {
    const presentation = quotePdfPresentation({
      ...quote,
      paymentCondition: 'Pago acordado al recibir',
    });
    expect(presentation.sentDate).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
    expect(presentation.paymentCondition).toBe('Pago acordado al recibir');
    expect(presentation.amountInWords).toBe('CINCUENTA DÓLARES CON CERO CENTAVOS');
    expect(presentation.footer).toBe(
      'Documento generado para consulta interna autorizada. No contiene reglas fiscales.',
    );
    expect(quotePdfPresentation(quote).paymentCondition).toBe('No especificada');
  });
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

  it('includes the brand and paginates every item in a long sent quote', async () => {
    const logo = new Uint8Array(
      await readFile(new URL('../../public/brand/analiza-en-casa-logo.png', import.meta.url)),
    );
    const longQuote: Quote = {
      ...quote,
      items: Array.from({ length: 90 }, (_, index) => ({
        ...quote.items[0],
        id: `line-${index}`,
        name: `Servicio sintético de prueba ${index + 1}`,
      })),
    };
    const bytes = await buildQuotePdf(longQuote, undefined, logo);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });

  it('builds one patient statement from their own charges and applied payments', async () => {
    const patient = {
      id: 'patient-test',
      fullName: 'Paciente QA',
      documentId: '00000000-0',
    } as Patient;
    const payments: Payment[] = [
      {
        id: 'payment-test',
        quoteId: quote.id,
        amount: 20,
        idempotencyKey: 'patient-statement-test',
        status: 'APPLIED',
        createdAt: '2026-09-28T13:00:00.000Z',
      },
    ];
    const bytes = await buildPatientStatementPdf(
      patient,
      [{ quote, responsibility: 50, paid: 20, balance: 30 }],
      payments,
      [quote],
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
