import { describe, expect, it, vi } from 'vitest';
import { initializeMongoSchema, mongoSchemaIndexes } from './mongo-bootstrap';

describe('Mongo deployment schema bootstrap', () => {
  // test-id: vitest:m02-bootstrap-dry-run
  it('reports the planned tenant, idempotency, session, and file indexes without a database write in dry-run', async () => {
    const createIndex = vi.fn();
    const report = await initializeMongoSchema(
      { collection: vi.fn(() => ({ createIndex })) },
      { dryRun: true },
    );
    expect(report.plannedIndexes).toContain('payments.payments_org_idempotency_unique');
    expect(report.plannedIndexes).toContain('fileMetadata.file_metadata_org_id_unique');
    expect(report.plannedIndexes).toContain('patients.patients_org_id_unique');
    expect(report.plannedIndexes).toContain('shifts.shifts_org_id_unique');
    expect(report.plannedIndexes).toContain('doctors.doctors_org_id_unique');
    expect(report.plannedIndexes).toContain('hospitalizations.hospitalizations_org_id_unique');
    expect(createIndex).not.toHaveBeenCalled();
  });

  // test-id: vitest:m02-bootstrap-idempotent-indexes
  it('delegates named index creation outside handlers so MongoDB can apply the same definition idempotently', async () => {
    const createIndex = vi.fn(async (_key: unknown, options: { name: string }) => options.name);
    const report = await initializeMongoSchema(
      { collection: vi.fn(() => ({ createIndex })) },
      { dryRun: false },
    );
    expect(createIndex).toHaveBeenCalledTimes(mongoSchemaIndexes.length);
    expect(report.appliedIndexes).toHaveLength(mongoSchemaIndexes.length);
    expect(createIndex).toHaveBeenCalledWith(
      { expiresAt: 1 },
      expect.objectContaining({ name: 'sessions_expiry_ttl', expireAfterSeconds: 0 }),
    );
  });
});
