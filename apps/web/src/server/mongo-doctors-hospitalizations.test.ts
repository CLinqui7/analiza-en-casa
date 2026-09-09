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
});
