import { hospitalizationSchema, type Hospitalization } from '@analiza/contracts';
import { can, type Permission } from '@/lib/permissions';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  rejectBrowserAuthority,
  type ServerActor,
} from './mongo-patients';

type StoredHospitalization = Hospitalization & {
  organizationId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
type HospitalizationCollection = {
  find(filter: Record<string, unknown>): { toArray(): Promise<StoredHospitalization[]> };
  findOne(filter: Record<string, unknown>): Promise<StoredHospitalization | null>;
  insertOne(document: StoredHospitalization): Promise<unknown>;
  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: { returnDocument: 'after' },
  ): Promise<StoredHospitalization | null>;
};
type PatientLookup = { findOne(filter: Record<string, unknown>): Promise<unknown | null> };
export type HospitalizationWithVersion = Readonly<{
  hospitalization: Hospitalization;
  version: number;
}>;

function authorize(actor: ServerActor, permission: Permission) {
  if (!can(actor.role, permission)) throw new MongoAccessError();
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MongoInputError();
  return value as Record<string, unknown>;
}

function parseHospitalization(value: unknown): Hospitalization {
  try {
    return hospitalizationSchema.strict().parse(value);
  } catch {
    throw new MongoInputError('La hospitalización contiene datos no válidos.');
  }
}

export function parseHospitalizationCreate(input: unknown): Hospitalization {
  rejectBrowserAuthority(input);
  const body = object(input);
  if (Object.keys(body).some((key) => key !== 'hospitalization')) throw new MongoInputError();
  return parseHospitalization(body.hospitalization);
}

export function parseHospitalizationReplace(input: unknown): {
  hospitalization: Hospitalization;
  expectedVersion: number;
} {
  rejectBrowserAuthority(input);
  const body = object(input);
  if (Object.keys(body).some((key) => key !== 'hospitalization' && key !== 'expectedVersion')) {
    throw new MongoInputError();
  }
  if (!Number.isInteger(body.expectedVersion) || (body.expectedVersion as number) < 1) {
    throw new MongoInputError('La versión esperada es obligatoria.');
  }
  return {
    hospitalization: parseHospitalization(body.hospitalization),
    expectedVersion: body.expectedVersion as number,
  };
}

function publicHospitalization(row: StoredHospitalization): Hospitalization {
  return hospitalizationSchema.parse(row);
}

/** Hospitalization commands check that their patient belongs to the server-resolved tenant. */
export class MongoHospitalizationRepository {
  constructor(
    private readonly hospitalizations: HospitalizationCollection,
    private readonly patients: PatientLookup,
    private readonly nurseAccounts?: { resources: PatientLookup; memberships: PatientLookup },
  ) {}

  async listWithVersions(actor: ServerActor): Promise<HospitalizationWithVersion[]> {
    authorize(actor, 'cases:read');
    const rows = await this.hospitalizations
      .find({ organizationId: actor.organizationId })
      .toArray();
    return rows.map((row) => ({
      hospitalization: publicHospitalization(row),
      version: row.version,
    }));
  }

  async get(actor: ServerActor, id: string): Promise<Hospitalization | null> {
    authorize(actor, 'cases:read');
    const row = await this.hospitalizations.findOne({ id, organizationId: actor.organizationId });
    return row ? publicHospitalization(row) : null;
  }

  private async requirePatient(actor: ServerActor, patientId: string) {
    const patient = await this.patients.findOne({
      id: patientId,
      organizationId: actor.organizationId,
    });
    if (!patient) throw new MongoInputError('El paciente asociado no está disponible.');
  }

  private async resolveNurses(actor: ServerActor, hospitalization: Hospitalization) {
    const resourceIds = [...new Set(hospitalization.assignedNursingResourceIds ?? [])];
    if (!this.nurseAccounts) {
      if (resourceIds.length || hospitalization.assignedNurseUserIds?.length)
        throw new MongoInputError('La validación de cuentas de enfermería no está disponible.');
      return hospitalization;
    }
    if (!resourceIds.length)
      throw new MongoInputError('Asigne al menos una enfermera con cuenta de usuario.');
    const userIds: string[] = [];
    for (const id of resourceIds) {
      const resource = (await this.nurseAccounts.resources.findOne({
        id,
        organizationId: actor.organizationId,
      })) as { userId?: string } | null;
      if (
        !resource?.userId ||
        !(await this.nurseAccounts.memberships.findOne({
          userId: resource.userId,
          organizationId: actor.organizationId,
          active: true,
          role: { $in: ['NURSE', 'NURSE_MANAGER'] },
        }))
      )
        throw new MongoInputError('Una enfermera no tiene una cuenta activa en esta organización.');
      userIds.push(resource.userId);
    }
    return {
      ...hospitalization,
      assignedNursingResourceIds: resourceIds,
      assignedNurseUserIds: [...new Set(userIds)],
    };
  }

  async create(actor: ServerActor, input: unknown, now = new Date()): Promise<Hospitalization> {
    authorize(actor, 'cases:write');
    const hospitalization = await this.resolveNurses(actor, parseHospitalizationCreate(input));
    await this.requirePatient(actor, hospitalization.patientId);
    const timestamp = now.toISOString();
    const stored: StoredHospitalization = {
      ...hospitalization,
      organizationId: actor.organizationId,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.hospitalizations.insertOne(stored);
    return publicHospitalization(stored);
  }

  async replace(
    actor: ServerActor,
    id: string,
    input: unknown,
    now = new Date(),
  ): Promise<Hospitalization> {
    authorize(actor, 'cases:write');
    const parsed = parseHospitalizationReplace(input);
    const { expectedVersion } = parsed;
    const hospitalization = await this.resolveNurses(actor, parsed.hospitalization);
    if (hospitalization.id !== id)
      throw new MongoInputError('El identificador de ruta no coincide.');
    await this.requirePatient(actor, hospitalization.patientId);
    const updated = await this.hospitalizations.findOneAndUpdate(
      { id, organizationId: actor.organizationId, version: expectedVersion },
      { $set: { ...hospitalization, updatedAt: now.toISOString() }, $inc: { version: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new MongoConflictError();
    return publicHospitalization(updated);
  }
}

export const mongoHospitalizationIndexes = [
  {
    collection: 'hospitalizations',
    key: { organizationId: 1, id: 1 },
    name: 'hospitalizations_org_id_unique',
    unique: true,
  },
  {
    collection: 'hospitalizations',
    key: { organizationId: 1, patientId: 1, startDate: -1 },
    name: 'hospitalizations_org_patient_admission',
  },
] as const;
