import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { Shift } from '@analiza/contracts';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  type ServerActor,
} from './mongo-patients';
import { MongoShiftRepository, type AgendaDatabase } from './mongo-shifts';

const administrator: ServerActor = { userId: 'admin-a', organizationId: 'org-a', role: 'ADMIN' };
const reader: ServerActor = { userId: 'reader-a', organizationId: 'org-a', role: 'DOCTOR' };
const shift = (id: string, startsAt: string, endsAt: string): Shift => ({
  id,
  resourceId: 'nurse-synthetic-1',
  patientId: 'patient-synthetic-1',
  startsAt,
  endsAt,
  status: 'SCHEDULED',
});

function database(
  existing: Shift[] = [],
  replay: Shift[] | null = null,
  updateReplay: Shift | null = null,
) {
  const inserts = vi.fn(async () => ({ acknowledged: true }));
  const replacements = vi.fn(async () => ({ acknowledged: true }));
  const commands = {
    findOne: vi.fn(async () =>
      replay
        ? { organizationId: 'org-a', idempotencyKey: 'series-synthetic-1', shifts: replay }
        : null,
    ),
    find: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
    insertOne: inserts,
    replaceOne: replacements,
  };
  const updateCommands = {
    findOne: vi.fn(async () =>
      updateReplay
        ? {
            organizationId: 'org-a',
            idempotencyKey: 'update-synthetic-1',
            payloadHash: createHash('sha256').update(JSON.stringify(updateReplay)).digest('hex'),
            shift: updateReplay,
          }
        : null,
    ),
    find: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
    insertOne: inserts,
    replaceOne: replacements,
  };
  const shifts = {
    findOne: vi.fn(async () => existing[0] ?? null),
    find: vi.fn(() => ({ toArray: vi.fn(async () => existing) })),
    insertOne: inserts,
    replaceOne: replacements,
  };
  const resources = {
    findOne: vi.fn(async () => ({ id: 'nurse-synthetic-1' })),
    find: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
    insertOne: inserts,
    replaceOne: replacements,
  };
  const patients = {
    findOne: vi.fn(async () => ({ id: 'patient-synthetic-1' })),
    find: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
    insertOne: inserts,
    replaceOne: replacements,
  };
  const audits = {
    findOne: vi.fn(async () => null),
    find: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
    insertOne: inserts,
    replaceOne: replacements,
  };
  const transaction = vi.fn(async (callback: () => Promise<unknown>) => callback());
  const store = {
    collection: vi.fn(
      (name: string) =>
        ({
          shifts,
          shiftSeriesCommands: commands,
          shiftUpdateCommands: updateCommands,
          nursingResources: resources,
          patients,
          auditEvents: audits,
        })[name],
    ),
    client: { startSession: () => ({ withTransaction: transaction, endSession: vi.fn() }) },
  } as unknown as AgendaDatabase;
  return {
    store,
    inserts,
    replacements,
    commands,
    updateCommands,
    shifts,
    resources,
    patients,
    transaction,
  };
}

describe('Mongo agenda series commands', () => {
  // test-id: vitest:e03-shift-series-atomic-idempotent-audit
  it('stores a multi-day series atomically, tenant-scoped and with a server-authored audit event', async () => {
    const fake = database();
    const series = [
      shift('shift-synthetic-1', '2026-09-10T20:00:00.000Z', '2026-09-11T04:00:00.000Z'),
      shift('shift-synthetic-2', '2026-09-12T08:00:00.000Z', '2026-09-12T14:00:00.000Z'),
    ];
    await expect(
      new MongoShiftRepository(fake.store).createSeries(administrator, {
        shifts: series,
        idempotencyKey: 'series-synthetic-1',
      }),
    ).resolves.toEqual(series);
    expect(fake.transaction).toHaveBeenCalledTimes(1);
    expect(fake.resources.findOne).toHaveBeenCalledWith({
      id: 'nurse-synthetic-1',
      organizationId: 'org-a',
    });
    expect(fake.patients.findOne).toHaveBeenCalledWith({
      id: 'patient-synthetic-1',
      organizationId: 'org-a',
    });
    expect(fake.inserts).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'shift-synthetic-1', organizationId: 'org-a' }),
    );
    expect(fake.inserts).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SHIFT_SERIES_CREATED', actorUserId: 'admin-a' }),
    );
  });

  // test-id: vitest:e03-shift-series-collision-and-authority
  it('rejects collisions, browser authority and roles without agenda write access', async () => {
    const existing = [shift('existing', '2026-09-10T08:00:00.000Z', '2026-09-10T14:00:00.000Z')];
    const repository = new MongoShiftRepository(database(existing).store);
    await expect(
      repository.createSeries(administrator, {
        shifts: [shift('new', '2026-09-10T09:00:00.000Z', '2026-09-10T12:00:00.000Z')],
        idempotencyKey: 'collision',
      }),
    ).rejects.toBeInstanceOf(MongoInputError);
    await expect(
      repository.createSeries(administrator, {
        shifts: [shift('new', '2026-09-12T08:00:00.000Z', '2026-09-12T14:00:00.000Z')],
        idempotencyKey: 'authority',
        organizationId: 'org-b',
      }),
    ).rejects.toBeInstanceOf(MongoInputError);
    await expect(
      repository.createSeries(reader, {
        shifts: [shift('new', '2026-09-12T08:00:00.000Z', '2026-09-12T14:00:00.000Z')],
        idempotencyKey: 'role',
      }),
    ).rejects.toBeInstanceOf(MongoAccessError);
  });

  // test-id: vitest:e03-shift-series-retry-no-duplicate
  it('returns the original series on an idempotent retry without adding shifts or audit events', async () => {
    const series = [
      shift('shift-synthetic-1', '2026-09-10T20:00:00.000Z', '2026-09-11T04:00:00.000Z'),
    ];
    const fake = database([], series);
    await expect(
      new MongoShiftRepository(fake.store).createSeries(administrator, {
        shifts: series,
        idempotencyKey: 'series-synthetic-1',
      }),
    ).resolves.toEqual(series);
    expect(fake.inserts).not.toHaveBeenCalled();
  });

  // test-id: vitest:e03-shift-update-audited-idempotent
  it('updates one scheduled shift atomically, checks availability and appends audit evidence', async () => {
    const current = shift(
      'shift-synthetic-1',
      '2026-09-10T20:00:00.000Z',
      '2026-09-11T04:00:00.000Z',
    );
    const updated = { ...current, startsAt: '2026-09-10T21:00:00.000Z' };
    const fake = database([current]);
    await expect(
      new MongoShiftRepository(fake.store).update(administrator, {
        shift: updated,
        idempotencyKey: 'update-synthetic-1',
      }),
    ).resolves.toEqual(updated);
    expect(fake.replacements).toHaveBeenCalledWith(
      { organizationId: 'org-a', id: current.id },
      expect.objectContaining({ ...updated, organizationId: 'org-a' }),
    );
    expect(fake.inserts).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SHIFT_UPDATED', resourceId: current.id }),
    );
  });

  it('rejects an update that collides and replays an idempotent update without writing again', async () => {
    const current = shift(
      'shift-synthetic-1',
      '2026-09-10T20:00:00.000Z',
      '2026-09-11T04:00:00.000Z',
    );
    const collision = shift(
      'shift-synthetic-2',
      '2026-09-10T08:00:00.000Z',
      '2026-09-10T14:00:00.000Z',
    );
    const conflicting = { ...current, startsAt: '2026-09-10T09:00:00.000Z' };
    await expect(
      new MongoShiftRepository(database([current, collision]).store).update(administrator, {
        shift: conflicting,
        idempotencyKey: 'update-collision',
      }),
    ).rejects.toBeInstanceOf(MongoInputError);

    const replay = database([current], null, conflicting);
    await expect(
      new MongoShiftRepository(replay.store).update(administrator, {
        shift: conflicting,
        idempotencyKey: 'update-synthetic-1',
      }),
    ).resolves.toEqual(conflicting);
    expect(replay.replacements).not.toHaveBeenCalled();

    await expect(
      new MongoShiftRepository(replay.store).update(administrator, {
        shift: { ...conflicting, endsAt: '2026-09-10T13:00:00.000Z' },
        idempotencyKey: 'update-synthetic-1',
      }),
    ).rejects.toBeInstanceOf(MongoConflictError);
  });
});
