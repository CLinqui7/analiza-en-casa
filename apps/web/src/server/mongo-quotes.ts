import {
  insuranceEventSchema,
  insuranceRequestSchema,
  quoteSchema,
  type InsuranceEvent,
  type InsuranceRequest,
  type InsuranceRequestStatus,
  type Quote,
} from '@analiza/contracts';
import { calculateQuoteTotals, canEditQuote, isInsuranceRequestStatus } from '@analiza/domain';
import type { Db } from 'mongodb';
import { can } from '@/lib/permissions';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  rejectBrowserAuthority,
  type ServerActor,
} from './mongo-patients';

type StoredQuote = Quote & {
  organizationId: string;
  recordVersion: number;
  updatedAt: string;
};

type StoredInsuranceRequest = InsuranceRequest & { organizationId: string };
type StoredInsuranceEvent = InsuranceEvent & {
  organizationId: string;
  idempotencyKey: string;
  actorUserId: string;
};

type QuoteWithVersion = Readonly<{ quote: Quote; version: number }>;

function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MongoInputError();
  return value as Record<string, unknown>;
}

function parseQuote(value: unknown): Quote {
  try {
    const quote = quoteSchema.strict().parse(value);
    const totals = calculateQuoteTotals(quote.items, quote.discount, quote.insurerAmount);
    return { ...quote, ...totals };
  } catch {
    throw new MongoInputError('La cotización contiene datos no válidos.');
  }
}

function publicQuote(value: StoredQuote): Quote {
  return quoteSchema.parse(value);
}

function duplicateKey(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 11000);
}

export function parseQuoteCreate(input: unknown): Quote {
  rejectBrowserAuthority(input);
  const body = bodyObject(input);
  if (Object.keys(body).some((key) => key !== 'quote')) throw new MongoInputError();
  const quote = parseQuote(body.quote);
  if (quote.status !== 'DRAFT' || quote.immutable || quote.sentAt) {
    throw new MongoInputError('Una cotización nueva debe iniciar como borrador editable.');
  }
  return quote;
}

export function parseQuoteReplace(input: unknown): { quote: Quote; expectedVersion: number } {
  rejectBrowserAuthority(input);
  const body = bodyObject(input);
  if (Object.keys(body).some((key) => key !== 'quote' && key !== 'expectedVersion')) {
    throw new MongoInputError();
  }
  if (!Number.isInteger(body.expectedVersion) || (body.expectedVersion as number) < 1) {
    throw new MongoInputError('La versión esperada es obligatoria.');
  }
  const quote = parseQuote(body.quote);
  if (quote.status !== 'DRAFT' || quote.immutable || quote.sentAt) {
    throw new MongoInputError('Sólo se puede guardar un borrador editable.');
  }
  return { quote, expectedVersion: body.expectedVersion as number };
}

export class MongoQuoteRepository {
  constructor(private readonly database: Db) {}

  async get(actor: ServerActor, id: string): Promise<Quote | null> {
    if (!can(actor.role, 'quotes:read')) throw new MongoAccessError();
    const row = await this.database
      .collection<StoredQuote>('quotes')
      .findOne({ organizationId: actor.organizationId, id });
    return row ? publicQuote(row) : null;
  }

  async listWithVersions(actor: ServerActor): Promise<QuoteWithVersion[]> {
    if (!can(actor.role, 'quotes:read')) throw new MongoAccessError();
    const rows = await this.database
      .collection<StoredQuote>('quotes')
      .find({ organizationId: actor.organizationId })
      .sort({ createdAt: -1 })
      .toArray();
    return rows.map((row) => ({ quote: publicQuote(row), version: row.recordVersion }));
  }

  async create(actor: ServerActor, input: unknown, now = new Date()): Promise<Quote> {
    if (!can(actor.role, 'quotes:write')) throw new MongoAccessError();
    const quote = parseQuoteCreate(input);
    const session = this.database.client.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const hospitalization = await this.database.collection('hospitalizations').findOne(
          {
            organizationId: actor.organizationId,
            id: quote.caseId,
            patientId: quote.patientId,
          },
          { session },
        );
        if (!hospitalization) throw new MongoInputError('La hospitalización no está disponible.');

        const rootId = quote.rootQuoteId ?? quote.originalQuoteId ?? quote.id;
        if (quote.version === 1) {
          if (rootId !== quote.id)
            throw new MongoInputError('La primera versión debe ser su raíz.');
        } else {
          const previous = await this.database
            .collection<StoredQuote>('quotes')
            .find({ organizationId: actor.organizationId, rootQuoteId: rootId }, { session })
            .sort({ version: -1 })
            .limit(1)
            .next();
          if (
            !previous ||
            !previous.immutable ||
            quote.version !== previous.version + 1 ||
            !quote.revisionReason?.trim()
          ) {
            throw new MongoInputError('La revisión no continúa una versión enviada válida.');
          }
        }
        const stored: StoredQuote = {
          ...quote,
          rootQuoteId: rootId,
          originalQuoteId: rootId,
          organizationId: actor.organizationId,
          recordVersion: 1,
          updatedAt: now.toISOString(),
        };
        await this.database.collection<StoredQuote>('quotes').insertOne(stored, { session });
        await this.database.collection('auditEvents').insertOne(
          {
            id: crypto.randomUUID(),
            organizationId: actor.organizationId,
            actorUserId: actor.userId,
            action: quote.version > 1 ? 'QUOTE_REVISION_CREATED' : 'QUOTE_CREATED',
            resourceType: 'quote',
            resourceId: quote.id,
            occurredAt: now,
          },
          { session },
        );
        return publicQuote(stored);
      });
      if (!result) throw new MongoConflictError();
      return result;
    } catch (error) {
      if (duplicateKey(error)) throw new MongoInputError('La cotización ya existe.');
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async replace(actor: ServerActor, id: string, input: unknown, now = new Date()): Promise<Quote> {
    if (!can(actor.role, 'quotes:write')) throw new MongoAccessError();
    const { quote, expectedVersion } = parseQuoteReplace(input);
    if (quote.id !== id) throw new MongoInputError('El identificador de ruta no coincide.');
    const session = this.database.client.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const current = await this.database.collection<StoredQuote>('quotes').findOne(
          {
            organizationId: actor.organizationId,
            id,
            recordVersion: expectedVersion,
          },
          { session },
        );
        if (!current || !canEditQuote(publicQuote(current))) throw new MongoConflictError();
        const updated = await this.database.collection<StoredQuote>('quotes').findOneAndUpdate(
          {
            organizationId: actor.organizationId,
            id,
            recordVersion: expectedVersion,
            immutable: false,
          },
          {
            $set: { ...quote, organizationId: actor.organizationId, updatedAt: now.toISOString() },
            $inc: { recordVersion: 1 },
          },
          { returnDocument: 'after', session },
        );
        if (!updated) throw new MongoConflictError();
        await this.database.collection('auditEvents').insertOne(
          {
            id: crypto.randomUUID(),
            organizationId: actor.organizationId,
            actorUserId: actor.userId,
            action: 'QUOTE_DRAFT_UPDATED',
            resourceType: 'quote',
            resourceId: id,
            occurredAt: now,
          },
          { session },
        );
        return publicQuote(updated);
      });
      if (!result) throw new MongoConflictError();
      return result;
    } finally {
      await session.endSession();
    }
  }

  async send(
    actor: ServerActor,
    id: string,
    expectedVersion: number,
    now = new Date(),
  ): Promise<Quote> {
    if (!can(actor.role, 'quotes:write')) throw new MongoAccessError();
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new MongoInputError();
    const session = this.database.client.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const updated = await this.database.collection<StoredQuote>('quotes').findOneAndUpdate(
          {
            organizationId: actor.organizationId,
            id,
            recordVersion: expectedVersion,
            status: 'DRAFT',
            immutable: false,
          },
          {
            $set: {
              status: 'SENT',
              immutable: true,
              sentAt: now.toISOString(),
              updatedAt: now.toISOString(),
            },
            $inc: { recordVersion: 1 },
          },
          { returnDocument: 'after', session },
        );
        if (!updated) throw new MongoConflictError();
        await this.database.collection('auditEvents').insertOne(
          {
            id: crypto.randomUUID(),
            organizationId: actor.organizationId,
            actorUserId: actor.userId,
            action: 'QUOTE_SENT_IMMUTABLE',
            resourceType: 'quote',
            resourceId: id,
            occurredAt: now,
          },
          { session },
        );
        return publicQuote(updated);
      });
      if (!result) throw new MongoConflictError();
      return result;
    } finally {
      await session.endSession();
    }
  }
}

export class MongoInsuranceRepository {
  constructor(private readonly database: Db) {}

  async list(
    actor: ServerActor,
  ): Promise<{ requests: InsuranceRequest[]; events: InsuranceEvent[] }> {
    if (!can(actor.role, 'insurance:read')) throw new MongoAccessError();
    const [requests, events] = await Promise.all([
      this.database
        .collection<StoredInsuranceRequest>('insuranceRequests')
        .find({ organizationId: actor.organizationId })
        .toArray(),
      this.database
        .collection<StoredInsuranceEvent>('insuranceEvents')
        .find({ organizationId: actor.organizationId })
        .sort({ date: -1 })
        .toArray(),
    ]);
    return {
      requests: requests.map((row) => insuranceRequestSchema.parse(row)),
      events: events.map((row) => insuranceEventSchema.parse(row)),
    };
  }

  async recordObservation(
    actor: ServerActor,
    input: unknown,
    now = new Date(),
  ): Promise<{ request: InsuranceRequest; event: InsuranceEvent }> {
    if (!can(actor.role, 'insurance:write')) throw new MongoAccessError();
    rejectBrowserAuthority(input);
    const body = bodyObject(input);
    if (
      Object.keys(body).some(
        (key) => !['quoteId', 'status', 'note', 'date', 'idempotencyKey'].includes(key),
      )
    )
      throw new MongoInputError();
    if (
      typeof body.quoteId !== 'string' ||
      typeof body.note !== 'string' ||
      !body.note.trim() ||
      typeof body.date !== 'string' ||
      Number.isNaN(new Date(body.date).getTime()) ||
      typeof body.idempotencyKey !== 'string' ||
      !body.idempotencyKey.trim() ||
      !isInsuranceRequestStatus(body.status)
    )
      throw new MongoInputError('La actualización de seguro contiene datos no válidos.');
    const quoteId = body.quoteId as string;
    const note = (body.note as string).trim();
    const idempotencyKey = body.idempotencyKey as string;
    const status = body.status as InsuranceRequestStatus;

    const quote = await this.database
      .collection<StoredQuote>('quotes')
      .findOne({ organizationId: actor.organizationId, id: quoteId });
    if (!quote) throw new MongoInputError('La cotización no está disponible.');
    const patient = await this.database
      .collection('patients')
      .findOne({ organizationId: actor.organizationId, id: quote.patientId });
    const insurer =
      typeof patient?.insurer === 'string'
        ? patient.insurer
        : patient?.insurance &&
            typeof patient.insurance === 'object' &&
            typeof (patient.insurance as { insurer?: unknown }).insurer === 'string'
          ? (patient.insurance as { insurer: string }).insurer
          : null;
    if (!patient || !insurer || insurer.toLowerCase().includes('sin aseguradora'))
      throw new MongoInputError('El paciente no tiene aseguradora registrada.');

    const session = this.database.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const events = this.database.collection<StoredInsuranceEvent>('insuranceEvents');
        const previousEvent = await events.findOne({
          organizationId: actor.organizationId,
          idempotencyKey,
        });
        if (previousEvent) {
          const previousRequest = await this.database
            .collection<StoredInsuranceRequest>('insuranceRequests')
            .findOne({ organizationId: actor.organizationId, id: previousEvent.requestId });
          if (!previousRequest) throw new MongoConflictError();
          return {
            request: insuranceRequestSchema.parse(previousRequest),
            event: insuranceEventSchema.parse(previousEvent),
          };
        }
        const requests = this.database.collection<StoredInsuranceRequest>('insuranceRequests');
        const existing = await requests.findOne({
          organizationId: actor.organizationId,
          quoteId: quote.id,
        });
        const date = new Date(body.date as string).toISOString();
        const request: InsuranceRequest = existing
          ? { ...insuranceRequestSchema.parse(existing), status, updatedAt: date, lastNote: note }
          : {
              id: crypto.randomUUID(),
              quoteId: quote.id,
              patientId: quote.patientId,
              insurer,
              status,
              createdAt: date,
              updatedAt: date,
              lastNote: note,
            };
        if (existing)
          await requests.replaceOne(
            { organizationId: actor.organizationId, id: existing.id },
            { ...request, organizationId: actor.organizationId },
            { session },
          );
        else
          await requests.insertOne(
            { ...request, organizationId: actor.organizationId },
            { session },
          );
        const event: InsuranceEvent = {
          id: crypto.randomUUID(),
          requestId: request.id,
          status: request.status,
          date,
          note: request.lastNote,
        };
        await events.insertOne(
          {
            ...event,
            organizationId: actor.organizationId,
            idempotencyKey,
            actorUserId: actor.userId,
          },
          { session },
        );
        await this.database.collection('auditEvents').insertOne(
          {
            id: crypto.randomUUID(),
            organizationId: actor.organizationId,
            actorUserId: actor.userId,
            action: existing ? 'INSURANCE_OBSERVATION_RECORDED' : 'INSURANCE_REQUEST_CREATED',
            resourceType: 'insuranceRequest',
            resourceId: request.id,
            occurredAt: now,
          },
          { session },
        );
        return { request, event };
      });
    } finally {
      await session.endSession();
    }
  }
}

export const mongoQuoteIndexes = [
  {
    collection: 'quotes',
    key: { organizationId: 1, id: 1 },
    name: 'quotes_org_id_unique',
    unique: true,
  },
  {
    collection: 'quotes',
    key: { organizationId: 1, rootQuoteId: 1, version: 1 },
    name: 'quotes_org_root_version_unique',
    unique: true,
  },
  {
    collection: 'insuranceRequests',
    key: { organizationId: 1, quoteId: 1 },
    name: 'insurance_requests_org_quote_unique',
    unique: true,
  },
  {
    collection: 'insuranceEvents',
    key: { organizationId: 1, idempotencyKey: 1 },
    name: 'insurance_events_org_idempotency_unique',
    unique: true,
  },
] as const;
