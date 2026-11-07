import { describe, expect, it } from 'vitest';
import {
  clinicalPayloadSchema,
  configurationEntrySchema,
  medicationApplicationKey,
  medicationApplications,
  type ClinicalRecord,
} from '@analiza/contracts';
import { medicationReturns } from '@/server/persistence/postgres-clinical-records';

const medication = {
  id: 'q:med',
  name: 'Medicamento sintético',
  chronic: false,
  quoteId: 'q',
  quoteItemId: 'med',
  inventoryItemId: 'inventory',
  applicationTimes: ['08:00', '16:00'],
  dilution: 'Texto indicado por el equipo',
};
const card: ClinicalRecord = {
  id: 'card',
  rootId: 'card',
  version: 1,
  patientId: 'patient',
  caseId: 'case',
  date: '2026-11-07',
  createdAt: '2026-11-07T12:00:00Z',
  createdBy: 'nurse',
  author: 'Enfermera QA',
  payload: {
    kind: 'MEDICATION_CARD',
    chronic: '',
    instructions: '',
    stock: [],
    schedule: [
      {
        medicationId: medication.id,
        times: medication.applicationTimes,
        dilution: medication.dilution,
      },
    ],
  },
  medications: [medication],
};
const administration = {
  kind: 'ADMINISTRATION' as const,
  cardId: card.id,
  time: '08:05',
  dose: 'Captura sintética',
  presentation: 'Tableta' as const,
  route: 'Oral' as const,
  items: [
    { medicationId: medication.id, scheduledTime: '08:00', applied: true, reason: '' },
    {
      medicationId: medication.id,
      scheduledTime: '16:00',
      applied: false,
      reason: 'Motivo sintético',
    },
  ],
};

describe('November 7 clinical schedules and reusable consumption rules', () => {
  it('preserves all explicitly supplied hours and dilution without clinical inference', () => {
    expect(clinicalPayloadSchema.parse(card.payload)).toEqual(card.payload);
    expect(medicationApplications(card).map((i) => i.scheduledTime)).toEqual(['08:00', '16:00']);
    expect(clinicalPayloadSchema.parse(administration)).toEqual(administration);
  });
  it('rejects duplicate or invalid hours and duplicate medication schedule entries', () => {
    for (const times of [['08:00', '08:00'], ['24:00'], ['8:00']])
      expect(
        clinicalPayloadSchema.safeParse({
          ...card.payload,
          schedule: [{ medicationId: medication.id, times, dilution: '' }],
        }).success,
      ).toBe(false);
    const schedule = { medicationId: medication.id, times: ['08:00'], dilution: '' };
    expect(
      clinicalPayloadSchema.safeParse({ ...card.payload, schedule: [schedule, schedule] }).success,
    ).toBe(false);
  });
  it('distinguishes repeated medicines by time but rejects duplicate occurrences', () => {
    expect(new Set(administration.items.map(medicationApplicationKey)).size).toBe(2);
    expect(
      clinicalPayloadSchema.safeParse({
        ...administration,
        items: [administration.items[0], administration.items[0]],
      }).success,
    ).toBe(false);
    expect(
      clinicalPayloadSchema.safeParse({
        ...administration,
        items: [{ ...administration.items[1], reason: '' }],
      }).success,
    ).toBe(false);
  });
  it('keeps historical cards and unscheduled administration parseable', () => {
    const historical = {
      ...card,
      payload: {
        kind: 'MEDICATION_CARD' as const,
        chronic: '',
        instructions: 'Indicación anterior',
        stock: [],
      },
      medications: [{ ...medication, applicationTimes: undefined }],
    };
    expect(clinicalPayloadSchema.safeParse(historical.payload).success).toBe(true);
    expect(medicationApplications(historical)).toHaveLength(1);
    expect(medicationApplicationKey(medicationApplications(historical)[0])).toBe(medication.id);
    expect(
      clinicalPayloadSchema.safeParse({
        ...administration,
        items: [{ medicationId: medication.id, applied: true, reason: '' }],
      }).success,
    ).toBe(true);
  });
  it('keeps omitted applications separate in returns without changing original versions', () => {
    const record: ClinicalRecord = {
      ...card,
      id: 'admin',
      payload: {
        ...administration,
        items: administration.items.map((i) => ({ ...i, applied: false, reason: 'Motivo QA' })),
      },
    };
    const returns = medicationReturns([record]);
    expect(returns).toHaveLength(2);
    expect(new Set(returns.map((r) => r.id)).size).toBe(2);
    expect(returns[0].medication).toContain('08:00');
    expect(returns[1].medication).toContain('16:00');
  });
  it('requires an explicit inventory item, warehouse and positive integral consumption', () => {
    const entry = {
      id: 'rule',
      category: 'MEDICATION_STOCK',
      label: 'QA',
      active: true,
      inventoryItemId: 'item',
      warehouseId: 'warehouse',
      unitsPerApplication: 2,
    };
    expect(configurationEntrySchema.safeParse(entry).success).toBe(true);
    for (const unitsPerApplication of [0, -1, 0.5, undefined])
      expect(configurationEntrySchema.safeParse({ ...entry, unitsPerApplication }).success).toBe(
        false,
      );
    expect(configurationEntrySchema.safeParse({ ...entry, warehouseId: undefined }).success).toBe(
      false,
    );
    expect(
      configurationEntrySchema.safeParse({ ...entry, inventoryItemId: undefined }).success,
    ).toBe(false);
  });
});
