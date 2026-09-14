import {
  type ServerActor,
  MongoAccessError,
  MongoConflictError,
  MongoDuplicatePatientError,
  MongoInputError,
  parsePatientCreate,
  parsePatientReplace,
} from './validation/patients';
export {
  type ServerActor,
  MongoAccessError,
  MongoConflictError,
  MongoDuplicatePatientError,
  MongoInputError,
  rejectBrowserAuthority,
  parsePatientCreate,
  parsePatientReplace,
} from './validation/patients';
import { patientSchema, type Patient } from '@analiza/contracts';
import { can, type Permission } from '@/lib/permissions';

type StoredPatient = Patient & {
  organizationId: string;
  documentIdNormalized: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type PatientCollection = {
  find(filter: Record<string, unknown>): { toArray(): Promise<StoredPatient[]> };
  findOne(filter: Record<string, unknown>): Promise<StoredPatient | null>;
  insertOne(document: StoredPatient): Promise<unknown>;
  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: { returnDocument: 'after' },
  ): Promise<StoredPatient | null>;
};

type PatientWithVersion = Readonly<{ patient: Patient; version: number }>;

function authorize(actor: ServerActor, permission: Permission) {
  if (!can(actor.role, permission)) throw new MongoAccessError();
}

function publicPatient(patient: StoredPatient): Patient {
  return patientSchema.parse(patient);
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return (error as { code?: unknown }).code === 11000;
}

/** Bounded patient commands; this is not a generic collection endpoint or a snapshot upsert. */
export class MongoPatientRepository {
  constructor(private readonly patients: PatientCollection) {}

  async list(actor: ServerActor): Promise<Patient[]> {
    authorize(actor, 'patients:read');
    const rows = await this.patients.find({ organizationId: actor.organizationId }).toArray();
    return rows.map(publicPatient);
  }

  /** Version metadata is returned beside the DTO, never merged into it or accepted from a client. */
  async listWithVersions(actor: ServerActor): Promise<PatientWithVersion[]> {
    authorize(actor, 'patients:read');
    const rows = await this.patients.find({ organizationId: actor.organizationId }).toArray();
    return rows.map((row) => ({ patient: publicPatient(row), version: row.version }));
  }

  async get(actor: ServerActor, id: string): Promise<Patient | null> {
    authorize(actor, 'patients:read');
    const row = await this.patients.findOne({ id, organizationId: actor.organizationId });
    return row ? publicPatient(row) : null;
  }

  async create(actor: ServerActor, input: unknown, now = new Date()): Promise<Patient> {
    authorize(actor, 'patients:write');
    const patient = parsePatientCreate(input);
    const timestamp = now.toISOString();
    const stored: StoredPatient = {
      ...patient,
      organizationId: actor.organizationId,
      documentIdNormalized: patient.documentId.replace(/\s/g, '').toUpperCase(),
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    try {
      await this.patients.insertOne(stored);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new MongoDuplicatePatientError();
      throw error;
    }
    return publicPatient(stored);
  }

  async replace(
    actor: ServerActor,
    id: string,
    input: unknown,
    now = new Date(),
  ): Promise<Patient> {
    authorize(actor, 'patients:write');
    const { patient, expectedVersion } = parsePatientReplace(input);
    if (patient.id !== id) throw new MongoInputError('El identificador de ruta no coincide.');
    let updated: StoredPatient | null;
    try {
      updated = await this.patients.findOneAndUpdate(
        { id, organizationId: actor.organizationId, version: expectedVersion },
        {
          $set: {
            ...patient,
            documentIdNormalized: patient.documentId.replace(/\s/g, '').toUpperCase(),
            updatedAt: now.toISOString(),
          },
          $inc: { version: 1 },
        },
        { returnDocument: 'after' },
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new MongoDuplicatePatientError();
      throw error;
    }
    if (!updated) throw new MongoConflictError();
    return publicPatient(updated);
  }
}

export const mongoPatientIndexes = [
  {
    collection: 'patients',
    key: { organizationId: 1, id: 1 },
    name: 'patients_org_id_unique',
    unique: true,
  },
  {
    collection: 'patients',
    key: { organizationId: 1, documentType: 1, documentIdNormalized: 1 },
    name: 'patients_organization_document_unique',
    unique: true,
    partialFilterExpression: { documentIdNormalized: { $exists: true } },
  },
] as const;
