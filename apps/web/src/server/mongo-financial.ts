import {
  inventoryMovementSchema,
  paymentSchema,
  type InventoryMovement,
  type Payment,
} from '@analiza/contracts';
import { can } from '@/lib/permissions';
import {
  MongoAccessError,
  MongoInputError,
  rejectBrowserAuthority,
  type ServerActor,
} from './mongo-patients';

type AuditEvent = Readonly<{
  id: string;
  organizationId: string;
  actorUserId: string;
  action: 'PAYMENT_APPLIED' | 'INVENTORY_MOVEMENT_RECORDED';
  resourceType: 'payment' | 'inventoryMovement';
  resourceId: string;
  occurredAt: Date;
}>;

type CommandCollection<T> = {
  findOne(filter: Record<string, unknown>, options?: Record<string, unknown>): Promise<T | null>;
  insertOne(document: T, options?: Record<string, unknown>): Promise<unknown>;
};

type TransactionSession = {
  withTransaction<T>(callback: () => Promise<T>): Promise<T>;
  endSession(): Promise<void> | void;
};

export type FinancialDatabase = {
  collection<T>(name: 'payments' | 'inventoryMovements' | 'auditEvents'): CommandCollection<T>;
  client: { startSession(): TransactionSession };
};

type StoredPayment = Payment & { organizationId: string };
type StoredInventoryMovement = InventoryMovement & {
  organizationId: string;
  idempotencyKey: string;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MongoInputError();
  }
  return value as Record<string, unknown>;
}

function assertCommandKeys(body: Record<string, unknown>) {
  if (
    Object.keys(body).some(
      (key) => key !== 'payment' && key !== 'movement' && key !== 'idempotencyKey',
    )
  ) {
    throw new MongoInputError();
  }
  if (typeof body.idempotencyKey !== 'string' || !body.idempotencyKey.trim()) {
    throw new MongoInputError('La clave de idempotencia es obligatoria.');
  }
}

export function parsePaymentCommand(input: unknown): Payment {
  rejectBrowserAuthority(input);
  const body = object(input);
  assertCommandKeys(body);
  if (!('payment' in body) || 'movement' in body) throw new MongoInputError();
  const payment = paymentSchema.strict().parse(body.payment);
  if (payment.idempotencyKey !== body.idempotencyKey) {
    throw new MongoInputError('La clave de pago no coincide con el comando.');
  }
  if (payment.status !== 'APPLIED')
    throw new MongoInputError('El alta de pago debe iniciar aplicada.');
  return payment;
}

export function parseInventoryMovementCommand(input: unknown): {
  movement: InventoryMovement;
  idempotencyKey: string;
} {
  rejectBrowserAuthority(input);
  const body = object(input);
  assertCommandKeys(body);
  if (!('movement' in body) || 'payment' in body) throw new MongoInputError();
  return {
    movement: inventoryMovementSchema.strict().parse(body.movement),
    idempotencyKey: body.idempotencyKey as string,
  };
}

function auditEvent(
  actor: ServerActor,
  resourceType: AuditEvent['resourceType'],
  resourceId: string,
  occurredAt: Date,
): AuditEvent {
  return {
    id: crypto.randomUUID(),
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action: resourceType === 'payment' ? 'PAYMENT_APPLIED' : 'INVENTORY_MOVEMENT_RECORDED',
    resourceType,
    resourceId,
    occurredAt,
  };
}

/**
 * Command-only financial repository. Each operation is one transaction, idempotency is scoped to
 * the tenant, and the audit actor is derived from the server session rather than the request.
 */
export class MongoFinancialRepository {
  constructor(private readonly database: FinancialDatabase) {}

  async applyPayment(actor: ServerActor, input: unknown, now = new Date()): Promise<Payment> {
    if (!can(actor.role, 'payments:write')) throw new MongoAccessError();
    const payment = parsePaymentCommand(input);
    const payments = this.database.collection<StoredPayment>('payments');
    const audits = this.database.collection<AuditEvent>('auditEvents');
    const session = this.database.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const existing = await payments.findOne({
          organizationId: actor.organizationId,
          idempotencyKey: payment.idempotencyKey,
        });
        if (existing) return paymentSchema.parse(existing);
        const stored: StoredPayment = { ...payment, organizationId: actor.organizationId };
        await payments.insertOne(stored);
        await audits.insertOne(auditEvent(actor, 'payment', payment.id, now));
        return paymentSchema.parse(stored);
      });
    } finally {
      await session.endSession();
    }
  }

  async recordInventoryMovement(
    actor: ServerActor,
    input: unknown,
    now = new Date(),
  ): Promise<InventoryMovement> {
    if (!can(actor.role, 'inventory:write')) throw new MongoAccessError();
    const { movement, idempotencyKey } = parseInventoryMovementCommand(input);
    const movements = this.database.collection<StoredInventoryMovement>('inventoryMovements');
    const audits = this.database.collection<AuditEvent>('auditEvents');
    const session = this.database.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const existing = await movements.findOne({
          organizationId: actor.organizationId,
          idempotencyKey,
        });
        if (existing) return inventoryMovementSchema.parse(existing);
        const stored: StoredInventoryMovement = {
          ...movement,
          organizationId: actor.organizationId,
          idempotencyKey,
        };
        await movements.insertOne(stored);
        await audits.insertOne(auditEvent(actor, 'inventoryMovement', movement.id, now));
        return inventoryMovementSchema.parse(stored);
      });
    } finally {
      await session.endSession();
    }
  }
}

export const mongoFinancialIndexes = [
  {
    collection: 'payments',
    key: { organizationId: 1, idempotencyKey: 1 },
    name: 'payments_org_idempotency_unique',
    unique: true,
  },
  {
    collection: 'inventoryMovements',
    key: { organizationId: 1, idempotencyKey: 1 },
    name: 'inventory_movements_org_idempotency_unique',
    unique: true,
  },
  {
    collection: 'auditEvents',
    key: { organizationId: 1, occurredAt: -1 },
    name: 'audit_events_org_occurred_at',
  },
] as const;
