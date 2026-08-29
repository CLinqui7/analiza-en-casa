import type { Hospitalization, InventoryMovement, Patient } from '@analiza/contracts';
import { describe, expect, it } from 'vitest';
import {
  canRecordMovement,
  currentInventoryBalance,
  deriveKardex,
  findDuplicatePatient,
  maskDui,
  searchPatients,
  searchHospitalizations,
  toCsv,
  validateDocument,
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
