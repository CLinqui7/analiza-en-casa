import { parseShiftSeriesCommand, assertNoSeriesCollisions, overlaps } from './validation/shifts';
export { parseShiftSeriesCommand } from './validation/shifts';
import {
  nursingResourceSchema,
  shiftSchema,
  type NursingResource,
  type Shift,
} from '@analiza/contracts';
import { can } from '@/lib/permissions';
import { MongoAccessError, MongoInputError, type ServerActor } from './mongo-patients';

type StoredShift = Shift & { organizationId: string; createdAt: string };
type SeriesCommand = { organizationId: string; idempotencyKey: string; shifts: Shift[] };
type AuditEvent = {
  id: string;
  organizationId: string;
  actorUserId: string;
  action: 'SHIFT_SERIES_CREATED';
  resourceType: 'shiftSeries';
  resourceId: string;
  occurredAt: Date;
};
type Collection<T> = {
  find(filter: Record<string, unknown>): { toArray(): Promise<T[]> };
  findOne(filter: Record<string, unknown>): Promise<T | null>;
  insertOne(document: T): Promise<unknown>;
};
type TransactionSession = {
  withTransaction<T>(callback: () => Promise<T>): Promise<T>;
  endSession(): Promise<void> | void;
};
export type AgendaDatabase = {
  collection<T>(
    name: 'shifts' | 'shiftSeriesCommands' | 'auditEvents' | 'nursingResources' | 'patients',
  ): Collection<T>;
  client: { startSession(): TransactionSession };
};

/**
 * A series is stored all-or-nothing. Its command key makes client retries safe; all tenant and
 * resource checks happen in the transaction and never trust browser-provided authority.
 */
export class MongoShiftRepository {
  constructor(private readonly database: AgendaDatabase) {}

  async list(actor: ServerActor): Promise<Shift[]> {
    if (!can(actor.role, 'agenda:read')) throw new MongoAccessError();
    const rows = await this.database
      .collection<StoredShift>('shifts')
      .find({ organizationId: actor.organizationId })
      .toArray();
    return rows.map((row) =>
      shiftSchema.parse({
        id: row.id,
        resourceId: row.resourceId,
        patientId: row.patientId,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        status: row.status,
        note: row.note,
      }),
    );
  }

  /** Resource reads are tenant-scoped and intentionally do not create demo resources. */
  async listResources(actor: ServerActor): Promise<NursingResource[]> {
    if (!can(actor.role, 'agenda:read')) throw new MongoAccessError();
    const rows = await this.database
      .collection<Record<string, unknown>>('nursingResources')
      .find({ organizationId: actor.organizationId })
      .toArray();
    return rows.map((row) =>
      nursingResourceSchema.parse({
        id: row.id,
        userId: row.userId,
        displayName: row.displayName,
        territory: row.territory,
        shift: row.shift,
        availability: row.availability,
        capacity: row.capacity,
        boardRegistrationNumber: row.boardRegistrationNumber,
      }),
    );
  }

  async createSeries(actor: ServerActor, input: unknown, now = new Date()): Promise<Shift[]> {
    if (!can(actor.role, 'agenda:write')) throw new MongoAccessError();
    const { shifts, idempotencyKey } = parseShiftSeriesCommand(input);
    assertNoSeriesCollisions(shifts);
    const session = this.database.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const commands = this.database.collection<SeriesCommand>('shiftSeriesCommands');
        const previous = await commands.findOne({
          organizationId: actor.organizationId,
          idempotencyKey,
        });
        if (previous) return previous.shifts.map((shift) => shiftSchema.parse(shift));

        const resources = this.database.collection<Record<string, unknown>>('nursingResources');
        const patients = this.database.collection<Record<string, unknown>>('patients');
        const storedShifts = this.database.collection<StoredShift>('shifts');
        for (const shift of shifts) {
          const resource = await resources.findOne({
            id: shift.resourceId,
            organizationId: actor.organizationId,
          });
          if (!resource) throw new MongoInputError('El recurso asignado no está disponible.');
          if (shift.patientId) {
            const patient = await patients.findOne({
              id: shift.patientId,
              organizationId: actor.organizationId,
            });
            if (!patient) throw new MongoInputError('El paciente asignado no está disponible.');
          }
          if (shift.status !== 'CANCELLED') {
            const existing = await storedShifts
              .find({ organizationId: actor.organizationId, resourceId: shift.resourceId })
              .toArray();
            if (
              existing.some(
                (candidate) => candidate.status !== 'CANCELLED' && overlaps(shift, candidate),
              )
            ) {
              throw new MongoInputError('El recurso ya tiene un turno que colisiona.');
            }
          }
        }
        const timestamp = now.toISOString();
        for (const shift of shifts) {
          await storedShifts.insertOne({
            ...shift,
            organizationId: actor.organizationId,
            createdAt: timestamp,
          });
        }
        await commands.insertOne({ organizationId: actor.organizationId, idempotencyKey, shifts });
        await this.database.collection<AuditEvent>('auditEvents').insertOne({
          id: crypto.randomUUID(),
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'SHIFT_SERIES_CREATED',
          resourceType: 'shiftSeries',
          resourceId: idempotencyKey,
          occurredAt: now,
        });
        return shifts;
      });
    } finally {
      await session.endSession();
    }
  }
}

export const mongoShiftIndexes = [
  {
    collection: 'shifts',
    key: { organizationId: 1, id: 1 },
    name: 'shifts_org_id_unique',
    unique: true,
  },
  {
    collection: 'shifts',
    key: { organizationId: 1, resourceId: 1, startsAt: 1 },
    name: 'shifts_org_resource_start',
  },
  {
    collection: 'shiftSeriesCommands',
    key: { organizationId: 1, idempotencyKey: 1 },
    name: 'shift_series_org_idempotency_unique',
    unique: true,
  },
] as const;
