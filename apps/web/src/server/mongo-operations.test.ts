import { describe, expect, it, vi } from 'vitest';
import type { ClientSession, Db } from 'mongodb';
import {
  balanceTotals,
  administrationInputSchema,
  visitInputSchema,
  type BalanceEntry,
  type ClinicalDocument,
  type Purchase,
} from '@analiza/contracts';
import {
  applyStockDelta,
  assertSameRetry,
  canEditAssignedBalance,
  MongoOperationsRepository,
} from './mongo-operations';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  type ServerActor,
} from './mongo-patients';

const nurse: ServerActor = { userId: 'nurse-a', organizationId: 'org-a', role: 'NURSE' };
describe('assigned clinical operations', () => {
  // test-id: vitest:operations-assigned-balance
  it('allows only assigned nursing users or the organization administrator to edit', () => {
    expect(canEditAssignedBalance(nurse, ['nurse-a'])).toBe(true);
    expect(canEditAssignedBalance(nurse, ['nurse-b'])).toBe(false);
    expect(canEditAssignedBalance({ ...nurse, role: 'NURSE_MANAGER' }, [])).toBe(false);
    expect(canEditAssignedBalance({ ...nurse, role: 'FINANCE' }, ['nurse-a'])).toBe(false);
    expect(canEditAssignedBalance({ ...nurse, role: 'ADMIN' }, [])).toBe(true);
  });
  // test-id: vitest:operations-retry-integrity
  it('accepts identical retries but rejects changed quantities with the same key', () => {
    expect(() => assertSameRetry({ id: 'saved', quantity: 2 }, { quantity: 2 })).not.toThrow();
    expect(() => assertSameRetry({ quantity: 2 }, { quantity: 3 })).toThrow(MongoConflictError);
  });
  // test-id: vitest:operations-balance-corrections
  it('totals the latest observation while preserving both original and correction', () => {
    const base = {
      periodId: 'p',
      measuredAt: '2026-09-10T07:00:00Z',
      category: 'QA',
      actorUserId: 'a',
      createdAt: '2026-09-10T07:00:00Z',
      idempotencyKey: 'key',
    };
    const entries: BalanceEntry[] = [
      { ...base, id: 'original', direction: 'INTAKE', milliliters: 100 },
      {
        ...base,
        id: 'correction',
        direction: 'INTAKE',
        milliliters: 80,
        correctionOf: 'original',
        correctionReason: 'Error de captura',
      },
      { ...base, id: 'output', direction: 'OUTPUT', milliliters: 30 },
    ];
    expect(balanceTotals(entries)).toEqual({ intake: 80, output: 30, balance: 50 });
    expect(entries).toHaveLength(3);
  });
  // test-id: vitest:operations-stock-conditional
  it('performs a scoped conditional decrement and rejects insufficient stock', async () => {
    const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
    const balances = { findOne: vi.fn().mockResolvedValue({ quantity: 20 }), updateOne };
    const db = { collection: vi.fn().mockReturnValue(balances) } as unknown as Db;
    const session = {} as ClientSession;
    await applyStockDelta(db, session, nurse, 'item', 'central', -2);
    expect(updateOne).toHaveBeenCalledWith(
      { organizationId: 'org-a', itemId: 'item', warehouseId: 'central', quantity: { $gte: 2 } },
      { $inc: { quantity: -2 } },
      { session },
    );
    updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(applyStockDelta(db, session, nurse, 'item', 'central', -50)).rejects.toThrow(
      MongoInputError,
    );
  });
  it('rejects browser authority and requires a reference for a recorded sale', () => {
    const medication = {
      caseId: 'case',
      medicationId: 'med',
      doseId: 'dose',
      presentation: 'TABLET',
      quantity: 2,
      warehouseId: 'central',
      administeredAt: '2026-09-10T07:00:00Z',
      idempotencyKey: 'k',
    };
    expect(
      administrationInputSchema.safeParse({ ...medication, actorUserId: 'admin' }).success,
    ).toBe(false);
    expect(administrationInputSchema.safeParse({ ...medication, quantity: -1 }).success).toBe(
      false,
    );
    const visit = {
      professionalUserId: 'u',
      professionalName: 'QA',
      profession: 'NURSE',
      occurredAt: '2026-09-10T07:00:00Z',
      patientId: 'p',
      saleAmount: 10,
      saleReference: '',
      idempotencyKey: 'v',
    };
    expect(visitInputSchema.safeParse(visit).success).toBe(false);
    expect(visitInputSchema.safeParse({ ...visit, saleAmount: 0 }).success).toBe(true);
  });

  // test-id: vitest:operations-purchase-draft-tenant-audit
  it('persists an auditable purchase draft only against an active tenant catalog item', async () => {
    const purchase: Purchase = {
      id: 'purchase-synthetic-01',
      catalogItemId: 'item-synthetic-01',
      reference: 'PURCHASE-SYNTHETIC-01',
      note: 'Datos sintéticos',
      status: 'DRAFT',
      createdAt: '2026-09-10T07:00:00.000Z',
    };
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
      endSession: vi.fn(),
    };
    const purchaseFind = vi.fn().mockResolvedValue(null);
    const catalogFind = vi.fn().mockResolvedValue({
      id: purchase.catalogItemId,
      organizationId: 'org-a',
      status: 'ACTIVE',
    });
    const purchaseInsert = vi.fn().mockResolvedValue({ acknowledged: true });
    const auditInsert = vi.fn().mockResolvedValue({ acknowledged: true });
    const database = {
      client: { startSession: () => session },
      collection: vi.fn((name: string) => {
        if (name === 'purchases') return { findOne: purchaseFind, insertOne: purchaseInsert };
        if (name === 'catalogItems') return { findOne: catalogFind };
        if (name === 'auditEvents') return { insertOne: auditInsert };
        throw new Error(`Unexpected collection ${name}`);
      }),
    } as unknown as Db;
    const actor: ServerActor = {
      userId: 'inventory-user',
      organizationId: 'org-a',
      role: 'INVENTORY',
    };

    await expect(
      new MongoOperationsRepository(database).execute(actor, {
        command: 'purchase.create',
        purchase,
      }),
    ).resolves.toEqual({ id: purchase.id });
    expect(catalogFind).toHaveBeenCalledWith(
      { organizationId: 'org-a', id: purchase.catalogItemId, status: 'ACTIVE' },
      { session },
    );
    expect(purchaseInsert).toHaveBeenCalledWith(
      { ...purchase, organizationId: 'org-a' },
      { session },
    );
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-a',
        actorUserId: 'inventory-user',
        action: 'PURCHASE_DRAFT_CREATED',
        resourceId: purchase.id,
      }),
      { session },
    );
  });

  // test-id: vitest:operations-clinical-create-tenant-audit
  it('creates a clinical draft only for an active tenant hospitalization and audits it', async () => {
    const document: ClinicalDocument = {
      id: 'clinical-synthetic-01',
      caseId: 'case-synthetic-01',
      patientId: 'patient-synthetic-01',
      type: 'CARE_PLAN',
      title: 'Plan sintético',
      summary: 'Contenido sintético sin reglas clínicas.',
      author: 'Profesional QA',
      status: 'DRAFT',
      version: 1,
      createdAt: '2026-09-10T07:00:00.000Z',
    };
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
      endSession: vi.fn(),
    };
    const clinicalInsert = vi.fn().mockResolvedValue({ acknowledged: true });
    const auditInsert = vi.fn().mockResolvedValue({ acknowledged: true });
    const database = {
      client: { startSession: () => session },
      collection: vi.fn((name: string) => {
        if (name === 'hospitalizations')
          return {
            findOne: vi.fn().mockResolvedValue({
              id: document.caseId,
              patientId: document.patientId,
              organizationId: 'org-a',
              status: 'ACTIVE',
            }),
          };
        if (name === 'clinicalDocuments')
          return { findOne: vi.fn().mockResolvedValue(null), insertOne: clinicalInsert };
        if (name === 'auditEvents') return { insertOne: auditInsert };
        throw new Error(`Unexpected collection ${name}`);
      }),
    } as unknown as Db;

    await expect(
      new MongoOperationsRepository(database).execute(
        { userId: 'doctor-a', organizationId: 'org-a', role: 'DOCTOR' },
        { command: 'clinical.create', document },
      ),
    ).resolves.toEqual({ id: document.id });
    expect(clinicalInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        ...document,
        organizationId: 'org-a',
        createdBy: 'doctor-a',
        createdAt: expect.any(String),
      }),
      { session },
    );
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-a',
        action: 'CLINICAL_DOCUMENT_CREATED',
        resourceId: document.id,
      }),
      { session },
    );
  });

  // test-id: vitest:operations-clinical-sign-permission
  it('signs a draft atomically and denies a nurse signing authority', async () => {
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
      endSession: vi.fn(),
    };
    const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
    const auditInsert = vi.fn().mockResolvedValue({ acknowledged: true });
    const database = {
      client: { startSession: () => session },
      collection: vi.fn((name: string) => {
        if (name === 'clinicalDocuments')
          return {
            findOne: vi.fn().mockResolvedValue({
              id: 'clinical-synthetic-01',
              organizationId: 'org-a',
              status: 'DRAFT',
            }),
            updateOne,
          };
        if (name === 'auditEvents') return { insertOne: auditInsert };
        throw new Error(`Unexpected collection ${name}`);
      }),
    } as unknown as Db;
    const repository = new MongoOperationsRepository(database);

    await expect(
      repository.execute(
        { userId: 'doctor-a', organizationId: 'org-a', role: 'DOCTOR' },
        { command: 'clinical.sign', documentId: 'clinical-synthetic-01' },
      ),
    ).resolves.toEqual({ id: 'clinical-synthetic-01' });
    expect(updateOne).toHaveBeenCalledWith(
      { organizationId: 'org-a', id: 'clinical-synthetic-01', status: 'DRAFT' },
      {
        $set: {
          status: 'SIGNED',
          signedAt: expect.any(String),
          signedBy: 'doctor-a',
        },
      },
      { session },
    );
    await expect(
      repository.execute(nurse, {
        command: 'clinical.sign',
        documentId: 'clinical-synthetic-01',
      }),
    ).rejects.toThrow(MongoAccessError);
  });

  // test-id: vitest:operations-clinical-correction-immutable
  it('creates a versioned correction without updating the signed original', async () => {
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
      endSession: vi.fn(),
    };
    const original = {
      id: 'clinical-synthetic-01',
      organizationId: 'org-a',
      caseId: 'case-synthetic-01',
      patientId: 'patient-synthetic-01',
      type: 'CLINICAL_EVOLUTION',
      title: 'Evolución sintética',
      summary: 'Versión firmada',
      author: 'Profesional QA',
      status: 'SIGNED',
      version: 1,
    };
    const findOne = vi.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(null);
    const insertOne = vi.fn().mockResolvedValue({ acknowledged: true });
    const auditInsert = vi.fn().mockResolvedValue({ acknowledged: true });
    const updateOne = vi.fn();
    const database = {
      client: { startSession: () => session },
      collection: vi.fn((name: string) => {
        if (name === 'clinicalDocuments')
          return {
            findOne,
            find: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue([{ version: 1 }, { version: 2 }]),
            }),
            insertOne,
            updateOne,
          };
        if (name === 'auditEvents') return { insertOne: auditInsert };
        throw new Error(`Unexpected collection ${name}`);
      }),
    } as unknown as Db;

    await expect(
      new MongoOperationsRepository(database).execute(
        { userId: 'doctor-a', organizationId: 'org-a', role: 'DOCTOR' },
        {
          command: 'clinical.correct',
          documentId: original.id,
          correctionId: 'clinical-synthetic-02',
          reason: 'Corrección sintética de QA',
          summary: 'Nueva versión sintética',
          author: 'Profesional QA',
        },
      ),
    ).resolves.toEqual({ id: 'clinical-synthetic-02' });
    expect(updateOne).not.toHaveBeenCalled();
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'clinical-synthetic-02',
        organizationId: 'org-a',
        correctionOf: original.id,
        correctionReason: 'Corrección sintética de QA',
        status: 'DRAFT',
        version: 3,
      }),
      { session },
    );
  });
});
