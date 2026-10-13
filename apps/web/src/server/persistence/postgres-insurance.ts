import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
  insuranceEventSchema,
  insuranceRequestSchema,
  insuranceRequestStatusSchema,
  type InsuranceEvent,
  type InsuranceRequest,
} from '@analiza/contracts';
import { can } from '@/lib/permissions';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  rejectBrowserAuthority,
  type ServerActor,
} from '../validation/patients';
import { audit } from './postgres';
import { transaction } from './postgres-pool';

function parseObservation(input: unknown) {
  rejectBrowserAuthority(input);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new MongoInputError();
  const body = input as Record<string, unknown>;
  if (
    Object.keys(body).some(
      (key) => !['quoteId', 'status', 'note', 'date', 'idempotencyKey'].includes(key),
    ) ||
    typeof body.quoteId !== 'string' ||
    !body.quoteId.trim() ||
    typeof body.note !== 'string' ||
    !body.note.trim() ||
    body.note.length > 2000 ||
    typeof body.date !== 'string' ||
    Number.isNaN(new Date(body.date).getTime()) ||
    typeof body.idempotencyKey !== 'string' ||
    !body.idempotencyKey.trim() ||
    body.idempotencyKey.length > 120 ||
    !insuranceRequestStatusSchema.safeParse(body.status).success
  )
    throw new MongoInputError('La actualización de seguro contiene datos no válidos.');
  return {
    quoteId: body.quoteId.trim(),
    status: insuranceRequestStatusSchema.parse(body.status),
    note: body.note.trim(),
    date: new Date(body.date).toISOString(),
    idempotencyKey: body.idempotencyKey.trim(),
  };
}

export function postgresInsurance(pool: Pool) {
  return {
    async list(
      actor: ServerActor,
    ): Promise<{ requests: InsuranceRequest[]; events: InsuranceEvent[] }> {
      if (!can(actor.role, 'insurance:read')) throw new MongoAccessError();
      return transaction(pool, actor, async (client) => {
        const requests = await client.query<{ body: InsuranceRequest }>(
          'SELECT body FROM analiza.insurance_requests WHERE organization_id=$1 ORDER BY created_at DESC,id',
          [actor.organizationId],
        );
        const events = await client.query<{ body: InsuranceEvent }>(
          'SELECT body FROM analiza.insurance_events WHERE organization_id=$1 ORDER BY observed_at DESC,id',
          [actor.organizationId],
        );
        return {
          requests: requests.rows.map((row) => insuranceRequestSchema.parse(row.body)),
          events: events.rows.map((row) => insuranceEventSchema.parse(row.body)),
        };
      });
    },
    async recordObservation(actor: ServerActor, input: unknown) {
      if (!can(actor.role, 'insurance:write')) throw new MongoAccessError();
      const observed = parseObservation(input);
      return transaction(pool, actor, async (client) => {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('analiza:insurance:' || $1 || ':' || $2,0))",
          [actor.organizationId, observed.idempotencyKey],
        );
        const prior = await client.query<{
          event_body: InsuranceEvent;
          request_body: InsuranceRequest;
        }>(
          `SELECT event.body AS event_body,request.body AS request_body
           FROM analiza.insurance_events event
           JOIN analiza.insurance_requests request
             ON request.organization_id=event.organization_id AND request.id=event.request_id
           WHERE event.organization_id=$1 AND event.idempotency_key=$2`,
          [actor.organizationId, observed.idempotencyKey],
        );
        if (prior.rowCount) {
          const event = insuranceEventSchema.parse(prior.rows[0].event_body);
          const request = insuranceRequestSchema.parse(prior.rows[0].request_body);
          if (
            request.quoteId !== observed.quoteId ||
            event.status !== observed.status ||
            event.note !== observed.note ||
            event.date !== observed.date
          )
            throw new MongoConflictError();
          return { request, event };
        }
        const quote = await client.query<{ patient_id: string }>(
          'SELECT patient_id FROM analiza.quotes WHERE organization_id=$1 AND id=$2 FOR UPDATE',
          [actor.organizationId, observed.quoteId],
        );
        if (!quote.rowCount) throw new MongoInputError('La cotización no está disponible.');
        const patient = await client.query<{ body: Record<string, unknown> }>(
          'SELECT body FROM analiza.patients WHERE organization_id=$1 AND id=$2',
          [actor.organizationId, quote.rows[0].patient_id],
        );
        const profile = patient.rows[0]?.body;
        const insurance = profile?.insurance;
        const insurer =
          typeof profile?.insurer === 'string'
            ? profile.insurer
            : insurance && typeof insurance === 'object' && 'insurer' in insurance
              ? (insurance as { insurer?: unknown }).insurer
              : null;
        if (
          typeof insurer !== 'string' ||
          !insurer.trim() ||
          insurer.toLocaleLowerCase('es').includes('sin aseguradora')
        )
          throw new MongoInputError('El paciente no tiene aseguradora registrada.');

        const existing = await client.query<{ body: InsuranceRequest }>(
          'SELECT body FROM analiza.insurance_requests WHERE organization_id=$1 AND quote_id=$2 FOR UPDATE',
          [actor.organizationId, observed.quoteId],
        );
        const request: InsuranceRequest = existing.rowCount
          ? {
              ...insuranceRequestSchema.parse(existing.rows[0].body),
              status: observed.status,
              updatedAt: observed.date,
              lastNote: observed.note,
            }
          : {
              id: randomUUID(),
              quoteId: observed.quoteId,
              patientId: quote.rows[0].patient_id,
              insurer: insurer.trim(),
              status: observed.status,
              createdAt: observed.date,
              updatedAt: observed.date,
              lastNote: observed.note,
            };
        if (existing.rowCount)
          await client.query(
            'UPDATE analiza.insurance_requests SET body=$3::jsonb,updated_at=now() WHERE organization_id=$1 AND id=$2',
            [actor.organizationId, request.id, JSON.stringify(request)],
          );
        else
          await client.query(
            'INSERT INTO analiza.insurance_requests(organization_id,id,quote_id,patient_id,body) VALUES($1,$2,$3,$4,$5::jsonb)',
            [
              actor.organizationId,
              request.id,
              request.quoteId,
              request.patientId,
              JSON.stringify(request),
            ],
          );
        const event: InsuranceEvent = {
          id: randomUUID(),
          requestId: request.id,
          status: observed.status,
          date: observed.date,
          note: observed.note,
        };
        await client.query(
          'INSERT INTO analiza.insurance_events(organization_id,id,request_id,idempotency_key,actor_user_id,observed_at,body) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',
          [
            actor.organizationId,
            event.id,
            event.requestId,
            observed.idempotencyKey,
            actor.userId,
            event.date,
            JSON.stringify(event),
          ],
        );
        await audit(
          client,
          actor,
          existing.rowCount ? 'INSURANCE_OBSERVATION_RECORDED' : 'INSURANCE_REQUEST_CREATED',
          'insuranceRequest',
          request.id,
        );
        return { request, event };
      });
    },
  };
}
