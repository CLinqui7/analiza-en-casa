import { describe, expect, it, vi } from 'vitest';
import type { Patient } from '@analiza/contracts';
import {
  MongoDuplicatePatientError,
  MongoConflictError,
  MongoInputError,
  MongoPatientRepository,
  type ServerActor,
} from './mongo-patients';
import { resourceStatus } from './http-auth';

const admin: ServerActor = { userId: 'user-a', organizationId: 'org-a', role: 'ADMIN' };
const doctorInOtherOrganization: ServerActor = {
  userId: 'user-b',
  organizationId: 'org-b',
  role: 'DOCTOR',
};
const patient: Patient = {
  id: '8a5e65c6-64cb-46e0-9d34-a0d4b05ac001',
  fullName: 'Paciente Sintético',
  documentType: 'DUI',
  documentId: '00000000-0',
  status: 'ACTIVE',
};

type PatientCollectionDouble = {
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  insertOne: ReturnType<typeof vi.fn>;
  findOneAndUpdate: ReturnType<typeof vi.fn>;
};

function collection(overrides: Partial<PatientCollectionDouble> = {}): PatientCollectionDouble {
  return {
    find: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
    findOne: vi.fn(async () => null),
    insertOne: vi.fn(async () => ({ acknowledged: true })),
    findOneAndUpdate: vi.fn(async () => null),
    ...overrides,
  };
}

function repositoryFor(patients: PatientCollectionDouble) {
  return new MongoPatientRepository(
    patients as unknown as ConstructorParameters<typeof MongoPatientRepository>[0],
  );
}

describe('Mongo patient repository', () => {
  // test-id: vitest:db01-mongo-tenant-create
  it('derives the organization from the trusted actor and preserves a UUID', async () => {
    const patients = collection();
    const repository = repositoryFor(patients);

    await expect(
      repository.create(admin, { patient }, new Date('2026-09-09T12:00:00.000Z')),
    ).resolves.toEqual(patient);
    expect(patients.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        id: patient.id,
        organizationId: 'org-a',
        documentIdNormalized: '00000000-0',
        version: 1,
      }),
    );
  });

  // test-id: vitest:db01-mongo-authority-reject
  it('rejects organization, role and Mongo operator values sent by the browser', async () => {
    const repository = repositoryFor(collection());
    await expect(
      repository.create(admin, { patient: { ...patient, organizationId: 'org-other' } }),
    ).rejects.toBeInstanceOf(MongoInputError);
    await expect(
      repository.create(admin, { patient, filter: { $where: 'ignored' } }),
    ).rejects.toBeInstanceOf(MongoInputError);
    await expect(repository.create(admin, { patient, role: 'ADMIN' })).rejects.toBeInstanceOf(
      MongoInputError,
    );
  });

  // test-id: vitest:e01-patient-invalid-dto
  it('maps an invalid patient DTO to the safe input error used by the HTTP command', async () => {
    const repository = repositoryFor(collection());
    await expect(
      repository.create(admin, { patient: { ...patient, documentType: 'UNTRUSTED' } }),
    ).rejects.toBeInstanceOf(MongoInputError);
  });

  it('permits the domain role of a patient contact without treating it as session authority', async () => {
    const repository = repositoryFor(collection());
    await expect(
      repository.create(admin, {
        patient: { ...patient, contacts: [{ id: 'contact-1', role: 'RESPONSABLE' }] },
      }),
    ).resolves.toMatchObject({ id: patient.id });
  });

  // test-id: vitest:e01-patient-responsible-document
  it('stores an administrative responsible contact document without accepting a tenant override', async () => {
    const patients = collection();
    const repository = repositoryFor(patients);

    await repository.create(admin, {
      patient: {
        ...patient,
        contacts: [
          {
            id: 'responsible-1',
            fullName: 'Responsable Sintético',
            relationship: 'Responsable',
            role: 'RESPONSABLE',
            documentType: 'DUI',
            documentId: '11111111-1',
            isPrimary: true,
          },
        ],
      },
    });

    expect(patients.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-a',
        contacts: [expect.objectContaining({ documentType: 'DUI', documentId: '11111111-1' })],
      }),
    );
  });

  // test-id: vitest:db01-mongo-tenant-read
  it('scopes reads by the organization resolved on the server', async () => {
    const patients = collection();
    const repository = repositoryFor(patients);

    await repository.get(admin, patient.id);

    expect(patients.findOne).toHaveBeenCalledWith({ id: patient.id, organizationId: 'org-a' });
  });

  // test-id: vitest:m01-cross-tenant-404
  it('does not reveal a patient to an authorized role from a different organization', async () => {
    const patients = collection();
    const repository = repositoryFor(patients);

    await expect(repository.get(doctorInOtherOrganization, patient.id)).resolves.toBeNull();
    expect(patients.findOne).toHaveBeenCalledWith({ id: patient.id, organizationId: 'org-b' });
    expect(resourceStatus(null)).toBe(404);
  });

  // test-id: vitest:db01-mongo-version-conflict
  it('uses a tenant-scoped expected version and returns a conflict without retrying', async () => {
    const patients = collection();
    const repository = repositoryFor(patients);

    await expect(
      repository.replace(admin, patient.id, { patient, expectedVersion: 4 }),
    ).rejects.toBeInstanceOf(MongoConflictError);
    expect(patients.findOneAndUpdate).toHaveBeenCalledWith(
      { id: patient.id, organizationId: 'org-a', version: 4 },
      expect.objectContaining({ $inc: { version: 1 } }),
      { returnDocument: 'after' },
    );
  });

  // test-id: vitest:e01-patient-duplicate-scope
  it('converts the tenant document unique-index collision to a safe validation error', async () => {
    const repository = repositoryFor(
      collection({ insertOne: vi.fn(async () => Promise.reject({ code: 11000 })) }),
    );

    await expect(repository.create(admin, { patient })).rejects.toBeInstanceOf(
      MongoDuplicatePatientError,
    );
  });

  // test-id: vitest:e01-patient-version-refetch
  it('returns version metadata beside the public DTO for a later compare-and-swap update', async () => {
    const stored = {
      ...patient,
      organizationId: 'org-a',
      documentIdNormalized: patient.documentId,
      version: 3,
      createdAt: '2026-09-09T12:00:00.000Z',
      updatedAt: '2026-09-09T12:00:00.000Z',
    };
    const patients = collection({ find: vi.fn(() => ({ toArray: vi.fn(async () => [stored]) })) });
    const repository = repositoryFor(patients);

    await expect(repository.listWithVersions(admin)).resolves.toEqual([{ patient, version: 3 }]);
    expect(patients.find).toHaveBeenCalledWith({ organizationId: 'org-a' });
  });
});
