import { describe, it, expect } from 'vitest';
import { doctorSchema } from '@analiza/contracts';
import {
  directoryHeaders,
  planDoctorDirectory,
  directoryHash,
  doctorSnapshotHash,
} from './doctor-directory-import';
import { parseDoctorCreate, parseDoctorReplace } from './validation/doctors';

const empty = { organizationId: 'qa-directory', doctors: [] };
const row = (id: number, extra: Record<number, string | number | null> = {}) =>
  [
    id,
    `Profesional sintético ${id}`,
    'Especialidad de prueba',
    id + 1000,
    null,
    '2222-0000',
    '7777-0000',
    `Clínica ${id}`,
    'Dirección sintética',
    'Ciudad QA',
    'Departamento QA',
    `qa-${id}@example.test`,
  ].map((v, i) => (i in extra ? extra[i] : v));
const source = (rows: ReturnType<typeof row>[]) => ({
  sha256: 'a'.repeat(64),
  sheet: 'Medicos QA',
  rows: [directoryHeaders, ...rows],
});
describe('historical doctor directory with explicit provenance', () => {
  it('plans 700 synthetic physicians and never invents referral categories', () => {
    const input = source(Array.from({ length: 700 }, (_, i) => row(i)));
    const plan = planDoctorDirectory(input, empty, { allowIncompleteHistorical: true });
    expect(plan.summary).toMatchObject({
      sourceRows: 700,
      insert: 700,
      enrich: 0,
      heldRows: 0,
      incompleteProfiles: 700,
    });
    expect(plan.actions.every((a) => !a.doctor.referralCategory)).toBe(true);
    expect(
      planDoctorDirectory(input, empty, { allowIncompleteHistorical: false }).summary.heldRows,
    ).toBe(700);
    expect(planDoctorDirectory(input, empty, { allowIncompleteHistorical: true })).toEqual(plan);
  });
  it('consolidates the same physician while preserving each practice and every source row', () => {
    const plan = planDoctorDirectory(
      source([
        row(1),
        row(2, {
          1: 'Profesional sintético 1',
          3: 1001,
          7: 'Otra clínica',
          8: 'Otra dirección',
          11: 'otra@example.test',
        }),
        row(3, {
          1: 'Profesional sintético 1',
          3: 1001,
          7: 'Otra clínica',
          8: 'Otra dirección',
          11: 'otra@example.test',
        }),
      ]),
      empty,
      { allowIncompleteHistorical: true },
    );
    expect(plan.summary).toMatchObject({ sourceRows: 3, insert: 1, consolidatedRows: 2 });
    expect(plan.actions[0].doctor.practiceLocations).toHaveLength(2);
    expect(plan.actions[0].doctor.practiceLocations?.[1].email).toBe('otra@example.test');
    expect(plan.records.map((r) => r.sourceId)).toEqual(['1', '2', '3']);
    expect(plan.actions[0].sourceRows).toEqual([2, 3, 4]);
  });
  it('holds conflicting professional IDs and names without a corroborating identifier', () => {
    const differentIds = planDoctorDirectory(
      source([row(1), row(2, { 1: 'Profesional sintético 1' })]),
      empty,
      { allowIncompleteHistorical: true },
    );
    expect(differentIds.summary.heldRows).toBe(2);
    const sameId = planDoctorDirectory(source([row(1), row(2, { 3: 1001 })]), empty, {
      allowIncompleteHistorical: true,
    });
    expect(sameId.summary.heldRows).toBe(2);
    const nameOnly = planDoctorDirectory(
      source([
        row(1, { 3: null, 6: null, 11: null }),
        row(2, { 1: 'Profesional sintético 1', 3: null, 6: null, 11: null }),
      ]),
      empty,
      { allowIncompleteHistorical: true },
    );
    expect(nameOnly.summary.heldRows).toBe(2);
  });
  it('keeps source placement when an identifier appears as JVPM and CONADEM', () => {
    const plan = planDoctorDirectory(
      source([
        row(1, { 3: 'A123' }),
        row(2, { 1: 'Profesional sintético 1', 3: null, 4: 'A123', 11: 'qa-1@example.test' }),
      ]),
      empty,
      { allowIncompleteHistorical: true },
    );
    expect(plan.summary.heldRows).toBe(0);
    expect(plan.actions[0].doctor).toMatchObject({ jvpm: 'A123', conadem: 'A123' });
    expect(plan.actions[0].warnings).toContain(
      'MISMO_IDENTIFICADOR_EN_JVPM_Y_CONADEM_REVISAR_FUENTE',
    );
  });
  it('enriches a confirmed existing person without replacing fields, ID, attachments or category', () => {
    const existing = doctorSchema.parse({
      id: 'qa-existing',
      fullName: 'Profesional sintético 1',
      specialty: 'Especialidad existente',
      jvpm: '1001',
      referralCategory: 'RECURRENT',
      phone: 'otro contacto',
      email: 'anterior@example.test',
      attachments: [],
    });
    const snapshot = {
      organizationId: empty.organizationId,
      doctors: [{ doctor: existing, version: 7 }],
    };
    const plan = planDoctorDirectory(source([row(1)]), snapshot, {
      allowIncompleteHistorical: true,
    });
    expect(plan.summary.enrich).toBe(1);
    expect(plan.actions[0].doctor).toMatchObject(existing);
    expect(plan.actions[0].expectedVersion).toBe(7);
    expect(plan.actions[0].doctor.practiceLocations?.[0].email).toBe('qa-1@example.test');
    expect(snapshot.doctors[0].doctor.practiceLocations).toBeUndefined();
    expect(doctorSnapshotHash(snapshot)).not.toBe(
      doctorSnapshotHash({ ...snapshot, doctors: [{ doctor: existing, version: 8 }] }),
    );
    const noChanges = planDoctorDirectory(
      source([row(1)]),
      {
        organizationId: empty.organizationId,
        doctors: [{ doctor: plan.actions[0].doctor, version: 8 }],
      },
      { allowIncompleteHistorical: true },
    );
    expect(noChanges.summary.unchanged).toBe(1);
  });
  it('allows a historical name/contact match but holds ambiguous existing matches', () => {
    const doctor = doctorSchema.parse({
      id: 'qa-1',
      fullName: 'Profesional sintético 1',
      specialty: 'QA',
      phone: '7777-0000',
    });
    expect(
      planDoctorDirectory(
        source([row(1)]),
        { organizationId: empty.organizationId, doctors: [{ doctor, version: 1 }] },
        { allowIncompleteHistorical: true },
      ).summary.enrich,
    ).toBe(1);
    expect(
      planDoctorDirectory(
        source([row(1)]),
        {
          organizationId: empty.organizationId,
          doctors: [
            { doctor, version: 1 },
            { doctor: { ...doctor, id: 'qa-2' }, version: 1 },
          ],
        },
        { allowIncompleteHistorical: true },
      ).summary.heldRows,
    ).toBe(1);
  });
  it('does not relax interactive doctor saves and keeps additional practices after editing', () => {
    const doctor = planDoctorDirectory(source([row(1, { 5: null })]), empty, {
      allowIncompleteHistorical: true,
    }).actions[0].doctor;
    expect(() => parseDoctorCreate({ doctor })).toThrow();
    expect(() => parseDoctorReplace({ doctor, expectedVersion: 1 })).toThrow();
    const edited = { ...doctor, landlinePhone: '2222-3333', referralCategory: 'NEW' };
    expect(
      parseDoctorReplace({ doctor: edited, expectedVersion: 1 }).doctor.practiceLocations,
    ).toEqual(doctor.practiceLocations);
  });
  it('rejects missing names, duplicate source IDs, unknown headers and lossy numeric values', () => {
    expect(() =>
      planDoctorDirectory(source([row(1, { 1: '' })]), empty, { allowIncompleteHistorical: true }),
    ).toThrow();
    expect(() =>
      planDoctorDirectory(source([row(1), row(1)]), empty, { allowIncompleteHistorical: true }),
    ).toThrow();
    expect(() =>
      planDoctorDirectory({ ...source([row(1)]), rows: [['unexpected'], row(1)] }, empty, {
        allowIncompleteHistorical: true,
      }),
    ).toThrow();
    expect(() =>
      planDoctorDirectory(source([row(1, { 3: 1.5 })]), empty, { allowIncompleteHistorical: true }),
    ).toThrow();
    expect(directoryHash({ b: 2, a: 1 })).toBe(directoryHash({ a: 1, b: 2 }));
  });
});
