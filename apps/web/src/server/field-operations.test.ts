import { describe, expect, it, vi } from 'vitest';
import type { Db } from 'mongodb';
import { MongoConflictError } from './mongo-patients';
import { MongoOperationsRepository } from './mongo-operations';

const actor = {
  userId: 'synthetic-inventory',
  organizationId: 'synthetic-org',
  role: 'INVENTORY' as const,
};
const session = {
  withTransaction: async (callback: () => Promise<unknown>) => callback(),
  endSession: vi.fn(),
};
const custody = {
  id: 'custody-qa',
  patientId: 'patient-qa',
  itemId: 'item-qa',
  warehouseId: 'warehouse-qa',
  addressLine: 'Dirección sintética QA',
  quantity: 5,
  sentAt: '2026-10-07T12:00:00.000Z',
  reference: 'ACUSE-QA',
  idempotencyKey: 'custody-qa',
  status: 'OPEN',
  dispatchedBy: actor.userId,
  returnedQuantity: 0,
  traceAllocations: [],
};

describe('home return safeguards', () => {
  // test-id: vitest:home-return-quarantine
  it('closes a custody and holds returned units without increasing sellable stock', async () => {
    const stockUpdate = vi.fn();
    const holdInsert = vi.fn().mockResolvedValue({ acknowledged: true });
    const custodyUpdate = vi.fn().mockResolvedValue({ modifiedCount: 1 });
    const database = {
      client: { startSession: () => session },
      collection: vi.fn((name: string) => {
        if (name === 'homeCustodies')
          return { findOne: vi.fn().mockResolvedValue(custody), updateOne: custodyUpdate };
        if (name === 'homeReturnHolds') return { insertOne: holdInsert };
        if (name === 'inventoryBalances') return { updateOne: stockUpdate };
        if (name === 'auditEvents')
          return { insertOne: vi.fn().mockResolvedValue({ acknowledged: true }) };
        throw new Error(`Unexpected collection ${name}`);
      }),
    } as unknown as Db;
    const result = await new MongoOperationsRepository(database).execute(actor, {
      command: 'home.close',
      closure: {
        custodyId: custody.id,
        returnedQuantity: 2,
        receivedAt: '2026-10-08T12:00:00.000Z',
        conditionNote: 'Empaque intacto; pendiente de calidad',
        idempotencyKey: 'close-qa',
      },
    });
    expect(result).toMatchObject({ status: 'CLOSED', returnedQuantity: 2 });
    expect(holdInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        custodyId: custody.id,
        quantity: 2,
        organizationId: actor.organizationId,
      }),
      expect.objectContaining({ session }),
    );
    expect(custodyUpdate).toHaveBeenCalledOnce();
    expect(stockUpdate).not.toHaveBeenCalled();
  });
  it('rejects a return larger than the sent quantity', async () => {
    const database = {
      client: { startSession: () => session },
      collection: vi.fn((name: string) =>
        name === 'homeCustodies'
          ? { findOne: vi.fn().mockResolvedValue(custody) }
          : { insertOne: vi.fn() },
      ),
    } as unknown as Db;
    await expect(
      new MongoOperationsRepository(database).execute(actor, {
        command: 'home.close',
        closure: {
          custodyId: custody.id,
          returnedQuantity: 6,
          receivedAt: '2026-10-08T12:00:00.000Z',
          conditionNote: 'QA',
          idempotencyKey: 'close-too-many',
        },
      }),
    ).rejects.toThrow('La devolución no puede exceder lo enviado.');
  });
});

describe('confirmed sale reference', () => {
  // test-id: vitest:confirmed-sale-unique-reference
  it('rejects the same reference even with a different idempotency key', async () => {
    const insert = vi.fn();
    const database = {
      client: { startSession: () => session },
      collection: vi.fn((name: string) => {
        if (name === 'memberships') return { findOne: vi.fn().mockResolvedValue(null) };
        if (name === 'confirmedSales')
          return {
            findOne: vi.fn(async (filter: { referenceNormalized?: string }) =>
              filter.referenceNormalized ? { id: 'prior' } : null,
            ),
            insertOne: insert,
          };
        throw new Error(`Unexpected collection ${name}`);
      }),
    } as unknown as Db;
    await expect(
      new MongoOperationsRepository(database).execute(
        { ...actor, role: 'FINANCE' },
        {
          command: 'sale.confirmed.record',
          sale: {
            id: 'sale-new',
            occurredAt: '2026-10-08T12:00:00.000Z',
            reference: 'venta-qa',
            amount: 20.5,
            category: 'EQUIPMENT',
            idempotencyKey: 'sale-new',
          },
        },
      ),
    ).rejects.toThrow(MongoConflictError);
    expect(insert).not.toHaveBeenCalled();
  });
});
