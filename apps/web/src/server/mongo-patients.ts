import { patientSchema, type Patient } from '@analiza/contracts';
import { can, type Permission, type Role } from '@/lib/permissions';

export type ServerActor = Readonly<{ userId: string; organizationId: string; role: Role }>;

export class MongoAccessError extends Error {
  constructor(message = 'No tiene autorización para esta operación.') {
    super(message);
    this.name = 'MongoAccessError';
  }
}

export class MongoConflictError extends Error {
  constructor() {
    super('El registro cambió antes de guardar. Recargue y vuelva a intentar.');
    this.name = 'MongoConflictError';
  }
}

export class MongoDuplicatePatientError extends Error {
  constructor() {
    super('Ya existe un paciente con ese documento en esta organización.');
    this.name = 'MongoDuplicatePatientError';
  }
}

export class MongoInputError extends Error {
  constructor(message = 'La solicitud contiene campos no permitidos.') {
    super(message);
    this.name = 'MongoInputError';
  }
}

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

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MongoInputError();
  return value as Record<string, unknown>;
}

/** Browser-controlled tenancy and Mongo operators are rejected, even if nested in a DTO. */
export function rejectBrowserAuthority(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(rejectBrowserAuthority);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'organizationId' || key === 'actor') {
      throw new MongoInputError('La organización se resuelve en el servidor.');
    }
    if (key.startsWith('$'))
      throw new MongoInputError('Los operadores de base de datos no están permitidos.');
    rejectBrowserAuthority(child);
  }
}

function publicPatient(patient: StoredPatient): Patient {
  return patientSchema.parse(patient);
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return (error as { code?: unknown }).code === 11000;
}

function parsePatientDto(value: unknown): Patient {
  try {
    return patientSchema.strict().parse(value);
  } catch {
    throw new MongoInputError('El paciente contiene datos no válidos.');
  }
}

export function parsePatientCreate(input: unknown): Patient {
  rejectBrowserAuthority(input);
  const body = object(input);
  if ('role' in body) throw new MongoInputError('El rol se resuelve en el servidor.');
  if (Object.keys(body).some((key) => key !== 'patient')) throw new MongoInputError();
  return parsePatientDto(body.patient);
}

export function parsePatientReplace(input: unknown): { patient: Patient; expectedVersion: number } {
  rejectBrowserAuthority(input);
  const body = object(input);
  if ('role' in body) throw new MongoInputError('El rol se resuelve en el servidor.');
  if (Object.keys(body).some((key) => key !== 'patient' && key !== 'expectedVersion')) {
    throw new MongoInputError();
  }
  if (!Number.isInteger(body.expectedVersion) || (body.expectedVersion as number) < 1) {
    throw new MongoInputError('La versión esperada es obligatoria.');
  }
  return {
    patient: parsePatientDto(body.patient),
    expectedVersion: body.expectedVersion as number,
  };
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
