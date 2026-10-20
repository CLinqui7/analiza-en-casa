import { describe, expect, it, vi } from 'vitest';
import type { Doctor, Hospitalization } from '@analiza/contracts';
import { MongoDoctorRepository } from './mongo-doctors';
import { MongoHospitalizationRepository } from './mongo-hospitalizations';
import { MongoConflictError, MongoInputError, type ServerActor } from './mongo-patients';

const administrator: ServerActor = { userId: 'admin-a', organizationId: 'org-a', role: 'ADMIN' };
const otherOrganization: ServerActor = {
  userId: 'admin-c',
  organizationId: 'org-c',
  role: 'ADMIN',
};
const doctor: Doctor = {
  id: 'doctor-synthetic-1',
  fullName: 'Médica Sintética',
  jvpm: 'JVPM-SYN-001',
  documentId: '00000000-0',
  specialty: 'Medicina interna',
  referralCategory: 'NEW',
  landlinePhone: '2222-0000',
  address: 'Dirección sintética',
  attachments: [],
};
const hospitalization: Hospitalization = {
  id: 'hospitalization-synthetic-1',
  patientId: 'patient-synthetic-1',
  startDate: '2026-09-09',
  admissionPeriods: [{ admissionDate: '2026-09-09' }],
  status: 'ACTIVE',
  accountType: 'PARTICULAR',
  primaryDoctorId: doctor.id,
};

function collection() {
  return {
    find: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
    findOne: vi.fn(async () => null),
    insertOne: vi.fn(async () => ({ acknowledged: true })),
    findOneAndUpdate: vi.fn(async () => null),
  };
}

describe('Mongo doctor and hospitalization commands', () => {
  // test-id: vitest:feedback-doctor-optional-profile
  it('accepts a doctor without DUI or address and retains the requested optional profile', async () => {
    const doctors = collection();
    const repository = new MongoDoctorRepository(doctors as never);
    const optionalDoctor: Doctor = {
      ...doctor,
      documentId: undefined,
      address: undefined,
      birthDate: '1980-01-02',
      clinicName: 'Clínica sintética',
      nit: 'NIT-SYN-001',
      consultationHours: 'Lunes',
      medicalVisitHours: 'Martes',
      zone: 'Zona sintética',
      secretaryName: 'Secretaria Sintética',
      secretaryBirthday: '1990-03-04',
    };
    await expect(repository.create(administrator, { doctor: optionalDoctor })).resolves.toEqual(
      optionalDoctor,
    );
    expect(doctors.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ clinicName: 'Clínica sintética', landlinePhone: '2222-0000' }),
    );
    await expect(
      repository.create(administrator, { doctor: { ...optionalDoctor, landlinePhone: '' } }),
    ).rejects.toThrow('teléfono fijo');
    await expect(
      repository.replace(administrator, doctor.id, {
        doctor: { ...optionalDoctor, landlinePhone: undefined },
        expectedVersion: 1,
      }),
    ).rejects.toThrow('teléfono fijo');
    doctors.findOne.mockResolvedValueOnce({
      ...doctor,
      landlinePhone: undefined,
      organizationId: administrator.organizationId,
      version: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    } as never);
    await expect(repository.get(administrator, doctor.id)).resolves.toMatchObject({
      id: doctor.id,
    });
  });
  it('requires classification for a new doctor and a principal doctor for a new hospitalization', async () => {
    await expect(
      new MongoDoctorRepository(collection() as never).create(administrator, {
        doctor: { ...doctor, referralCategory: undefined },
      }),
    ).rejects.toThrow('médico es nuevo o recurrente');
    await expect(
      new MongoHospitalizationRepository(collection() as never, collection() as never).create(
        administrator,
        { hospitalization: { ...hospitalization, primaryDoctorId: undefined } },
      ),
    ).rejects.toThrow('médico tratante principal');
    await expect(
      new MongoDoctorRepository(collection() as never).replace(administrator, doctor.id, {
        doctor: { ...doctor, referralCategory: undefined },
        expectedVersion: 1,
      }),
    ).rejects.toThrow('médico es nuevo o recurrente');
    await expect(
      new MongoHospitalizationRepository(collection() as never, collection() as never).replace(
        administrator,
        hospitalization.id,
        { hospitalization: { ...hospitalization, primaryDoctorId: undefined }, expectedVersion: 1 },
      ),
    ).rejects.toThrow('médico tratante principal');
  });
  // test-id: vitest:e02-doctor-private-file-command-boundary
  it('creates a tenant-scoped doctor but rejects browser authority and filename-only attachments', async () => {
    const doctors = collection();
    const repository = new MongoDoctorRepository(doctors as never);

    await expect(repository.create(administrator, { doctor })).resolves.toEqual(doctor);
    expect(doctors.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-a', version: 1, id: doctor.id }),
    );
    await expect(
      repository.create(administrator, { doctor: { ...doctor, organizationId: 'org-c' } }),
    ).rejects.toBeInstanceOf(MongoInputError);
    await expect(
      repository.create(administrator, {
        doctor: {
          ...doctor,
          attachments: [{ id: 'metadata-only', name: 'solo-nombre.pdf', size: 1 }],
        },
      }),
    ).rejects.toBeInstanceOf(MongoInputError);
  });

  // test-id: vitest:e02-doctor-version-and-tenant-scope
  it('uses tenant-scoped compare-and-swap for doctor edits and hides a foreign record', async () => {
    const doctors = collection();
    const repository = new MongoDoctorRepository(doctors as never);

    await expect(repository.get(otherOrganization, doctor.id)).resolves.toBeNull();
    expect(doctors.findOne).toHaveBeenCalledWith({ id: doctor.id, organizationId: 'org-c' });
    await expect(
      repository.replace(administrator, doctor.id, { doctor, expectedVersion: 2 }),
    ).rejects.toBeInstanceOf(MongoConflictError);
    expect(doctors.findOneAndUpdate).toHaveBeenCalledWith(
      { id: doctor.id, organizationId: 'org-a', version: 2 },
      expect.objectContaining({ $inc: { version: 1 } }),
      { returnDocument: 'after' },
    );
  });

  // test-id: vitest:e02-hospitalization-admission-period-command
  it('accepts explicit administrative admission periods only when the patient belongs to the tenant', async () => {
    const hospitalizations = collection();
    const patients = { findOne: vi.fn(async () => ({ id: hospitalization.patientId })) };
    const repository = new MongoHospitalizationRepository(hospitalizations as never, patients);

    await expect(repository.create(administrator, { hospitalization })).resolves.toEqual(
      hospitalization,
    );
    expect(patients.findOne).toHaveBeenCalledWith({
      id: hospitalization.patientId,
      organizationId: 'org-a',
    });
    expect(hospitalizations.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-a',
        version: 1,
        admissionPeriods: hospitalization.admissionPeriods,
      }),
    );
  });

  // test-id: vitest:e02-hospitalization-command-rejects-cross-tenant-patient
  it('rejects a missing or foreign patient before a hospitalization write and preserves compare-and-swap conflicts', async () => {
    const hospitalizations = collection();
    const patients = {
      findOne: vi.fn<(...args: Record<string, unknown>[]) => Promise<unknown | null>>(
        async () => null,
      ),
    };
    const repository = new MongoHospitalizationRepository(hospitalizations as never, patients);

    await expect(repository.create(administrator, { hospitalization })).rejects.toBeInstanceOf(
      MongoInputError,
    );
    expect(hospitalizations.insertOne).not.toHaveBeenCalled();
    patients.findOne.mockResolvedValueOnce({ id: hospitalization.patientId });
    await expect(
      repository.replace(administrator, hospitalization.id, {
        hospitalization,
        expectedVersion: 4,
      }),
    ).rejects.toBeInstanceOf(MongoConflictError);
    expect(hospitalizations.findOneAndUpdate).toHaveBeenCalledWith(
      { id: hospitalization.id, organizationId: 'org-a', version: 4 },
      expect.objectContaining({ $inc: { version: 1 } }),
      { returnDocument: 'after' },
    );
  });

  it('attaches only same-patient quote references without editing the quote', async () => {
    const hospitalizations = collection();
    const patients = { findOne: vi.fn(async () => ({ id: hospitalization.patientId })) };
    const quotes = { findOne: vi.fn(async () => ({ patientId: hospitalization.patientId })) };
    const repository = new MongoHospitalizationRepository(
      hospitalizations as never,
      patients,
      undefined,
      quotes,
    );
    const linked = { ...hospitalization, linkedQuoteIds: ['quote-synthetic-1'] };
    await expect(repository.create(administrator, { hospitalization: linked })).resolves.toEqual(
      linked,
    );
    expect(quotes.findOne).toHaveBeenCalledWith({
      id: 'quote-synthetic-1',
      organizationId: 'org-a',
      patientId: hospitalization.patientId,
    });
    quotes.findOne.mockResolvedValueOnce(null as never);
    await expect(
      repository.create(administrator, { hospitalization: linked }),
    ).rejects.toBeInstanceOf(MongoInputError);
  });
});
