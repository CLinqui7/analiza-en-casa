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
  purchaseSchema,
} from '@analiza/contracts';
import { can } from '@/lib/permissions';
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
            !(await this.database
              .collection('catalogItems')
              .findOne({ ...scoped, id: movement.itemId, status: 'ACTIVE' }, { session }))
          )
            throw new MongoInputError('El artículo no está disponible.');
          if (movement.kind === 'TRANSFER')
            throw new MongoInputError(
              'Un traslado necesita bodega de origen y destino. Regístrelo cuando estén definidas ambas.',
            );
          if (movement.kind === 'ADJUSTMENT' && !movement.adjustmentDirection)
            throw new MongoInputError('Indique la dirección del ajuste.');
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
          if (
            !(await this.database
              .collection('catalogItems')
              .findOne({ ...scoped, id: purchase.catalogItemId, status: 'ACTIVE' }, { session }))
          )
            throw new MongoInputError('Seleccione un artículo activo de esta organización.');
          await this.database
            .collection('purchases')
            .insertOne({ ...purchase, ...scoped }, { session });
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
          if (payment.status === 'VOIDED') return { id: payment.id };
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
          // Nurse managers cannot choose a role, reuse an existing identity, or cross organizations.
          await this.database
            .collection('memberships')
            .insertOne({ ...scoped, userId, role: 'ADMIN', active: true }, { session });
          await this.database
            .collection('nursingResources')
            .insertOne({ ...input.resource, ...scoped, userId }, { session });
          await audit('NURSE_ACCOUNT_CREATED', userId);
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
            ? 0
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
    collection: 'catalogItems',
    key: { organizationId: 1, skuNormalized: 1 },
    name: 'catalog_org_sku',
    unique: true,
    partialFilterExpression: { skuNormalized: { $type: 'string' } },
  },
];
