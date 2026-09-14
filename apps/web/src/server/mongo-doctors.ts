import { parseDoctorCreate, parseDoctorReplace } from './validation/doctors';
export { parseDoctorCreate, parseDoctorReplace } from './validation/doctors';
import { doctorSchema, type Doctor } from '@analiza/contracts';
import { can, type Permission } from '@/lib/permissions';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  type ServerActor,
} from './mongo-patients';

type StoredDoctor = Doctor & {
  organizationId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
type DoctorCollection = {
  find(filter: Record<string, unknown>): { toArray(): Promise<StoredDoctor[]> };
  findOne(filter: Record<string, unknown>): Promise<StoredDoctor | null>;
  insertOne(document: StoredDoctor): Promise<unknown>;
  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: { returnDocument: 'after' },
  ): Promise<StoredDoctor | null>;
};

export type DoctorWithVersion = Readonly<{ doctor: Doctor; version: number }>;

function authorize(actor: ServerActor, permission: Permission) {
  if (!can(actor.role, permission)) throw new MongoAccessError();
}

function publicDoctor(doctor: StoredDoctor): Doctor {
  return doctorSchema.parse(doctor);
}

/** Bounded doctor commands; documents always receive tenant and version data from the server. */
export class MongoDoctorRepository {
  constructor(private readonly doctors: DoctorCollection) {}

  async listWithVersions(actor: ServerActor): Promise<DoctorWithVersion[]> {
    authorize(actor, 'settings:write');
    const rows = await this.doctors.find({ organizationId: actor.organizationId }).toArray();
    return rows.map((row) => ({ doctor: publicDoctor(row), version: row.version }));
  }

  async get(actor: ServerActor, id: string): Promise<Doctor | null> {
    authorize(actor, 'settings:write');
    const doctor = await this.doctors.findOne({ id, organizationId: actor.organizationId });
    return doctor ? publicDoctor(doctor) : null;
  }

  async create(actor: ServerActor, input: unknown, now = new Date()): Promise<Doctor> {
    authorize(actor, 'settings:write');
    const doctor = parseDoctorCreate(input);
    const timestamp = now.toISOString();
    const stored: StoredDoctor = {
      ...doctor,
      organizationId: actor.organizationId,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.doctors.insertOne(stored);
    return publicDoctor(stored);
  }

  async replace(actor: ServerActor, id: string, input: unknown, now = new Date()): Promise<Doctor> {
    authorize(actor, 'settings:write');
    const { doctor, expectedVersion } = parseDoctorReplace(input);
    if (doctor.id !== id) throw new MongoInputError('El identificador de ruta no coincide.');
    const updated = await this.doctors.findOneAndUpdate(
      { id, organizationId: actor.organizationId, version: expectedVersion },
      { $set: { ...doctor, updatedAt: now.toISOString() }, $inc: { version: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new MongoConflictError();
    return publicDoctor(updated);
  }
}

export const mongoDoctorIndexes = [
  {
    collection: 'doctors',
    key: { organizationId: 1, id: 1 },
    name: 'doctors_org_id_unique',
    unique: true,
  },
  { collection: 'doctors', key: { organizationId: 1, fullName: 1 }, name: 'doctors_org_name' },
] as const;
