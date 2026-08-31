import type { Hospitalization, InsuranceEvent, InsuranceRequest, InventoryMovement, Patient, Quote, QuoteItem } from '@analiza/contracts';
import { describe, expect, it } from 'vitest';
// test-id: vitest:age-from-birth-date
import {
  canRecordMovement,
  currentInventoryBalance,
  deriveKardex,
  findDuplicatePatient,
  maskDui,
  searchPatients,
  searchHospitalizations,
  filterHospitalizations,
  hospitalizationDurationDays,
  toCsv,
  validateDocument,
  calculateQuoteBalance,
  calculateQuoteTotals,
  canEditQuote,
  createQuoteRevision,
  appendInsuranceEvent,
  ageFromBirthDate,
  hasValidInsuranceRequestContext,
  isInsuranceRequestStatus,
  searchInsuranceRequests,
  searchQuotes,
  filterQuotes,
  normalizeQuoteInvoiceMetadata,
  validateQuoteItem,
} from '@analiza/domain';

const patients: Patient[] = [
  { id: 'one', fullName: 'Áurea Demo', documentType: 'DUI', documentId: '12345678-9', status: 'ACTIVE' },
  { id: 'two', fullName: 'Brisa Demo', documentType: 'OTHER', documentId: 'DEMO-2', status: 'ACTIVE' },
];

const hospitalizations: Hospitalization[] = [
  { id: 'HOS-2026-0001', patientId: 'one', startDate: '2026-08-28', status: 'ACTIVE', accountType: 'PARTICULAR' },
  { id: 'HOS-2026-0002', patientId: 'two', startDate: '2026-08-29', status: 'PENDING_CLOSE', accountType: 'EMPRESA' },
];

describe('domain boundaries', () => {
  it('normalizes patient search and document duplicate checks', () => {
    expect(searchPatients(patients, 'aurea')).toHaveLength(1);
    expect(
      findDuplicatePatient(patients, { documentType: 'DUI', documentId: '123456789' })?.id,
    ).toBe('one');
  });

  it('normalizes hospitalization search by case, patient name, and document', () => {
    expect(searchHospitalizations(hospitalizations, patients, 'hos 2026 0001')).toHaveLength(1);
    expect(searchHospitalizations(hospitalizations, patients, 'aurea')).toHaveLength(1);
    expect(searchHospitalizations(hospitalizations, patients, '1234 56789')).toHaveLength(1);
  });

  it('combines hospitalization filters only from the supplied applied values and derives operational duration', () => {
    expect(filterHospitalizations(hospitalizations, { status: 'ACTIVE', startDate: '2026-08-28', accountType: 'PARTICULAR' })).toEqual([hospitalizations[0]]);
    expect(filterHospitalizations(hospitalizations, {}).map((item) => item.id)).toEqual(['HOS-2026-0001', 'HOS-2026-0002']);
    expect(hospitalizationDurationDays({ startDate: '2026-08-28' }, new Date('2026-08-31T12:00:00.000Z'))).toBe(3);
    expect(hospitalizationDurationDays({ startDate: '2026-08-31', endDate: '2026-08-30' })).toBeUndefined();
  });

  it('applies the configured demo DUI mask and error without claiming official validation', () => {
    expect(maskDui('123456789')).toBe('12345678-9');
    expect(validateDocument('DUI', '12345678-9')).toBeUndefined();
    expect(validateDocument('DUI', '123')).toContain('configuración demo');
  });

  it('derives kardex balance chronologically and prevents a negative exit', () => {
    const movements: InventoryMovement[] = [
      {
        id: 'b',
        itemId: 'kit',
        createdAt: '2026-08-28T09:00:00.000Z',
        kind: 'EXIT',
        quantity: 2,
        reason: 'Salida demo',
      },
      {
        id: 'a',
        itemId: 'kit',
        createdAt: '2026-08-28T08:00:00.000Z',
        kind: 'ENTRY',
        quantity: 5,
        reason: 'Entrada demo',
      },
    ];
    expect(deriveKardex(movements, 'kit').map((row) => row.balance)).toEqual([5, 3]);
    expect(currentInventoryBalance(movements, 'kit')).toBe(3);
    expect(
      canRecordMovement(movements, {
        id: 'c',
        itemId: 'kit',
        createdAt: '2026-08-28T10:00:00.000Z',
        kind: 'EXIT',
        quantity: 4,
        reason: 'Exceso demo',
      }),
    ).toBe(false);
  });

  it('escapes generated CSV values', () => {
    expect(toCsv([['valor', 'texto "entre comillas"']])).toBe('"valor","texto ""entre comillas"""');
  });
});

describe('quote domain', () => {
  const items: QuoteItem[] = [
    { id: 'item-1', category: 'SERVICES', name: 'Servicio sintético', quantity: 2, unitPrice: 10.125, discountAmount: 0.25 },
    { id: 'item-2', category: 'STUDIES', name: 'Estudio sintético', quantity: 1, unitPrice: 5, discountAmount: 0 },
  ];
  const quote: Quote = {
    id: 'Q-001', rootQuoteId: 'Q-001', originalQuoteId: 'Q-001', caseId: 'CASE-001', patientId: 'one', version: 1,
    status: 'DRAFT', immutable: false, summary: 'Cotización de prueba', items, subtotal: 25.25, discountAmount: 0.25,
    total: 25, insurerAmount: 5, patientAmount: 20, createdAt: '2026-08-28T08:00:00.000Z',
  };

  it('calculates manual line and general discounts with 2-decimal money', () => {
    const totals = calculateQuoteTotals(items, { type: 'PERCENT', value: 10 }, 5);
    expect(totals).toMatchObject({ subtotal: 25.25, itemDiscountAmount: 0.25, generalDiscountAmount: 2.5, discountAmount: 2.75, total: 22.5, insurerAmount: 5, patientAmount: 17.5 });
    expect(calculateQuoteTotals(items, { type: 'CATEGORY_PERCENTAGES', categories: { SERVICES: 10, STUDIES: 0, MEDICATIONS: 0, SUPPLIES: 0, EQUIPMENT: 0, FEES: 0, EXTRAS: 0 } }).total).toBe(23);
  });

  it('derives administrative age from a valid birth date without timezone drift', () => {
    expect(ageFromBirthDate('1985-04-20', new Date('2026-04-19T12:00:00.000Z'))).toBe(40);
    expect(ageFromBirthDate('1985-04-20', new Date('2026-04-20T12:00:00.000Z'))).toBe(41);
    expect(ageFromBirthDate(undefined, new Date('2026-04-20T12:00:00.000Z'))).toBeUndefined();
    expect(ageFromBirthDate('2026-02-30', new Date('2026-04-20T12:00:00.000Z'))).toBeUndefined();
  });

  it('rejects invalid manual item amounts and insurer amount beyond total', () => {
    expect(validateQuoteItem({ ...items[0], name: ' ', quantity: 0, discountAmount: 999 })).toContain('concepto');
    expect(() => calculateQuoteTotals([{ ...items[0], discountAmount: 99 }], undefined, 0)).toThrow('descuento manual');
    expect(() => calculateQuoteTotals(items, undefined, 99)).toThrow('aseguradora');
  });

  it('uses only applied payments for the patient balance', () => {
    expect(calculateQuoteBalance(quote, [
      { id: 'pay-1', quoteId: 'Q-001', amount: 8, reference: 'REF-1', idempotencyKey: 'key-1', status: 'APPLIED', createdAt: '2026-08-28T09:00:00.000Z' },
      { id: 'pay-2', quoteId: 'Q-001', amount: 3, reference: 'REF-2', idempotencyKey: 'key-2', status: 'VOIDED', createdAt: '2026-08-28T10:00:00.000Z' },
    ])).toEqual({ paid: 8, balance: 12 });
  });

  it('keeps sent versions non-editable and revisions independent', () => {
    expect(canEditQuote(quote)).toBe(true);
    expect(canEditQuote({ ...quote, status: 'SENT', immutable: true })).toBe(false);
    const revision = createQuoteRevision({ ...quote, status: 'SENT', immutable: true }, 'Q-002', 'Ajuste solicitado', '2026-08-29T08:00:00.000Z');
    expect(revision).toMatchObject({ id: 'Q-002', rootQuoteId: 'Q-001', originalQuoteId: 'Q-001', version: 2, status: 'DRAFT', immutable: false, revisionReason: 'Ajuste solicitado' });
    revision.items[0].name = 'Cambio de revisión';
    expect(quote.items[0].name).toBe('Servicio sintético');
  });

  it('searches quote id, patient, case and status with normalized text', () => {
    expect(searchQuotes([quote], patients, 'case 001')).toHaveLength(1);
    expect(searchQuotes([quote], patients, 'áurea')).toHaveLength(1);
    expect(searchQuotes([quote], patients, 'draft')).toHaveLength(1);
  });

  it('filters quote list status and creation date without changing totals', () => {
    expect(filterQuotes([quote], { status: 'DRAFT', createdDate: '2026-08-28' })).toEqual([quote]);
    expect(filterQuotes([quote], { status: 'SENT' })).toEqual([]);
  });

  it('normalizes old quote invoice metadata without assigning financial behavior', () => {
    expect(normalizeQuoteInvoiceMetadata(quote)).toEqual({ invoiceDate: '2026-08-28', discountGroup: 'Regular', referralLabel: undefined, giftCardCode: undefined });
  });

});

describe('insurance domain boundaries', () => {
  const request: InsuranceRequest = {
    id: 'INS-001', quoteId: 'QUOTE-001', patientId: 'one', insurer: 'Aseguradora sintética',
    status: 'SENT_TO_INSURER', createdAt: '2026-08-29T08:00:00.000Z', updatedAt: '2026-08-29T08:00:00.000Z', lastNote: 'Registro inicial sintético.',
  };
  const event: InsuranceEvent = { id: 'INE-001', requestId: 'INS-001', status: 'INFO_REQUIRED', date: '2026-08-29T09:00:00.000Z', note: 'Se documentó una solicitud administrativa.' };

  it('searches insurer, quote, name, document and phone with normalized input', () => {
    const insurancePatients = [{ ...patients[0], phone: '7000-0001' }];
    expect(searchInsuranceRequests([request], insurancePatients, 'quote 001')).toHaveLength(1);
    expect(searchInsuranceRequests([request], insurancePatients, 'áurea')).toHaveLength(1);
    expect(searchInsuranceRequests([request], insurancePatients, '1234 56789')).toHaveLength(1);
    expect(searchInsuranceRequests([request], insurancePatients, '70000001')).toHaveLength(1);
    expect(searchInsuranceRequests([request], insurancePatients, 'aseguradora sintetica')).toHaveLength(1);
  });

  it('accepts only the evidenced administrative status enum', () => {
    expect(isInsuranceRequestStatus('PARTIALLY_APPROVED')).toBe(true);
    expect(isInsuranceRequestStatus('PENDING')).toBe(false);
  });

  it('requires the insurance request to retain the quote and patient relationship', () => {
    const quoteContext: Quote = { id: 'QUOTE-001', caseId: 'CASE-001', patientId: 'one', version: 1, status: 'DRAFT', summary: 'Contexto sintético', items: [], subtotal: 0, discountAmount: 0, total: 0, insurerAmount: 0, patientAmount: 0, immutable: false, createdAt: '2026-08-29T08:00:00.000Z' };
    const insuredPatient = { ...patients[0], insurer: 'Aseguradora sintética' };
    expect(hasValidInsuranceRequestContext(request, [quoteContext], [insuredPatient])).toBe(true);
    expect(hasValidInsuranceRequestContext({ ...request, patientId: 'two' }, [quoteContext], [insuredPatient])).toBe(false);
  });

  it('appends an observed event without rewriting history or related records', () => {
    const result = appendInsuranceEvent(request, [], event);
    expect(result.request).toMatchObject({ status: 'INFO_REQUIRED', lastNote: event.note, updatedAt: event.date });
    expect(result.events).toEqual([event]);
    expect(request.status).toBe('SENT_TO_INSURER');
    expect(() => appendInsuranceEvent(request, [event], event)).toThrow('ya existe');
    expect(() => appendInsuranceEvent(request, [], { ...event, requestId: 'INS-OTHER' })).toThrow('no es válida');
  });
});
