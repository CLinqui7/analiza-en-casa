import { describe, it, expect } from 'vitest';
import { searchQuotes, quoteDisplayCode } from '@analiza/domain';
import { patientSchema, quoteSchema } from '@analiza/contracts';
import { latestLogicalQuotes, quoteRoot, quoteWorkflowStatus } from './quote-workflow';
import { parseUpload } from '@/server/validation/files';
import { parseQuoteCreate } from '@/server/mongo-quotes';
import { assignSupplySchema, deliverOrderSchema } from './quote-fulfillment';

const dependent = {
  id: 'd8bfd3af-ce84-4d09-a6f9-ecff919cf435',
  firstNames: 'Hija',
  lastNames: 'Sintética',
  gender: 'F',
  birthDate: '2020-02-29',
};
const patient = {
  id: 'qa-parent',
  fullName: 'Paciente sintético',
  documentType: 'OTHER',
  documentId: 'QA-17',
};
const quote = quoteSchema.parse({
  id: 'qa-root',
  rootQuoteId: 'qa-root',
  patientId: 'qa-parent',
  version: 1,
  status: 'SENT',
  immutable: true,
  summary: 'QA',
  createdAt: '2026-11-17T10:00:00Z',
  items: [],
});
describe('Nov17 client workflow invariants', () => {
  it('keeps dependents optional for historical patients and validates several children independently', () => {
    expect(patientSchema.parse(patient).dependents).toBeUndefined();
    expect(
      patientSchema.parse({
        ...patient,
        dependents: [
          dependent,
          {
            ...dependent,
            id: '20d09fc1-9711-4fcb-8ff0-ff1ff4686a2c',
            firstNames: 'Hijo',
            gender: 'M',
          },
        ],
      }).dependents,
    ).toHaveLength(2);
    expect(
      patientSchema.safeParse({ ...patient, dependents: [dependent, dependent] }).success,
    ).toBe(false);
    expect(
      patientSchema.safeParse({
        ...patient,
        dependents: [{ ...dependent, birthDate: '2026-02-30' }],
      }).success,
    ).toBe(false);
  });
  it('requires a matching dependent/document-kind pair on private patient uploads', () => {
    const file = {
      ownerType: 'patient' as const,
      ownerId: patient.id,
      name: 'qa.pdf',
      mimeType: 'application/pdf',
      bytes: new Uint8Array([1]),
      dependentId: dependent.id,
      documentKind: 'CONSENT' as const,
    };
    expect(parseUpload(file).dependentId).toBe(dependent.id);
    expect(() => parseUpload({ ...file, ownerType: 'doctor' })).toThrow();
    expect(() => parseUpload({ ...file, documentKind: undefined })).toThrow();
    expect(() => parseUpload({ ...file, dependentId: undefined })).toThrow();
  });
  it('shows one logical quote while retaining snapshots and closed family decisions', () => {
    const revised = { ...quote, id: 'qa-revision', version: 2, total: 30 };
    const list = latestLogicalQuotes([quote, revised]);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(revised.id);
    expect(quoteRoot(list[0])).toBe(quote.id);
    expect(searchQuotes(list, [], quoteDisplayCode(quote.id))).toHaveLength(1);
    expect(
      quoteWorkflowStatus(
        revised,
        [quote, revised],
        [
          {
            id: dependent.id,
            quoteId: quote.id,
            decision: 'APPROVED',
            reason: null,
            createdAt: quote.createdAt,
          },
        ],
      ),
    ).toBe('APPROVED');
    expect(quote.immutable).toBe(true);
    expect(quote.version).toBe(1);
  });
  it('rejects duplicate line identity rather than allowing ambiguous deliveries', () => {
    const line = {
      id: 'same-line',
      category: 'SUPPLIES',
      name: 'Insumo QA',
      quantity: 1,
      unitPrice: 1,
    };
    expect(() =>
      parseQuoteCreate({
        quote: { ...quote, status: 'DRAFT', immutable: false, items: [line, line] },
      }),
    ).toThrow();
  });
  it('requires confirmed price/version and bounded authority for fulfillment commands', () => {
    const assignment = {
      idempotencyKey: dependent.id,
      requestId: 'qa-r',
      quoteId: 'qa-q',
      expectedRecordVersion: 1,
      expectedUnitPrice: 0,
    };
    expect(assignSupplySchema.safeParse(assignment).success).toBe(true);
    const approvedExtension = {
      decisionId: dependent.id,
      reason: 'Insumos adicionales solicitados',
    };
    expect(assignSupplySchema.safeParse({ ...assignment, approvedExtension }).success).toBe(true);
    for (const invalid of [
      { ...approvedExtension, reason: ' ' },
      { ...approvedExtension, decisionId: 'foreign' },
      { ...approvedExtension, reason: 'x'.repeat(1001) },
    ]) {
      expect(
        assignSupplySchema.safeParse({ ...assignment, approvedExtension: invalid }).success,
      ).toBe(false);
    }
    expect(
      assignSupplySchema.safeParse({ ...assignment, expectedUnitPrice: undefined }).success,
    ).toBe(false);
    expect(assignSupplySchema.safeParse({ ...assignment, organizationId: 'foreign' }).success).toBe(
      false,
    );
    expect(
      deliverOrderSchema.safeParse({
        idempotencyKey: dependent.id,
        quoteId: 'qa-q',
        lineId: 'qa-line',
        nursingResourceId: '',
        quantity: 1,
      }).success,
    ).toBe(false);
  });
});
