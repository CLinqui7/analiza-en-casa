import { describe, expect, it } from 'vitest';
import {
  clinicalPayloadSchema,
  clinicalRecordInputSchema,
  clinicalScales,
  currentClinicalRecords,
  fluidTotals,
  scaleDefinitionSchema,
  scoreScale,
  type ClinicalRecord,
} from '@analiza/contracts';
import { caseQuotes } from './clinical-queries';
import {
  medicationReturns,
  quoteMedications,
} from '@/server/persistence/postgres-clinical-records';
import { quoteSchema, hospitalizationSchema } from '@analiza/contracts';

describe('client clinical annex score arithmetic', () => {
  // test-id: vitest:clinical-annex-scores
  const limits: Record<string, [number, number] | null> = {
    EVA: [0, 10],
    GLASGOW: [3, 15],
    RAMSAY: [1, 6],
    ECOG: [0, 4],
    ESAS: null,
    KARNOFSKY: [0, 100],
    DOWNTON: [0, 5],
    BRADEN: [6, 23],
    NORTON: [5, 20],
    BARTHEL: [0, 100],
  };
  for (const definition of clinicalScales) {
    it(`${definition.id}: validates supplied definition, boundaries and missing selections`, () => {
      expect(scaleDefinitionSchema.safeParse(definition).success).toBe(true);
      const low = Object.fromEntries(
        definition.items.map((item) => [
          item.id,
          Math.min(...item.options.map((option) => option.score)),
        ]),
      );
      const high = Object.fromEntries(
        definition.items.map((item) => [
          item.id,
          Math.max(...item.options.map((option) => option.score)),
        ]),
      );
      expect(scoreScale(definition, low)).toBe(limits[definition.id]?.[0] ?? null);
      expect(scoreScale(definition, high)).toBe(limits[definition.id]?.[1] ?? null);
      expect(() => scoreScale(definition, {})).toThrow();
      expect(() => scoreScale(definition, { ...low, [definition.items[0].id]: -1 })).toThrow();
      expect(() => scoreScale(definition, { ...low, injected: 10 })).toThrow();
    });
  }
  it('rejects duplicate answer scores or identifiers in a user definition', () => {
    const source = clinicalScales[0];
    expect(
      scaleDefinitionSchema.safeParse({
        ...source,
        items: [
          {
            ...source.items[0],
            options: [
              { label: 'A', score: 1 },
              { label: 'B', score: 1 },
            ],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      scaleDefinitionSchema.safeParse({
        ...source,
        aggregation: 'SUM',
        items: [source.items[0], source.items[0]],
      }).success,
    ).toBe(false);
  });
});

describe('clinical record input and downstream integrity', () => {
  // test-id: vitest:clinical-observations-care-plan
  it('supports combined care plans without losing legacy records or accepting empty selections', () => {
    expect(
      clinicalPayloadSchema.safeParse({ kind: 'CARE_PLAN', plan: 'DIET', summary: 'QA' }).success,
    ).toBe(true);
    expect(
      clinicalPayloadSchema.safeParse({
        kind: 'CARE_PLAN',
        plans: ['DIET', 'NURSING', 'LABORATORY'],
        summary: 'QA',
      }).success,
    ).toBe(true);
    for (const plans of [[], ['DIET', 'DIET']])
      expect(
        clinicalPayloadSchema.safeParse({ kind: 'CARE_PLAN', plans, summary: 'QA' }).success,
      ).toBe(false);
    expect(
      clinicalPayloadSchema.safeParse({
        kind: 'CARE_PLAN',
        plans: ['DIET', 'LABORATORY'],
        summary: '',
      }).success,
    ).toBe(false);
    expect(
      clinicalPayloadSchema.safeParse({ kind: 'CARE_PLAN', plans: ['LABORATORY'], summary: '' })
        .success,
    ).toBe(true);
  });
  // test-id: vitest:clinical-record-boundaries
  it('sums recorded volumes without deriving weight-based fluids or extrapolating', () => {
    const payload = clinicalPayloadSchema.parse({
      kind: 'FLUID_BALANCE',
      diagnosis: 'QA',
      weight: '70 kg',
      rows: Array.from({ length: 6 }, (_, i) => ({
        time: String(i),
        values: [10, 20, 30, 40, 5, 10, 15, 20, 25],
      })),
      endogenous: 50,
      insensible: 25,
      hours: 12,
      notes: '',
    });
    if (payload.kind !== 'FLUID_BALANCE') throw Error();
    expect(fluidTotals(payload)).toEqual({ intake: 650, output: 475, balance: 175 });
    expect(
      clinicalPayloadSchema.safeParse({ ...payload, rows: payload.rows.slice(1) }).success,
    ).toBe(false);
    expect(clinicalPayloadSchema.safeParse({ ...payload, endogenous: -1 }).success).toBe(false);
  });
  it('requires reasons, rejects spoofed author and JVPE and prevents empty corrections', () => {
    const base = {
      id: 'qa',
      patientId: 'patient',
      caseId: 'case',
      date: '2026-11-03',
      payload: { kind: 'NURSING_NOTE', rows: [{ time: '08:00', note: 'Synthetic observation' }] },
    };
    expect(clinicalRecordInputSchema.safeParse(base).success).toBe(true);
    for (const extra of [{ createdBy: 'other' }, { jvpe: 'fake' }, { correctionOf: 'prior' }])
      expect(clinicalRecordInputSchema.safeParse({ ...base, ...extra }).success).toBe(false);
    expect(
      clinicalPayloadSchema.safeParse({
        kind: 'ADMINISTRATION',
        cardId: 'card',
        time: '08:00',
        dose: 'manually entered',
        presentation: 'Tableta',
        route: 'Oral',
        items: [{ medicationId: 'qa', applied: false, reason: '' }],
      }).success,
    ).toBe(false);
  });
  it('keeps only uncorrected records and excludes chronic/non-returned medicines from finance', () => {
    const original = {
      id: 'one',
      rootId: 'one',
      patientId: 'patient',
      caseId: 'case',
      date: '2026-11-03',
      createdBy: 'user',
      createdAt: '2026-11-03T08:00:00Z',
      author: 'Synthetic',
      version: 1,
      payload: { kind: 'NURSING_NOTE', rows: [{ time: '08:00', note: 'one' }] },
    } satisfies ClinicalRecord;
    const corrected = {
      ...original,
      id: 'two',
      correctionOf: 'one',
      correctionReason: 'Typo',
      version: 2,
    };
    expect(currentClinicalRecords([original, corrected]).map((record) => record.id)).toEqual([
      'two',
    ]);
    const administration: ClinicalRecord = {
      ...original,
      id: 'administration',
      payload: {
        kind: 'ADMINISTRATION',
        cardId: 'card',
        time: '08:00',
        dose: 'QA',
        presentation: 'Tableta',
        route: 'Oral',
        items: [
          { medicationId: 'quoted', applied: false, reason: 'No aplicado' },
          { medicationId: 'chronic', applied: false, reason: 'No aplicado' },
          { medicationId: 'given', applied: true, reason: '' },
        ],
      },
      medications: [
        { id: 'quoted', name: 'QA medicine', chronic: false, quoteId: 'q', quoteItemId: 'i' },
        { id: 'chronic', name: 'QA chronic', chronic: true },
        { id: 'given', name: 'QA applied', chronic: false, quoteId: 'q', quoteItemId: 'i2' },
      ],
    };
    expect(medicationReturns([administration])).toEqual([
      {
        id: 'administration:quoted',
        patientId: 'patient',
        caseId: 'case',
        date: '2026-11-03',
        quoteId: 'q',
        medication: 'QA medicine',
        reason: 'No aplicado',
      },
    ]);
  });
  it('uses current quote versions and never borrows another hospitalization medicines', () => {
    const old = quoteSchema.parse({
      id: 'q',
      summary: 'Synthetic QA',
      patientId: 'p',
      caseId: 'c',
      version: 1,
      status: 'SENT',
      createdAt: '2026-11-03',
      items: [{ id: 'i', category: 'MEDICATIONS', name: 'QA old', quantity: 1, unitPrice: 0 }],
    });
    const next = {
      ...old,
      id: 'q2',
      rootQuoteId: 'q',
      version: 2,
      items: [{ ...old.items[0], name: 'QA revised' }],
    };
    const other = { ...old, id: 'q3', caseId: 'other' };
    const hospitalization = hospitalizationSchema.parse({
      id: 'c',
      patientId: 'p',
      startDate: '2026-11-03',
      status: 'ACTIVE',
      accountType: 'PARTICULAR',
      priority: 'MEDIUM',
    });
    expect(caseQuotes([old, next, other], hospitalization).map((quote) => quote.id)).toEqual([
      'q2',
    ]);
    expect(quoteMedications(caseQuotes([old, next, other], hospitalization))[0].name).toBe(
      'QA revised',
    );
  });
});
