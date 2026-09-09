import { describe, expect, it, vi } from 'vitest';
import type { InventoryMovement, Payment } from '@analiza/contracts';
import { MongoAccessError, MongoInputError, type ServerActor } from './mongo-patients';
import { MongoFinancialRepository, type FinancialDatabase } from './mongo-financial';

const finance: ServerActor = { userId: 'finance-user', organizationId: 'org-a', role: 'FINANCE' };
const inventory: ServerActor = {
  userId: 'inventory-user',
  organizationId: 'org-a',
  role: 'INVENTORY',
};
const payment: Payment = {
  id: 'payment-synthetic-01',
  quoteId: 'quote-synthetic-01',
  amount: 12,
  reference: 'REF-SYN-01',
  idempotencyKey: 'payment-command-01',
  status: 'APPLIED',
  createdAt: '2026-09-09T12:00:00.000Z',
};
const movement: InventoryMovement = {
  id: 'movement-synthetic-01',
  itemId: 'item-synthetic-01',
  createdAt: '2026-09-09T12:00:00.000Z',
  kind: 'ENTRY',
  quantity: 2,
  reason: 'Ingreso sintético',
};

function database(existingPayment: Payment | null = null): FinancialDatabase & {
  insert: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
} {
  const insert = vi.fn(async () => ({ acknowledged: true }));
  const find = vi.fn(async () => existingPayment);
  const transaction = vi.fn(async (callback: () => Promise<unknown>) => callback());
  const collection = { findOne: find, insertOne: insert };
  return {
    collection: vi.fn(() => collection),
    client: { startSession: () => ({ withTransaction: transaction, endSession: vi.fn() }) },
    insert,
    find,
    transaction,
  } as unknown as FinancialDatabase & {
    insert: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
}

describe('Mongo financial command repository', () => {
  // test-id: vitest:m02-payment-atomic-idempotent-audit
  it('applies a tenant-scoped payment once with a server-authored audit event in one transaction', async () => {
    const store = database();
    const repository = new MongoFinancialRepository(store);
    await expect(
      repository.applyPayment(
        finance,
        { payment, idempotencyKey: payment.idempotencyKey },
        new Date('2026-09-09T12:01:00.000Z'),
      ),
    ).resolves.toEqual(payment);
    expect(store.transaction).toHaveBeenCalledTimes(1);
    expect(store.find).toHaveBeenCalledWith({
      organizationId: 'org-a',
      idempotencyKey: payment.idempotencyKey,
    });
    expect(store.insert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ ...payment, organizationId: 'org-a' }),
    );
    expect(store.insert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        organizationId: 'org-a',
        actorUserId: 'finance-user',
        action: 'PAYMENT_APPLIED',
      }),
    );
  });

  // test-id: vitest:m02-payment-retry-no-duplicate
  it('returns the existing payment on an idempotent retry and does not append audit twice', async () => {
    const store = database({ ...payment, organizationId: 'org-a' } as Payment);
    const repository = new MongoFinancialRepository(store);
    await expect(
      repository.applyPayment(finance, { payment, idempotencyKey: payment.idempotencyKey }),
    ).resolves.toEqual(payment);
    expect(store.insert).not.toHaveBeenCalled();
  });

  // test-id: vitest:m02-inventory-atomic-idempotent-audit
  it('records one inventory document rather than mutating a browser array', async () => {
    const store = database();
    const repository = new MongoFinancialRepository(store);
    await expect(
      repository.recordInventoryMovement(inventory, {
        movement,
        idempotencyKey: 'movement-command-01',
      }),
    ).resolves.toEqual(movement);
    expect(store.find).toHaveBeenCalledWith({
      organizationId: 'org-a',
      idempotencyKey: 'movement-command-01',
    });
    expect(store.insert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        ...movement,
        organizationId: 'org-a',
        idempotencyKey: 'movement-command-01',
      }),
    );
  });

  // test-id: vitest:m02-financial-authority-reject
  it('rejects browser authority/operators and roles without the command permission', async () => {
    const repository = new MongoFinancialRepository(database());
    await expect(
      repository.applyPayment(finance, {
        payment,
        idempotencyKey: payment.idempotencyKey,
        actor: { role: 'ADMIN' },
      }),
    ).rejects.toBeInstanceOf(MongoInputError);
    await expect(
      repository.applyPayment(inventory, { payment, idempotencyKey: payment.idempotencyKey }),
    ).rejects.toBeInstanceOf(MongoAccessError);
    await expect(
      repository.recordInventoryMovement(inventory, { movement, idempotencyKey: '$bad' }),
    ).resolves.toEqual(movement);
    await expect(
      repository.recordInventoryMovement(inventory, {
        movement,
        idempotencyKey: 'command-02',
        filter: { $where: 'x' },
      }),
    ).rejects.toBeInstanceOf(MongoInputError);
  });
});
