import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ClientSession, Db } from 'mongodb';
import {
  administrationInputSchema,
  administrationSchema,
  balanceEntryInputSchema,
  balanceEntrySchema,
  balancePeriodSchema,
  configurationEntrySchema,
  emptyOperations,
  goalInputSchema,
  goalSchema,
  visitInputSchema,
  visitSchema,
  nursingResourceSchema,
  type OperationsSnapshot,
  paymentSchema,
  catalogItemSchema,
  clinicalDocumentSchema,
  inventoryMovementSchema,
  inventoryFefoIssueSchema,
  inventoryTraceReceiptSchema,
  inventoryTraceRecordSchema,
  inventoryTraceStatusChangeSchema,
  purchaseSchema,
  warehouseInputSchema,
  warehouseSchema,
  warehouseTransferSchema,
} from '@analiza/contracts';
import { can } from '@/lib/permissions';
import { normalizePurchaseTraceability } from '@/lib/purchase-catalog';
import { hashPassword } from './mongo-auth';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  rejectBrowserAuthority,
  type ServerActor,
} from './mongo-patients';

const identifier = z.string().trim().min(1).max(120);
const commands = z.discriminatedUnion('command', [
  z.object({ command: z.literal('catalog.create'), item: catalogItemSchema.strict() }).strict(),
  z.object({ command: z.literal('catalog.save'), item: catalogItemSchema.strict() }).strict(),
  z.object({ command: z.literal('warehouse.save'), warehouse: warehouseInputSchema }).strict(),
  z
    .object({ command: z.literal('inventory.transfer'), transfer: warehouseTransferSchema })
    .strict(),
  z
    .object({ command: z.literal('inventory.trace.receive'), receipt: inventoryTraceReceiptSchema })
    .strict(),
  z
    .object({
      command: z.literal('inventory.trace.status'),
      change: inventoryTraceStatusChangeSchema,
    })
    .strict(),
  z
    .object({ command: z.literal('inventory.trace.issue'), issue: inventoryFefoIssueSchema })
    .strict(),
  z
    .object({
      command: z.literal('inventory.record'),
      movement: inventoryMovementSchema.strict(),
      idempotencyKey: identifier,
    })
    .strict(),
  z.object({ command: z.literal('payment.apply'), payment: paymentSchema.strict() }).strict(),
  z.object({ command: z.literal('purchase.create'), purchase: purchaseSchema.strict() }).strict(),
  z
    .object({ command: z.literal('clinical.create'), document: clinicalDocumentSchema.strict() })
    .strict(),
  z.object({ command: z.literal('clinical.sign'), documentId: identifier }).strict(),
  z
    .object({
      command: z.literal('clinical.correct'),
      documentId: identifier,
      correctionId: identifier,
      reason: z.string().trim().min(1).max(2000),
      summary: z.string().trim().min(1).max(12000),
      author: z.string().trim().min(1).max(240),
    })
    .strict(),
  z
    .object({
      command: z.literal('payment.void'),
      paymentId: identifier,
      reason: z.string().trim().min(1).max(1000),
    })
    .strict(),
  z.object({ command: z.literal('configuration.save'), entry: configurationEntrySchema }).strict(),
  z
    .object({
      command: z.literal('nurse.create'),
      email: z.email(),
      password: z.string().min(12).max(1024),
      role: z.enum(['ADMIN', 'MANAGER', 'NURSE_MANAGER', 'NURSE']).default('NURSE'),
      resource: nursingResourceSchema.omit({ userId: true }).strict(),
    })
    .strict(),
  z
    .object({
      command: z.literal('balance.open'),
      caseId: identifier,
      startsAt: z.iso.datetime({ offset: true }),
      endsAt: z.iso.datetime({ offset: true }),
      idempotencyKey: identifier,
    })
    .strict(),
  z.object({ command: z.literal('balance.append'), entry: balanceEntryInputSchema }).strict(),
  z
    .object({
      command: z.literal('balance.close'),
      periodId: identifier,
      handoff: z.string().trim().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      command: z.literal('medication.administer'),
      administration: administrationInputSchema,
    })
    .strict(),
  z.object({ command: z.literal('visit.create'), visit: visitInputSchema }).strict(),
  z.object({ command: z.literal('goal.save'), goal: goalInputSchema }).strict(),
]);

export function canEditAssignedBalance(actor: ServerActor, assignedUsers: readonly string[]) {
  return (
    actor.role === 'ADMIN' ||
    (can(actor.role, 'nursing:write') && assignedUsers.includes(actor.userId))
  );
}

/** A retry may repeat the operation, never silently change its meaning. */
export function assertSameRetry(
  previous: Record<string, unknown>,
  input: Record<string, unknown>,
  fields: readonly string[] = Object.keys(input),
) {
  if (
    fields.some(
      (key) => JSON.stringify(previous[key] ?? null) !== JSON.stringify(input[key] ?? null),
    )
  )
    throw new MongoConflictError();
}

export class MongoOperationsRepository {
  constructor(private readonly database: Db) {}

  async list(actor: ServerActor): Promise<OperationsSnapshot> {
    const result = emptyOperations();
    const query = { organizationId: actor.organizationId };
    const read = async (collection: string) =>
      this.database.collection(collection).find(query).toArray();
    await Promise.all([
      can(actor.role, 'reports:read')
        ? this.database
            .collection('memberships')
            .find({
              ...query,
              active: true,
              role: { $in: ['ADMIN', 'NURSE', 'NURSE_MANAGER', 'DOCTOR'] },
            })
            .toArray()
            .then(async (memberships) => {
              const ids = memberships.map((row) => row.userId);
              const [users, resources] = await Promise.all([
                this.database
                  .collection('users')
                  .find({ id: { $in: ids } }, { projection: { id: 1, displayName: 1 } })
                  .toArray(),
                this.database.collection('nursingResources').find(query).toArray(),
              ]);
              result.professionals = memberships.map((member) => ({
                userId: member.userId,
                name:
                  resources.find((row) => row.userId === member.userId)?.displayName ??
                  users.find((row) => row.id === member.userId)?.displayName ??
                  'Profesional registrado',
                profession: member.role === 'DOCTOR' ? 'DOCTOR' : 'NURSE',
              }));
            })
        : undefined,
      can(actor.role, 'catalogs:read') || can(actor.role, 'clinical:read')
        ? read('configurationEntries').then((rows) => {
            result.configuration = rows.map((row) =>
              configurationEntrySchema.parse({
                id: row.id,
                category: row.category,
                label: row.label,
                active: row.active,
                discountPercent: row.discountPercent,
                inventoryItemId: row.inventoryItemId,
                tabletsPerBlister: row.tabletsPerBlister,
                tabletsPerBox: row.tabletsPerBox,
              }),
            );
          })
        : undefined,
      process.env.NEXT_PUBLIC_RELEASE_PROFILE !== 'core' && can(actor.role, 'clinical:read')
        ? Promise.all([
            read('balancePeriods').then((rows) => {
              result.periods = rows.map((row) => balancePeriodSchema.parse(row));
            }),
            read('balanceEntries').then((rows) => {
              result.balanceEntries = rows.map((row) => balanceEntrySchema.strip().parse(row));
            }),
            read('medicationAdministrations').then((rows) => {
              result.administrations = rows.map((row) => administrationSchema.strip().parse(row));
            }),
          ])
        : undefined,
      process.env.NEXT_PUBLIC_RELEASE_PROFILE !== 'core' && can(actor.role, 'reports:read')
        ? Promise.all([
            read('homeVisits').then((rows) => {
              result.visits = rows.map((row) => visitSchema.strip().parse(row));
            }),
            read('visitGoals').then((rows) => {
              result.goals = rows.map((row) => goalSchema.strip().parse(row));
            }),
          ])
        : undefined,
      can(actor.role, 'inventory:read')
        ? read('warehouses').then((rows) => {
            result.warehouses = rows
              .map((row) => warehouseSchema.strip().parse(row))
              .sort(
                (left, right) =>
                  Number(left.status === 'INACTIVE') - Number(right.status === 'INACTIVE') ||
                  left.name.localeCompare(right.name, 'es'),
              );
          })
        : undefined,
      can(actor.role, 'inventory:read')
        ? Promise.all([read('inventoryTraceRecords'), read('inventoryTraceBalances')]).then(
            ([records, balances]) => {
              result.traceRecords = records
                .map((record) =>
                  inventoryTraceRecordSchema.parse({
                    id: record.id,
                    kind: record.kind,
                    itemId: record.itemId,
                    supplierCatalogItemId: record.supplierCatalogItemId,
                    number: record.number,
                    receivedQuantity: record.receivedQuantity,
                    manufacturedOn: record.manufacturedOn,
                    expiresOn: record.expiresOn,
                    receiptReference: record.receiptReference,
                    qualityStatus: record.qualityStatus,
                    receivedAt: record.receivedAt,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt,
                    balances: balances
                      .filter((balance) => balance.traceRecordId === record.id)
                      .map((balance) => ({
                        warehouseId: String(balance.warehouseId),
                        quantity: Number(balance.quantity),
                      })),
                  }),
                )
                .sort(
                  (left, right) =>
                    right.receivedAt.localeCompare(left.receivedAt) ||
                    left.id.localeCompare(right.id),
                );
            },
          )
        : undefined,
    ]);
    return result;
  }

  private async requireAssignedCase(actor: ServerActor, caseId: string, session: ClientSession) {
    if (!can(actor.role, 'clinical:read')) throw new MongoAccessError();
    const caseRecord = await this.database
      .collection('hospitalizations')
      .findOne({ id: caseId, organizationId: actor.organizationId }, { session });
    if (!caseRecord || !canEditAssignedBalance(actor, caseRecord.assignedNurseUserIds ?? []))
      throw new MongoAccessError();
    if (caseRecord.status === 'CLOSED')
      throw new MongoInputError('La hospitalización está cerrada.');
    // Touch the case in the transaction: concurrent reassignment/closure must invalidate this write.
    await this.database
      .collection('hospitalizations')
      .updateOne({ _id: caseRecord._id }, { $inc: { clinicalWriteSequence: 1 } }, { session });
    return caseRecord;
  }

  async execute(actor: ServerActor, raw: unknown) {
    rejectBrowserAuthority(raw);
    const parsed = commands.safeParse(raw);
    if (!parsed.success) throw new MongoInputError('Revise los campos y valores obligatorios.');
    const input = parsed.data;
    const session = this.database.client.startSession();
    const scoped = { organizationId: actor.organizationId };
    const audit = async (action: string, resourceId: string) =>
      this.database.collection('auditEvents').insertOne(
        {
          id: randomUUID(),
          ...scoped,
          actorUserId: actor.userId,
          action,
          resourceId,
          occurredAt: new Date(),
        },
        { session },
      );
    const permission = (value: Parameters<typeof can>[1]) => {
      if (!can(actor.role, value)) throw new MongoAccessError();
    };
    try {
      return await session.withTransaction(async () => {
        if (input.command === 'catalog.create') {
          permission('catalogs:write');
          const skuNormalized = input.item.sku.toUpperCase();
          if (
            await this.database
              .collection('catalogItems')
              .findOne({ ...scoped, $or: [{ id: input.item.id }, { skuNormalized }] }, { session })
          )
            throw new MongoConflictError();
          await this.database
            .collection('catalogItems')
            .insertOne({ ...input.item, ...scoped, skuNormalized }, { session });
          await audit('CATALOG_ITEM_CREATED', input.item.id);
          return { id: input.item.id };
        }
        if (input.command === 'catalog.save') {
          permission('catalogs:write');
          const skuNormalized = input.item.sku.toUpperCase();
          const duplicate = await this.database
            .collection('catalogItems')
            .findOne({ ...scoped, skuNormalized, id: { $ne: input.item.id } }, { session });
          if (duplicate) throw new MongoConflictError();
          await this.database
            .collection('catalogItems')
            .updateOne(
              { ...scoped, id: input.item.id },
              { $set: { ...input.item, ...scoped, skuNormalized, updatedAt: new Date() } },
              { upsert: true, session },
            );
          await audit('CATALOG_ITEM_SAVED', input.item.id);
          return { id: input.item.id };
        }
        if (input.command === 'warehouse.save') {
          permission('inventory:write');
          const submitted = input.warehouse;
          const existing = await this.database
            .collection('warehouses')
            .findOne({ ...scoped, id: submitted.id }, { session });
          if (!existing && submitted.status !== 'ACTIVE')
            throw new MongoInputError('Una bodega nueva debe iniciar activa.');
          const codeNormalized = submitted.code.toUpperCase();
          if (
            await this.database
              .collection('warehouses')
              .findOne({ ...scoped, codeNormalized, id: { $ne: submitted.id } }, { session })
          )
            throw new MongoConflictError();
          if (existing && submitted.status === 'INACTIVE') {
            const movements = await this.database
              .collection('inventoryMovements')
              .find({ ...scoped, warehouseId: submitted.id }, { session })
              .toArray();
            const balances = new Map<string, number>();
            for (const movement of movements) {
              const delta =
                movement.kind === 'TRANSFER'
                  ? movement.transferDirection === 'IN'
                    ? movement.quantity
                    : -movement.quantity
                  : movement.kind === 'ENTRY' || movement.kind === 'RETURN'
                    ? movement.quantity
                    : movement.kind === 'EXIT' || movement.adjustmentDirection === 'OUT'
                      ? -movement.quantity
                      : movement.quantity;
              balances.set(movement.itemId, (balances.get(movement.itemId) ?? 0) + delta);
            }
            const tracedBalance = await this.database
              .collection('inventoryTraceBalances')
              .findOne({ ...scoped, warehouseId: submitted.id, quantity: { $gt: 0 } }, { session });
            if ([...balances.values()].some((balance) => balance !== 0) || tracedBalance)
              throw new MongoInputError(
                'Traslade o ajuste todas las existencias antes de desactivar la bodega.',
              );
          }
          const now = new Date().toISOString();
          const warehouse = warehouseSchema.parse({
            ...submitted,
            code: codeNormalized,
            description: submitted.description || undefined,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          });
          await this.database
            .collection('warehouses')
            .updateOne(
              { ...scoped, id: warehouse.id },
              { $set: { ...warehouse, ...scoped, codeNormalized } },
              { upsert: true, session },
            );
          await audit(
            !existing
              ? 'WAREHOUSE_CREATED'
              : existing.status !== warehouse.status && warehouse.status === 'INACTIVE'
                ? 'WAREHOUSE_DEACTIVATED'
                : 'WAREHOUSE_UPDATED',
            warehouse.id,
          );
          return warehouse;
        }
        if (input.command === 'inventory.trace.receive') {
          permission('inventory:write');
          const receipt = input.receipt;
          if (receipt.purchaseId) permission('purchases:write');
          const previous = await this.database
            .collection('inventoryTraceEvents')
            .findOne({ ...scoped, idempotencyKey: receipt.idempotencyKey }, { session });
          if (previous) {
            assertSameRetry(previous.body as Record<string, unknown>, receipt);
            const existing = await this.database
              .collection('inventoryTraceRecords')
              .findOne({ ...scoped, id: receipt.id }, { session });
            if (!existing) throw new MongoConflictError();
            return existing;
          }
          const linkedPurchase = receipt.purchaseId
            ? await this.database
                .collection('purchases')
                .findOne({ ...scoped, id: receipt.purchaseId }, { session })
            : null;
          const purchase = linkedPurchase ? purchaseSchema.parse(linkedPurchase) : null;
          if (receipt.purchaseId && (!purchase || purchase.status !== 'DRAFT'))
            throw new MongoInputError('La compra no está pendiente de recepción.');
          if (
            purchase &&
            (purchase.catalogItemId !== receipt.itemId ||
              purchase.supplierCatalogItemId !== receipt.supplierCatalogItemId ||
              purchase.warehouseId !== receipt.warehouseId ||
              purchase.reference !== receipt.receiptReference ||
              purchase.quantity !== receipt.quantity ||
              (purchase.serialNumber ?? purchase.lotNumber)?.toUpperCase() !==
                receipt.number.toUpperCase() ||
              (purchase.expirationDate ?? undefined) !== (receipt.expiresOn ?? undefined))
          )
            throw new MongoInputError('La recepción no coincide con el borrador de compra.');
          const item = await this.database.collection('catalogItems').findOne(
            {
              ...scoped,
              id: receipt.itemId,
              status: 'ACTIVE',
              category: { $in: ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'] },
            },
            { session },
          );
          const expectedKind = item?.category === 'EQUIPMENT' ? 'SERIAL' : 'LOT';
          if (!item || receipt.kind !== expectedKind)
            throw new MongoInputError(
              'Medicamentos e insumos usan lote; los equipos usan un número de serie por unidad.',
            );
          const [supplier, warehouse] = await Promise.all([
            this.database.collection('catalogItems').findOne(
              {
                ...scoped,
                id: receipt.supplierCatalogItemId,
                status: 'ACTIVE',
                category: 'PROVIDERS',
              },
              { session },
            ),
            this.database
              .collection('warehouses')
              .findOne({ ...scoped, id: receipt.warehouseId, status: 'ACTIVE' }, { session }),
          ]);
          if (!supplier) throw new MongoInputError('Seleccione un proveedor activo.');
          if (!warehouse) throw new MongoInputError('Seleccione una bodega activa.');
          const now = new Date().toISOString();
          const record = inventoryTraceRecordSchema.parse({
            id: receipt.id,
            kind: receipt.kind,
            itemId: receipt.itemId,
            supplierCatalogItemId: receipt.supplierCatalogItemId,
            number: receipt.number.toUpperCase(),
            receivedQuantity: receipt.quantity,
            manufacturedOn: receipt.manufacturedOn,
            expiresOn: receipt.kind === 'LOT' ? receipt.expiresOn : undefined,
            receiptReference: receipt.receiptReference,
            qualityStatus: 'QUARANTINED',
            receivedAt: receipt.receivedAt,
            createdAt: now,
            updatedAt: now,
            balances: [{ warehouseId: receipt.warehouseId, quantity: receipt.quantity }],
          });
          await this.database.collection('inventoryTraceRecords').insertOne(
            {
              ...record,
              balances: undefined,
              numberNormalized: record.number.toUpperCase(),
              ...scoped,
            },
            { session },
          );
          await this.database.collection('inventoryTraceBalances').insertOne(
            {
              ...scoped,
              traceRecordId: record.id,
              warehouseId: receipt.warehouseId,
              quantity: receipt.quantity,
              updatedAt: now,
            },
            { session },
          );
          await this.database.collection('inventoryTraceEvents').insertOne(
            {
              ...scoped,
              id: receipt.id,
              traceRecordId: record.id,
              eventType: 'RECEIVED',
              idempotencyKey: receipt.idempotencyKey,
              body: receipt,
              occurredAt: receipt.receivedAt,
            },
            { session },
          );
          if (purchase) {
            const updated = await this.database.collection('purchases').updateOne(
              { ...scoped, id: purchase.id, status: 'DRAFT' },
              {
                $set: {
                  status: 'RECEIVED',
                  receivedAt: receipt.receivedAt,
                  traceRecordId: record.id,
                },
              },
              { session },
            );
            if (updated.modifiedCount !== 1) throw new MongoConflictError();
            await audit('PURCHASE_RECEIVED', purchase.id);
          }
          await audit('INVENTORY_TRACE_RECEIVED', record.id);
          return record;
        }
        if (input.command === 'inventory.trace.status') {
          permission('inventory:write');
          const change = input.change;
          const previous = await this.database
            .collection('inventoryTraceEvents')
            .findOne({ ...scoped, idempotencyKey: change.idempotencyKey }, { session });
          if (previous) {
            assertSameRetry(previous.body as Record<string, unknown>, change);
            return { id: change.recordId };
          }
          const record = await this.database
            .collection('inventoryTraceRecords')
            .findOne({ ...scoped, id: change.recordId }, { session });
          if (!record) throw new MongoInputError('El lote o serie no está disponible.');
          const allowed: Record<string, string[]> = {
            QUARANTINED: ['AVAILABLE', 'BLOCKED', 'REJECTED'],
            AVAILABLE: ['BLOCKED', 'REJECTED'],
            BLOCKED: ['AVAILABLE', 'REJECTED'],
            REJECTED: [],
          };
          if (!allowed[String(record.qualityStatus)]?.includes(change.status))
            throw new MongoInputError('La transición de estado no está permitida.');
          if (
            change.status === 'AVAILABLE' &&
            record.expiresOn &&
            String(record.expiresOn) < change.occurredAt.slice(0, 10)
          )
            throw new MongoInputError('Un lote vencido no puede liberarse ni distribuirse.');
          const direction =
            record.qualityStatus === 'AVAILABLE' ? -1 : change.status === 'AVAILABLE' ? 1 : 0;
          const balances = await this.database
            .collection('inventoryTraceBalances')
            .find({ ...scoped, traceRecordId: record.id }, { session })
            .sort({ warehouseId: 1 })
            .toArray();
          for (const [index, balance] of balances.entries()) {
            const quantity = Number(balance.quantity);
            if (!direction || !quantity) continue;
            await applyStockDelta(
              this.database,
              session,
              actor,
              String(record.itemId),
              String(balance.warehouseId),
              direction * quantity,
            );
            const movement = inventoryMovementSchema.parse({
              id: `${change.id}:movement:${index}`,
              itemId: record.itemId,
              warehouseId: balance.warehouseId,
              quantity,
              createdAt: change.occurredAt,
              reason: change.reason,
              reference: record.receiptReference,
              user: actor.userId,
              kind: direction > 0 ? 'ENTRY' : 'EXIT',
              traceRecordId: record.id,
              traceNumber: record.number,
            });
            await this.database.collection('inventoryMovements').insertOne(
              {
                ...movement,
                ...scoped,
                idempotencyKey: `${change.idempotencyKey}:movement:${index}`,
              },
              { session },
            );
          }
          await this.database
            .collection('inventoryTraceRecords')
            .updateOne(
              { ...scoped, id: record.id, qualityStatus: record.qualityStatus },
              { $set: { qualityStatus: change.status, updatedAt: change.occurredAt } },
              { session },
            );
          await this.database.collection('inventoryTraceEvents').insertOne(
            {
              ...scoped,
              id: change.id,
              traceRecordId: record.id,
              eventType: change.status === 'AVAILABLE' ? 'RELEASED' : change.status,
              idempotencyKey: change.idempotencyKey,
              body: change,
              occurredAt: change.occurredAt,
            },
            { session },
          );
          await audit(`INVENTORY_TRACE_${change.status}`, String(record.id));
          return { id: record.id };
        }
        if (input.command === 'inventory.trace.issue') {
          permission('inventory:write');
          const issue = input.issue;
          const previous = await this.database
            .collection('inventoryTraceEvents')
            .findOne({ ...scoped, idempotencyKey: issue.idempotencyKey }, { session });
          if (previous) {
            assertSameRetry(previous.body as Record<string, unknown>, issue);
            return { id: issue.id };
          }
          const warehouse = await this.database
            .collection('warehouses')
            .findOne({ ...scoped, id: issue.warehouseId, status: 'ACTIVE' }, { session });
          if (!warehouse) throw new MongoInputError('Seleccione una bodega activa.');
          const date = issue.occurredAt.slice(0, 10);
          const records = await this.database
            .collection('inventoryTraceRecords')
            .find(
              {
                ...scoped,
                itemId: issue.itemId,
                qualityStatus: 'AVAILABLE',
                $or: [{ expiresOn: { $exists: false } }, { expiresOn: { $gte: date } }],
              },
              { session },
            )
            .sort({ expiresOn: 1, receivedAt: 1, id: 1 })
            .toArray();
          const candidates: Array<Record<string, unknown> & { quantity: number }> = [];
          for (const record of records) {
            const balance = await this.database.collection('inventoryTraceBalances').findOne(
              {
                ...scoped,
                traceRecordId: record.id,
                warehouseId: issue.warehouseId,
                quantity: { $gt: 0 },
              },
              { session },
            );
            if (balance) candidates.push({ ...record, quantity: Number(balance.quantity) });
          }
          if (candidates.reduce((sum, row) => sum + row.quantity, 0) < issue.quantity)
            throw new MongoInputError(
              'No hay existencias liberadas y vigentes suficientes para esta salida FEFO.',
            );
          let remaining = issue.quantity;
          const allocations: Array<{ traceRecordId: string; number: string; quantity: number }> =
            [];
          for (const [index, candidate] of candidates.entries()) {
            if (!remaining) break;
            const quantity = Math.min(remaining, candidate.quantity);
            remaining -= quantity;
            const changed = await this.database.collection('inventoryTraceBalances').updateOne(
              {
                ...scoped,
                traceRecordId: candidate.id,
                warehouseId: issue.warehouseId,
                quantity: { $gte: quantity },
              },
              { $inc: { quantity: -quantity }, $set: { updatedAt: issue.occurredAt } },
              { session },
            );
            if (changed.modifiedCount !== 1) throw new MongoConflictError();
            await applyStockDelta(
              this.database,
              session,
              actor,
              issue.itemId,
              issue.warehouseId,
              -quantity,
            );
            const movement = inventoryMovementSchema.parse({
              id: `${issue.id}:movement:${index}`,
              itemId: issue.itemId,
              warehouseId: issue.warehouseId,
              quantity,
              createdAt: issue.occurredAt,
              reason: issue.reason,
              reference: issue.reference,
              user: actor.userId,
              kind: 'EXIT',
              traceRecordId: candidate.id,
              traceNumber: candidate.number,
            });
            await this.database.collection('inventoryMovements').insertOne(
              {
                ...movement,
                ...scoped,
                idempotencyKey: `${issue.idempotencyKey}:movement:${index}`,
              },
              { session },
            );
            await this.database.collection('inventoryTraceEvents').insertOne(
              {
                ...scoped,
                id: `${issue.id}:allocation:${index}`,
                traceRecordId: candidate.id,
                eventType: 'ISSUED',
                idempotencyKey: `${issue.idempotencyKey}:allocation:${index}`,
                body: { ...issue, allocatedQuantity: quantity },
                occurredAt: issue.occurredAt,
              },
              { session },
            );
            allocations.push({
              traceRecordId: String(candidate.id),
              number: String(candidate.number),
              quantity,
            });
          }
          await this.database.collection('inventoryTraceEvents').insertOne(
            {
              ...scoped,
              id: issue.id,
              eventType: 'ISSUED',
              idempotencyKey: issue.idempotencyKey,
              body: issue,
              occurredAt: issue.occurredAt,
            },
            { session },
          );
          await audit('INVENTORY_FEFO_ISSUED', issue.id);
          return { id: issue.id, allocations };
        }
        if (input.command === 'inventory.transfer') {
          permission('inventory:write');
          const transfer = input.transfer;
          const previous = await this.database
            .collection('inventoryTransfers')
            .findOne({ ...scoped, idempotencyKey: transfer.idempotencyKey }, { session });
          if (previous) {
            assertSameRetry(previous, transfer, Object.keys(transfer));
            return transfer;
          }
          if (
            !(await this.database.collection('catalogItems').findOne(
              {
                ...scoped,
                id: transfer.itemId,
                status: 'ACTIVE',
                category: { $in: ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'] },
              },
              { session },
            ))
          )
            throw new MongoInputError('Seleccione un artículo activo del inventario.');
          const activeWarehouses = await this.database
            .collection('warehouses')
            .find(
              {
                ...scoped,
                id: { $in: [transfer.sourceWarehouseId, transfer.destinationWarehouseId] },
                status: 'ACTIVE',
              },
              { session },
            )
            .toArray();
          if (activeWarehouses.length !== 2)
            throw new MongoInputError('Seleccione dos bodegas activas y distintas.');
          const transferDate = transfer.occurredAt.slice(0, 10);
          const traceRecords = await this.database
            .collection('inventoryTraceRecords')
            .find({ ...scoped, itemId: transfer.itemId, qualityStatus: 'AVAILABLE' }, { session })
            .sort({ expiresOn: 1, receivedAt: 1, id: 1 })
            .toArray();
          const traceCandidates: Array<Record<string, unknown> & { quantity: number }> = [];
          let expiredQuantity = 0;
          for (const record of traceRecords) {
            const balance = await this.database.collection('inventoryTraceBalances').findOne(
              {
                ...scoped,
                traceRecordId: record.id,
                warehouseId: transfer.sourceWarehouseId,
                quantity: { $gt: 0 },
              },
              { session },
            );
            if (!balance) continue;
            const quantity = Number(balance.quantity);
            if (record.expiresOn && String(record.expiresOn) < transferDate)
              expiredQuantity += quantity;
            else traceCandidates.push({ ...record, quantity });
          }
          const storedBalance = await this.database.collection('inventoryBalances').findOne(
            {
              ...scoped,
              itemId: transfer.itemId,
              warehouseId: transfer.sourceWarehouseId,
            },
            { session },
          );
          let sourceQuantity = Number(storedBalance?.quantity ?? 0);
          if (!storedBalance) {
            const historical = await this.database
              .collection('inventoryMovements')
              .find(
                {
                  ...scoped,
                  itemId: transfer.itemId,
                  warehouseId: transfer.sourceWarehouseId,
                },
                { session },
              )
              .toArray();
            sourceQuantity = historical.reduce(
              (sum, movement) =>
                sum +
                (movement.kind === 'EXIT' ||
                (movement.kind === 'ADJUSTMENT' && movement.adjustmentDirection === 'OUT') ||
                (movement.kind === 'TRANSFER' && movement.transferDirection === 'OUT')
                  ? -Number(movement.quantity)
                  : Number(movement.quantity)),
              0,
            );
          }
          if (sourceQuantity - expiredQuantity < transfer.quantity)
            throw new MongoInputError(
              'La bodega de origen no tiene existencias vigentes suficientes.',
            );
          await applyStockDelta(
            this.database,
            session,
            actor,
            transfer.itemId,
            transfer.sourceWarehouseId,
            -transfer.quantity,
          );
          await applyStockDelta(
            this.database,
            session,
            actor,
            transfer.itemId,
            transfer.destinationWarehouseId,
            transfer.quantity,
          );
          await this.database
            .collection('inventoryTransfers')
            .insertOne({ ...transfer, ...scoped }, { session });
          const movements: Array<Record<string, unknown>> = [];
          let remaining = transfer.quantity;
          for (const [index, candidate] of traceCandidates.entries()) {
            if (!remaining) break;
            const quantity = Math.min(remaining, candidate.quantity);
            remaining -= quantity;
            const moved = await this.database.collection('inventoryTraceBalances').updateOne(
              {
                ...scoped,
                traceRecordId: candidate.id,
                warehouseId: transfer.sourceWarehouseId,
                quantity: { $gte: quantity },
              },
              { $inc: { quantity: -quantity }, $set: { updatedAt: transfer.occurredAt } },
              { session },
            );
            if (moved.modifiedCount !== 1) throw new MongoConflictError();
            await this.database.collection('inventoryTraceBalances').updateOne(
              {
                ...scoped,
                traceRecordId: candidate.id,
                warehouseId: transfer.destinationWarehouseId,
              },
              {
                $inc: { quantity },
                $set: { updatedAt: transfer.occurredAt },
                $setOnInsert: {
                  ...scoped,
                  traceRecordId: candidate.id,
                  warehouseId: transfer.destinationWarehouseId,
                },
              },
              { upsert: true, session },
            );
            for (const [warehouseId, direction, counterpart] of [
              [transfer.sourceWarehouseId, 'OUT', transfer.destinationWarehouseId],
              [transfer.destinationWarehouseId, 'IN', transfer.sourceWarehouseId],
            ] as const) {
              const movement = inventoryMovementSchema.parse({
                id: `${transfer.id}:trace:${index}:${direction.toLowerCase()}`,
                itemId: transfer.itemId,
                createdAt: transfer.occurredAt,
                kind: 'TRANSFER',
                quantity,
                reason: transfer.reason,
                reference: transfer.reference,
                user: actor.userId,
                transferId: transfer.id,
                warehouseId,
                transferDirection: direction,
                counterpartWarehouseId: counterpart,
                traceRecordId: candidate.id,
                traceNumber: candidate.number,
              });
              movements.push({
                ...movement,
                ...scoped,
                idempotencyKey: `${transfer.idempotencyKey}:trace:${index}:${direction.toLowerCase()}`,
              });
            }
            await this.database.collection('inventoryTraceEvents').insertOne(
              {
                ...scoped,
                id: `${transfer.id}:trace:${index}`,
                traceRecordId: candidate.id,
                eventType: 'TRANSFERRED',
                idempotencyKey: `${transfer.idempotencyKey}:trace:${index}`,
                body: { ...transfer, traceRecordId: candidate.id, quantity },
                occurredAt: transfer.occurredAt,
              },
              { session },
            );
          }
          if (remaining) {
            const common = {
              itemId: transfer.itemId,
              createdAt: transfer.occurredAt,
              kind: 'TRANSFER' as const,
              quantity: remaining,
              reason: transfer.reason,
              reference: transfer.reference,
              user: actor.userId,
              transferId: transfer.id,
            };
            movements.push(
              {
                ...inventoryMovementSchema.parse({
                  ...common,
                  id: `${transfer.id}:out`,
                  warehouseId: transfer.sourceWarehouseId,
                  transferDirection: 'OUT',
                  counterpartWarehouseId: transfer.destinationWarehouseId,
                }),
                ...scoped,
                idempotencyKey: `${transfer.idempotencyKey}:out`,
              },
              {
                ...inventoryMovementSchema.parse({
                  ...common,
                  id: `${transfer.id}:in`,
                  warehouseId: transfer.destinationWarehouseId,
                  transferDirection: 'IN',
                  counterpartWarehouseId: transfer.sourceWarehouseId,
                }),
                ...scoped,
                idempotencyKey: `${transfer.idempotencyKey}:in`,
              },
            );
          }
          if (movements.length)
            await this.database.collection('inventoryMovements').insertMany(movements, { session });
          await audit('INVENTORY_TRANSFER_RECORDED', transfer.id);
          return transfer;
        }
        if (input.command === 'inventory.record') {
          permission('inventory:write');
          const movement = input.movement;
          const previous = await this.database
            .collection('inventoryMovements')
            .findOne({ ...scoped, idempotencyKey: input.idempotencyKey }, { session });
          if (previous) {
            assertSameRetry(previous, {
              ...movement,
              warehouseId: movement.warehouseId ?? 'central',
              user: actor.userId,
            });
            return { id: previous.id };
          }
          if (
            !(await this.database.collection('catalogItems').findOne(
              {
                ...scoped,
                id: movement.itemId,
                status: 'ACTIVE',
                category: { $in: ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'] },
              },
              { session },
            ))
          )
            throw new MongoInputError('El artículo no está disponible.');
          if (movement.kind === 'TRANSFER')
            throw new MongoInputError(
              'Un traslado necesita bodega de origen y destino. Regístrelo cuando estén definidas ambas.',
            );
          if (movement.kind === 'ADJUSTMENT' && !movement.adjustmentDirection)
            throw new MongoInputError('Indique la dirección del ajuste.');
          if (
            !(await this.database.collection('warehouses').findOne(
              {
                ...scoped,
                id: movement.warehouseId ?? 'central',
                status: 'ACTIVE',
              },
              { session },
            ))
          )
            throw new MongoInputError('Seleccione una bodega activa.');
          if (
            await this.database
              .collection('inventoryTraceRecords')
              .findOne({ ...scoped, itemId: movement.itemId }, { session })
          )
            throw new MongoInputError(
              'Este artículo usa trazabilidad. Registre recepciones o salidas desde Lotes y series.',
            );
          const delta =
            (movement.kind === 'EXIT' ||
            (movement.kind === 'ADJUSTMENT' && movement.adjustmentDirection === 'OUT')
              ? -1
              : 1) * movement.quantity;
          await applyStockDelta(
            this.database,
            session,
            actor,
            movement.itemId,
            movement.warehouseId ?? 'central',
            delta,
          );
          await this.database.collection('inventoryMovements').insertOne(
            {
              ...movement,
              ...scoped,
              warehouseId: movement.warehouseId ?? 'central',
              user: actor.userId,
              idempotencyKey: input.idempotencyKey,
            },
            { session },
          );
          await audit('INVENTORY_MOVEMENT_RECORDED', movement.id);
          return { id: movement.id };
        }
        if (input.command === 'payment.apply') {
          permission('payments:write');
          const payment = input.payment;
          if (payment.status !== 'APPLIED' || payment.voidReason)
            throw new MongoInputError('El pago debe iniciar aplicado.');
          const previous = await this.database
            .collection('payments')
            .findOne({ ...scoped, idempotencyKey: payment.idempotencyKey }, { session });
          if (previous) {
            if (
              previous.quoteId !== payment.quoteId ||
              previous.amount !== payment.amount ||
              previous.reference !== payment.reference
            )
              throw new MongoConflictError();
            return { id: previous.id };
          }
          const quote = await this.database
            .collection('quotes')
            .findOne(
              { ...scoped, id: payment.quoteId, status: 'SENT', immutable: true },
              { session },
            );
          if (!quote)
            throw new MongoInputError('Seleccione una cotización enviada de esta organización.');
          await this.database
            .collection('quotes')
            .updateOne({ _id: quote._id }, { $inc: { paymentSequence: 1 } }, { session });
          const rootQuoteId = quote.rootQuoteId ?? quote.originalQuoteId ?? quote.id;
          const quoteIds = (
            await this.database
              .collection('quotes')
              .find(
                {
                  ...scoped,
                  $or: [{ id: rootQuoteId }, { rootQuoteId }, { originalQuoteId: rootQuoteId }],
                },
                { session, projection: { id: 1 } },
              )
              .toArray()
          ).map((item) => item.id);
          const applied = await this.database
            .collection('payments')
            .find(
              { ...scoped, quoteId: { $in: quoteIds }, status: 'APPLIED' },
              { session, projection: { amount: 1 } },
            )
            .toArray();
          const paidCents = applied.reduce(
            (sum, item) => sum + Math.round(Number(item.amount) * 100),
            0,
          );
          if (paidCents + Math.round(payment.amount * 100) > Math.round(quote.patientAmount * 100))
            throw new MongoInputError('El pago supera el saldo pendiente de la cotización.');
          await this.database
            .collection('payments')
            .insertOne({ ...payment, ...scoped, createdAt: new Date().toISOString() }, { session });
          await audit('PAYMENT_APPLIED', payment.id);
          return { id: payment.id };
        }
        if (input.command === 'purchase.create') {
          permission('purchases:write');
          const purchase = input.purchase;
          const previous = await this.database
            .collection('purchases')
            .findOne({ ...scoped, id: purchase.id }, { session });
          if (previous) {
            assertSameRetry(previous, purchase);
            return { id: previous.id };
          }
          const catalogItem = await this.database
            .collection('catalogItems')
            .findOne({ ...scoped, id: purchase.catalogItemId, status: 'ACTIVE' }, { session });
          if (!catalogItem)
            throw new MongoInputError('Seleccione un artículo activo de esta organización.');
          const supplier = await this.database.collection('catalogItems').findOne(
            {
              ...scoped,
              id: purchase.supplierCatalogItemId,
              status: 'ACTIVE',
              category: 'PROVIDERS',
            },
            { session },
          );
          if (!supplier) throw new MongoInputError('Seleccione un proveedor activo.');
          if (!purchase.warehouseId) throw new MongoInputError('Seleccione una bodega de destino.');
          const warehouse = await this.database
            .collection('warehouses')
            .findOne({ ...scoped, id: purchase.warehouseId, status: 'ACTIVE' }, { session });
          if (!warehouse) throw new MongoInputError('Seleccione una bodega activa.');
          const normalizedPurchase = normalizePurchaseTraceability(purchase, catalogItem.category);
          await this.database
            .collection('purchases')
            .insertOne({ ...normalizedPurchase, ...scoped }, { session });
          await audit('PURCHASE_DRAFT_CREATED', purchase.id);
          return { id: purchase.id };
        }
        if (input.command === 'clinical.create') {
          permission('clinical:write');
          const document = input.document;
          if (
            document.status !== 'DRAFT' ||
            document.version !== 1 ||
            document.signedAt ||
            document.correctionOf ||
            document.correctionReason
          )
            throw new MongoInputError('Un documento nuevo debe iniciar como borrador versión 1.');
          const hospitalization = await this.database.collection('hospitalizations').findOne(
            {
              ...scoped,
              id: document.caseId,
              patientId: document.patientId,
              status: { $ne: 'CLOSED' },
            },
            { session },
          );
          if (!hospitalization)
            throw new MongoInputError(
              'Seleccione una hospitalización activa de esta organización.',
            );
          if (
            await this.database
              .collection('clinicalDocuments')
              .findOne({ ...scoped, id: document.id }, { session })
          )
            throw new MongoConflictError();
          await this.database.collection('clinicalDocuments').insertOne(
            {
              ...document,
              ...scoped,
              createdAt: new Date().toISOString(),
              createdBy: actor.userId,
            },
            { session },
          );
          await audit('CLINICAL_DOCUMENT_CREATED', document.id);
          return { id: document.id };
        }
        if (input.command === 'clinical.sign') {
          permission('clinical:sign');
          const document = await this.database
            .collection('clinicalDocuments')
            .findOne({ ...scoped, id: input.documentId }, { session });
          if (!document) throw new MongoAccessError();
          if (document.status === 'SIGNED') return { id: document.id };
          if (document.status !== 'DRAFT') throw new MongoConflictError();
          const signedAt = new Date().toISOString();
          const updated = await this.database
            .collection('clinicalDocuments')
            .updateOne(
              { ...scoped, id: input.documentId, status: 'DRAFT' },
              { $set: { status: 'SIGNED', signedAt, signedBy: actor.userId } },
              { session },
            );
          if (updated.modifiedCount !== 1) throw new MongoConflictError();
          await audit('CLINICAL_DOCUMENT_SIGNED', input.documentId);
          return { id: input.documentId };
        }
        if (input.command === 'clinical.correct') {
          permission('clinical:sign');
          const original = await this.database
            .collection('clinicalDocuments')
            .findOne({ ...scoped, id: input.documentId, status: 'SIGNED' }, { session });
          if (!original) throw new MongoAccessError();
          if (
            await this.database
              .collection('clinicalDocuments')
              .findOne({ ...scoped, id: input.correctionId }, { session })
          )
            throw new MongoConflictError();
          const versions = await this.database
            .collection('clinicalDocuments')
            .find(
              {
                ...scoped,
                $or: [{ id: original.id }, { correctionOf: original.id }],
              },
              { session, projection: { version: 1 } },
            )
            .toArray();
          const nextVersion =
            Math.max(
              Number(original.version) || 1,
              ...versions.map((document) => Number(document.version) || 1),
            ) + 1;
          await this.database.collection('clinicalDocuments').insertOne(
            {
              id: input.correctionId,
              organizationId: actor.organizationId,
              caseId: original.caseId,
              patientId: original.patientId,
              type: original.type,
              title: original.title,
              summary: input.summary,
              author: input.author,
              status: 'DRAFT',
              version: nextVersion,
              createdAt: new Date().toISOString(),
              correctionOf: original.id,
              correctionReason: input.reason,
              createdBy: actor.userId,
            },
            { session },
          );
          await audit('CLINICAL_CORRECTION_CREATED', input.correctionId);
          return { id: input.correctionId };
        }
        if (input.command === 'payment.void') {
          permission('payments:write');
          const payment = await this.database
            .collection('payments')
            .findOne({ ...scoped, id: input.paymentId }, { session });
          if (!payment) throw new MongoAccessError();
          if (payment.status === 'VOIDED') {
            if (payment.voidReason !== input.reason) throw new MongoConflictError();
            return { id: payment.id };
          }
          await this.database.collection('payments').updateOne(
            { ...scoped, id: input.paymentId, status: 'APPLIED' },
            {
              $set: {
                status: 'VOIDED',
                voidReason: input.reason,
                voidedBy: actor.userId,
                voidedAt: new Date().toISOString(),
              },
            },
            { session },
          );
          await audit('PAYMENT_VOIDED', payment.id);
          return { id: payment.id };
        }
        if (input.command === 'configuration.save') {
          permission('catalogs:write');
          if (input.entry.category === 'MEDICATION' && input.entry.inventoryItemId) {
            if (
              !(await this.database
                .collection('catalogItems')
                .findOne(
                  { ...scoped, id: input.entry.inventoryItemId, status: 'ACTIVE' },
                  { session },
                ))
            )
              throw new MongoInputError('Seleccione un artículo activo del inventario.');
          }
          await this.database
            .collection('configurationEntries')
            .updateOne(
              { ...scoped, id: input.entry.id },
              { $set: { ...input.entry, ...scoped, updatedAt: new Date() } },
              { upsert: true, session },
            );
          await audit('CONFIGURATION_SAVED', input.entry.id);
          return { id: input.entry.id };
        }
        if (input.command === 'nurse.create') {
          permission('nurses:manage');
          if (['ADMIN', 'MANAGER'].includes(input.role) && actor.role !== 'ADMIN')
            throw new MongoAccessError();
          const emailNormalized = input.email.toLowerCase();
          if (await this.database.collection('users').findOne({ emailNormalized }, { session }))
            throw new MongoConflictError();
          const userId = randomUUID();
          await this.database.collection('users').insertOne(
            {
              id: userId,
              displayName: input.resource.displayName,
              emailNormalized,
              passwordHash: await hashPassword(input.password),
            },
            { session },
          );
          await this.database
            .collection('memberships')
            .insertOne({ ...scoped, userId, role: input.role, active: true }, { session });
          await this.database
            .collection('nursingResources')
            .insertOne({ ...input.resource, ...scoped, userId }, { session });
          await audit('USER_ACCOUNT_CREATED', userId);
          return { id: userId };
        }
        if (input.command === 'balance.open') {
          const caseRecord = await this.requireAssignedCase(actor, input.caseId, session);
          const start = Date.parse(input.startsAt);
          const end = Date.parse(input.endsAt);
          if (end - start < 60000 || end - start > 48 * 3600000)
            throw new MongoInputError('El período debe durar entre 1 minuto y 48 horas.');
          const previous = await this.database
            .collection('balancePeriods')
            .findOne({ ...scoped, idempotencyKey: input.idempotencyKey }, { session });
          if (previous) {
            assertSameRetry(previous, {
              caseId: input.caseId,
              startsAt: new Date(start).toISOString(),
              endsAt: new Date(end).toISOString(),
            });
            return { id: previous.id };
          }
          const overlap = await this.database.collection('balancePeriods').findOne(
            {
              ...scoped,
              caseId: input.caseId,
              startsAt: { $lt: new Date(end).toISOString() },
              endsAt: { $gt: new Date(start).toISOString() },
            },
            { session },
          );
          if (overlap) throw new MongoInputError('Ya existe un período que abarca esas horas.');
          const id = randomUUID();
          await this.database.collection('balancePeriods').insertOne(
            {
              ...scoped,
              id,
              caseId: input.caseId,
              patientId: caseRecord.patientId,
              startsAt: new Date(start).toISOString(),
              endsAt: new Date(end).toISOString(),
              status: 'OPEN',
              createdBy: actor.userId,
              idempotencyKey: input.idempotencyKey,
            },
            { session },
          );
          await audit('BALANCE_PERIOD_OPENED', id);
          return { id };
        }
        if (input.command === 'balance.append' || input.command === 'balance.close') {
          const periodId =
            input.command === 'balance.append' ? input.entry.periodId : input.periodId;
          const period = await this.database
            .collection('balancePeriods')
            .findOne({ ...scoped, id: periodId }, { session });
          if (!period) throw new MongoAccessError();
          await this.requireAssignedCase(actor, period.caseId, session);
          if (input.command === 'balance.close') {
            if (period.status === 'CLOSED') return { id: period.id };
            await this.database.collection('balancePeriods').updateOne(
              { ...scoped, id: periodId, status: 'OPEN' },
              {
                $set: {
                  status: 'CLOSED',
                  handoff: input.handoff,
                  closedBy: actor.userId,
                  closedAt: new Date().toISOString(),
                },
              },
              { session },
            );
            await audit('BALANCE_PERIOD_CLOSED', periodId);
            return { id: periodId };
          }
          const entry = input.entry;
          const previous = await this.database
            .collection('balanceEntries')
            .findOne({ ...scoped, idempotencyKey: entry.idempotencyKey }, { session });
          if (previous) {
            assertSameRetry(previous, {
              ...entry,
              measuredAt: new Date(entry.measuredAt).toISOString(),
            });
            return { id: previous.id };
          }
          if (
            Date.parse(entry.measuredAt) < Date.parse(period.startsAt) ||
            Date.parse(entry.measuredAt) >= Date.parse(period.endsAt)
          )
            throw new MongoInputError('La hora debe pertenecer al período seleccionado.');
          if (period.status === 'CLOSED' && !entry.correctionOf)
            throw new MongoInputError(
              'El período está cerrado; registre una corrección con motivo.',
            );
          if (entry.correctionOf) {
            if (!entry.correctionReason)
              throw new MongoInputError('Indique el motivo de la corrección.');
            const original = await this.database
              .collection('balanceEntries')
              .findOne({ ...scoped, id: entry.correctionOf, periodId }, { session });
            const corrected = await this.database
              .collection('balanceEntries')
              .findOne({ ...scoped, correctionOf: entry.correctionOf }, { session });
            if (!original || corrected) throw new MongoConflictError();
          }
          await this.database
            .collection('balancePeriods')
            .updateOne({ ...scoped, id: periodId }, { $inc: { entrySequence: 1 } }, { session });
          const id = randomUUID();
          await this.database.collection('balanceEntries').insertOne(
            {
              ...entry,
              measuredAt: new Date(entry.measuredAt).toISOString(),
              id,
              ...scoped,
              actorUserId: actor.userId,
              createdAt: new Date().toISOString(),
            },
            { session },
          );
          await audit(
            entry.correctionOf ? 'BALANCE_CORRECTION_APPENDED' : 'BALANCE_ENTRY_APPENDED',
            id,
          );
          return { id };
        }
        if (input.command === 'medication.administer') {
          const entry = input.administration;
          await this.requireAssignedCase(actor, entry.caseId, session);
          const previous = await this.database
            .collection('medicationAdministrations')
            .findOne({ ...scoped, idempotencyKey: entry.idempotencyKey }, { session });
          if (previous) {
            assertSameRetry(previous, entry);
            return { id: previous.id };
          }
          const medication = await this.database
            .collection('configurationEntries')
            .findOne(
              { ...scoped, id: entry.medicationId, category: 'MEDICATION', active: true },
              { session },
            );
          const dose = await this.database
            .collection('configurationEntries')
            .findOne({ ...scoped, id: entry.doseId, category: 'DOSE', active: true }, { session });
          if (!medication?.inventoryItemId || !dose)
            throw new MongoInputError(
              'Seleccione medicamento vinculado al inventario y dosis del catálogo.',
            );
          const factor =
            entry.presentation === 'TABLET'
              ? 1
              : entry.presentation === 'BLISTER'
                ? medication.tabletsPerBlister
                : medication.tabletsPerBox;
          if (!Number.isSafeInteger(factor) || factor <= 0)
            throw new MongoInputError('La equivalencia de esta presentación no está configurada.');
          const baseUnits = factor * entry.quantity;
          if (!Number.isSafeInteger(baseUnits))
            throw new MongoInputError('La cantidad no es válida.');
          const inventoryMovementId = randomUUID();
          await applyStockDelta(
            this.database,
            session,
            actor,
            medication.inventoryItemId,
            entry.warehouseId,
            -baseUnits,
          );
          await this.database.collection('inventoryMovements').insertOne(
            {
              ...scoped,
              id: inventoryMovementId,
              itemId: medication.inventoryItemId,
              kind: 'EXIT',
              quantity: baseUnits,
              warehouseId: entry.warehouseId,
              createdAt: new Date().toISOString(),
              reason: 'Administración registrada',
              reference: entry.idempotencyKey,
              user: actor.userId,
              idempotencyKey: `administration:${entry.idempotencyKey}`,
            },
            { session },
          );
          const id = randomUUID();
          await this.database.collection('medicationAdministrations').insertOne(
            {
              ...entry,
              id,
              ...scoped,
              actorUserId: actor.userId,
              baseUnits,
              inventoryMovementId,
            },
            { session },
          );
          await audit('MEDICATION_ADMINISTERED_AND_STOCK_DEDUCTED', id);
          return { id };
        }
        if (input.command === 'visit.create') {
          permission('reports:read');
          const visit = input.visit;
          if (
            !can(actor.role, 'nurses:manage') &&
            !can(actor.role, 'payments:write') &&
            visit.professionalUserId !== actor.userId
          )
            throw new MongoAccessError();
          const membership = await this.database.collection('memberships').findOne(
            {
              ...scoped,
              userId: visit.professionalUserId,
              active: true,
              role: {
                $in:
                  visit.profession === 'NURSE'
                    ? ['ADMIN', 'NURSE', 'NURSE_MANAGER']
                    : ['ADMIN', 'DOCTOR'],
              },
            },
            { session },
          );
          const patient = await this.database
            .collection('patients')
            .findOne({ ...scoped, id: visit.patientId }, { session });
          if (!membership || !patient)
            throw new MongoInputError(
              'El profesional o paciente no están disponibles en esta organización.',
            );
          const previous = await this.database
            .collection('homeVisits')
            .findOne({ ...scoped, idempotencyKey: visit.idempotencyKey }, { session });
          if (previous) {
            assertSameRetry(previous, visit);
            return { id: previous.id };
          }
          const id = randomUUID();
          await this.database
            .collection('homeVisits')
            .insertOne({ ...visit, id, ...scoped, createdBy: actor.userId }, { session });
          await audit('HOME_VISIT_RECORDED', id);
          return { id };
        }
        if (input.command === 'goal.save') {
          if (!can(actor.role, 'nurses:manage') && !can(actor.role, 'payments:write'))
            throw new MongoAccessError();
          if (
            !(await this.database
              .collection('memberships')
              .findOne(
                { ...scoped, userId: input.goal.professionalUserId, active: true },
                { session },
              ))
          )
            throw new MongoInputError('El profesional no está disponible.');
          const id = `${input.goal.professionalUserId}:${input.goal.month}`;
          await this.database
            .collection('visitGoals')
            .updateOne(
              { ...scoped, id },
              { $set: { ...input.goal, ...scoped, id } },
              { session, upsert: true },
            );
          await audit('VISIT_GOAL_SAVED', id);
          return { id };
        }
        throw new MongoInputError();
      });
    } finally {
      await session.endSession();
    }
  }
}

/** Unit stock changes are serializable per item/warehouse, never computed in the browser. */
export async function applyStockDelta(
  database: Db,
  session: ClientSession,
  actor: ServerActor,
  itemId: string,
  warehouseId: string,
  delta: number,
) {
  const filter = { organizationId: actor.organizationId, itemId, warehouseId };
  const balances = database.collection('inventoryBalances');
  if (!(await balances.findOne(filter, { session }))) {
    const historical = await database
      .collection('inventoryMovements')
      .find(
        {
          organizationId: actor.organizationId,
          itemId,
          ...(warehouseId === 'central'
            ? { $or: [{ warehouseId }, { warehouseId: { $exists: false } }] }
            : { warehouseId }),
        },
        { session },
      )
      .toArray();
    const quantity = historical.reduce(
      (sum, movement) =>
        sum +
        (movement.kind === 'EXIT' ||
        (movement.kind === 'ADJUSTMENT' && movement.adjustmentDirection === 'OUT')
          ? -movement.quantity
          : movement.kind === 'TRANSFER'
            ? movement.transferDirection === 'IN'
              ? movement.quantity
              : -movement.quantity
            : movement.quantity),
      0,
    );
    await balances.insertOne({ ...filter, quantity }, { session });
  }
  const updated = await balances.updateOne(
    { ...filter, ...(delta < 0 ? { quantity: { $gte: -delta } } : {}) },
    { $inc: { quantity: delta } },
    { session },
  );
  if (updated.modifiedCount !== 1)
    throw new MongoInputError(
      'Existencias insuficientes; no se registró la administración ni se descontó inventario.',
    );
}

export const mongoOperationsIndexes: Array<{
  collection: string;
  key: Record<string, number>;
  name: string;
  unique: boolean;
  partialFilterExpression?: Record<string, unknown>;
}> = [
  ...[
    'configurationEntries',
    'balancePeriods',
    'balanceEntries',
    'medicationAdministrations',
    'homeVisits',
    'visitGoals',
    'nursingResources',
    'catalogItems',
    'purchases',
    'clinicalDocuments',
    'warehouses',
    'inventoryTransfers',
    'inventoryTraceRecords',
  ].map((collection) => ({
    collection,
    key: { organizationId: 1, id: 1 },
    name: `${collection}_org_id`,
    unique: true,
  })),
  ...['balancePeriods', 'balanceEntries', 'medicationAdministrations', 'homeVisits'].map(
    (collection) => ({
      collection,
      key: { organizationId: 1, idempotencyKey: 1 },
      name: `${collection}_idempotency`,
      unique: true,
    }),
  ),
  {
    collection: 'inventoryBalances',
    key: { organizationId: 1, itemId: 1, warehouseId: 1 },
    name: 'stock_org_item_warehouse',
    unique: true,
  },
  {
    collection: 'warehouses',
    key: { organizationId: 1, codeNormalized: 1 },
    name: 'warehouse_org_code',
    unique: true,
    partialFilterExpression: { codeNormalized: { $type: 'string' } },
  },
  {
    collection: 'inventoryTransfers',
    key: { organizationId: 1, idempotencyKey: 1 },
    name: 'inventory_transfer_idempotency',
    unique: true,
  },
  {
    collection: 'inventoryTraceRecords',
    key: { organizationId: 1, numberNormalized: 1 },
    name: 'inventory_trace_serial_unique',
    unique: true,
    partialFilterExpression: { kind: 'SERIAL' },
  },
  {
    collection: 'inventoryTraceBalances',
    key: { organizationId: 1, traceRecordId: 1, warehouseId: 1 },
    name: 'inventory_trace_balance_location',
    unique: true,
  },
  {
    collection: 'inventoryTraceEvents',
    key: { organizationId: 1, idempotencyKey: 1 },
    name: 'inventory_trace_event_idempotency',
    unique: true,
  },
  {
    collection: 'inventoryTraceRecords',
    key: { organizationId: 1, itemId: 1, qualityStatus: 1, expiresOn: 1, receivedAt: 1 },
    name: 'inventory_trace_fefo',
    unique: false,
  },
  {
    collection: 'catalogItems',
    key: { organizationId: 1, skuNormalized: 1 },
    name: 'catalog_org_sku',
    unique: true,
    partialFilterExpression: { skuNormalized: { $type: 'string' } },
  },
];
