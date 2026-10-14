import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { can } from '@/lib/permissions';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
} from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const reasons = ['CONFIRMACION_EQUIPO', 'PRUEBA_IDENTIFICADA', 'CORRECCION_CLASIFICACION'] as const;
type Classification = 'REAL' | 'TEST';

function parseInput(value: unknown): {
  classification: Classification;
  reason: string;
  expectedVersion: number;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MongoInputError();
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(',') !== 'classification,expectedVersion,reason')
    throw new MongoInputError();
  if (input.classification !== 'REAL' && input.classification !== 'TEST')
    throw new MongoInputError();
  if (!reasons.some((reason) => reason === input.reason)) throw new MongoInputError();
  if (!Number.isInteger(input.expectedVersion) || (input.expectedVersion as number) < 0)
    throw new MongoInputError();
  return {
    classification: input.classification,
    reason: input.reason as string,
    expectedVersion: input.expectedVersion as number,
  };
}

function responseError(error: unknown) {
  const status =
    error instanceof MongoInputError
      ? 400
      : error instanceof MongoConflictError
        ? 409
        : authorizationStatus(error);
  const message =
    status === 400 || status === 409
      ? (error as Error).message
      : status === 401
        ? 'No autorizado.'
        : status === 403
          ? 'No tiene autorización.'
          : 'El acceso seguro no está disponible.';
  return NextResponse.json({ error: message }, { status, headers });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    if (!can(actor.role, 'patients:read')) throw new MongoAccessError();
    const { id } = await context.params;
    if (!id || id.length > 128) throw new MongoInputError();
    const result = await transaction(postgresPool(), actor, async (client) => {
      const patient = await client.query(
        'SELECT 1 FROM analiza.patients WHERE organization_id=$1 AND id=$2',
        [actor.organizationId, id],
      );
      if (!patient.rowCount) return null;
      const review = await client.query<{
        classification: Classification;
        version: number;
        reviewed_at: Date;
      }>(
        'SELECT classification,version,reviewed_at FROM analiza.patient_origin_reviews WHERE organization_id=$1 AND patient_id=$2',
        [actor.organizationId, id],
      );
      const current = review.rows[0];
      return current
        ? {
            classification: current.classification,
            version: current.version,
            reviewedAt: current.reviewed_at.toISOString(),
          }
        : { classification: 'PENDING' as const, version: 0, reviewedAt: null };
    });
    return result
      ? NextResponse.json(result, { headers })
      : NextResponse.json({ error: 'No encontrado.' }, { status: 404, headers });
  } catch (error) {
    return responseError(error);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const backend = await persistence();
    const token = request.cookies.get(sessionCookieName)?.value;
    const actor = await backend.auth.requireSession(token);
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
    if (!can(actor.role, 'patients:read')) throw new MongoAccessError();
    const { id } = await context.params;
    if (!id || id.length > 128) throw new MongoInputError();
    const input = parseInput(await request.json());
    const result = await transaction(postgresPool(), actor, async (client) => {
      const patient = await client.query(
        'SELECT 1 FROM analiza.patients WHERE organization_id=$1 AND id=$2 FOR UPDATE',
        [actor.organizationId, id],
      );
      if (!patient.rowCount) return null;
      const review = await client.query<{
        classification: Classification;
        reason: string;
        version: number;
        reviewed_at: Date;
      }>(
        'SELECT classification,reason,version,reviewed_at FROM analiza.patient_origin_reviews WHERE organization_id=$1 AND patient_id=$2',
        [actor.organizationId, id],
      );
      const current = review.rows[0];
      if ((current?.version ?? 0) !== input.expectedVersion) throw new MongoConflictError();
      if (current?.classification === input.classification && current.reason === input.reason)
        return {
          classification: current.classification,
          version: current.version,
          reviewedAt: current.reviewed_at.toISOString(),
        };
      const nextVersion = input.expectedVersion + 1;
      const next = await client.query<{ reviewed_at: Date }>(
        `INSERT INTO analiza.patient_origin_reviews
          (organization_id,patient_id,classification,reason,reviewed_by,version)
         VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT(organization_id,patient_id) DO UPDATE SET
           classification=EXCLUDED.classification,reason=EXCLUDED.reason,
           reviewed_by=EXCLUDED.reviewed_by,reviewed_at=now(),version=EXCLUDED.version
         RETURNING reviewed_at`,
        [actor.organizationId, id, input.classification, input.reason, actor.userId, nextVersion],
      );
      await client.query(
        `INSERT INTO analiza.patient_origin_review_events
          (organization_id,id,patient_id,previous_classification,classification,reason,reviewed_by)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          actor.organizationId,
          randomUUID(),
          id,
          current?.classification ?? null,
          input.classification,
          input.reason,
          actor.userId,
        ],
      );
      await client.query(
        `INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id)
         VALUES($1,$2,$3,'patient_origin_reviewed','patient',$4)`,
        [actor.organizationId, randomUUID(), actor.userId, id],
      );
      return {
        classification: input.classification,
        version: nextVersion,
        reviewedAt: next.rows[0].reviewed_at.toISOString(),
      };
    });
    return result
      ? NextResponse.json(result, { headers })
      : NextResponse.json({ error: 'No encontrado.' }, { status: 404, headers });
  } catch (error) {
    return responseError(error);
  }
}
