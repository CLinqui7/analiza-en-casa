import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hospitalizationSchema, quoteSchema } from '@analiza/contracts';
import { can } from '@/lib/permissions';
import { quoteDecisionInputSchema, quoteDecisionSchema } from '@/lib/quote-decision';
import { boundedJson, privateHeaders } from '@/server/auth-http';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { MongoAccessError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
class DecisionConflict extends Error {}
class UnavailableQuote extends Error {}
class IncompleteAdmission extends Error {}
class InvalidApproval extends Error {}

async function actorFor(request: NextRequest, write: boolean) {
  if (process.env.ANALIZA_DATA_MODE !== 'postgresql') throw new MongoAccessError();
  const backend = await persistence();
  const token = request.cookies.get(sessionCookieName)?.value;
  const actor = await backend.auth.requireSession(token);
  if (!write && !can(actor.role, 'quotes:read')) throw new MongoAccessError();
  if (write)
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
  return actor;
}

function failure(error: unknown) {
  const status =
    error instanceof z.ZodError || error instanceof SyntaxError
      ? 400
      : error instanceof DecisionConflict
        ? 409
        : error instanceof UnavailableQuote
          ? 404
          : error instanceof IncompleteAdmission || error instanceof InvalidApproval
            ? 422
            : authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 400
          ? 'Seleccione una decisión y, si no fue aprobado, un motivo.'
          : status === 409
            ? 'Esta solicitud ya registró una decisión distinta.'
            : status === 404
              ? 'La cotización no está disponible.'
              : status === 422
                ? error instanceof InvalidApproval
                  ? 'La cotización debe tener conceptos y ser su versión más reciente antes de aprobarse.'
                  : 'Complete un médico principal vigente y una fecha de ingreso válida antes de aprobar la hospitalización.'
                : status === 401
                  ? 'Inicie sesión para continuar.'
                  : status === 403
                    ? 'No tiene autorización.'
                    : 'No fue posible guardar la decisión.',
    },
    { status, headers: privateHeaders },
  );
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const actor = await actorFor(request, false);
    const { id } = await params;
    const decisions = await transaction(postgresPool(), actor, async (client) => {
      const quote = await client.query(
        'SELECT 1 FROM analiza.quotes WHERE organization_id=$1 AND id=$2',
        [actor.organizationId, id],
      );
      if (!quote.rowCount) throw new UnavailableQuote();
      const rows = await client.query<{
        id: string;
        quote_id: string;
        decision: string;
        reason: string | null;
        created_at: Date;
      }>(
        'SELECT id,quote_id,decision,reason,created_at FROM analiza.quote_decisions WHERE organization_id=$1 AND quote_id=$2 ORDER BY created_at DESC,id DESC LIMIT 100',
        [actor.organizationId, id],
      );
      return rows.rows.map((row) =>
        quoteDecisionSchema.parse({
          id: row.id,
          quoteId: row.quote_id,
          decision: row.decision,
          reason: row.reason,
          createdAt: row.created_at.toISOString(),
        }),
      );
    });
    return NextResponse.json({ decisions }, { headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const actor = await actorFor(request, true);
    const { id } = await params;
    const input = quoteDecisionInputSchema.parse(await boundedJson(request, 4096));
    const result = await transaction(postgresPool(), actor, async (client) => {
      const quoteRow = await client.query<{
        body: unknown;
        record_version: number;
        root_quote_id: string;
      }>(
        'SELECT body,record_version,root_quote_id FROM analiza.quotes WHERE organization_id=$1 AND id=$2 FOR UPDATE',
        [actor.organizationId, id],
      );
      const quote = quoteRow.rows[0] ? quoteSchema.parse(quoteRow.rows[0].body) : null;
      if (
        !quote ||
        (quote.status === 'SENT' && !quote.immutable) ||
        (quote.status === 'DRAFT' && quote.immutable)
      )
        throw new UnavailableQuote();
      const priorDecision = await client.query<{
        id: string;
        quote_id: string;
        decision: string;
        reason: string | null;
        created_at: Date;
      }>(
        'SELECT id,quote_id,decision,reason,created_at FROM analiza.quote_decisions WHERE organization_id=$1 AND quote_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1',
        [actor.organizationId, id],
      );
      if (priorDecision.rows[0]) {
        if (
          priorDecision.rows[0].decision !== input.decision ||
          priorDecision.rows[0].reason !== (input.reason ?? null)
        )
          throw new DecisionConflict();
        return { row: priorDecision.rows[0], created: false };
      }
      const existing = await client.query<{
        id: string;
        quote_id: string;
        decision: string;
        reason: string | null;
        created_at: Date;
      }>(
        'SELECT id,quote_id,decision,reason,created_at FROM analiza.quote_decisions WHERE organization_id=$1 AND id=$2',
        [actor.organizationId, input.id],
      );
      if (existing.rows[0]) {
        const previous = existing.rows[0];
        if (
          previous.quote_id !== id ||
          previous.decision !== input.decision ||
          previous.reason !== (input.reason ?? null)
        )
          throw new DecisionConflict();
        return { row: previous, created: false };
      }
      if (input.decision === 'APPROVED') {
        const latest = await client.query<{ id: string }>(
          'SELECT id FROM analiza.quotes WHERE organization_id=$1 AND root_quote_id=$2 ORDER BY quote_version DESC LIMIT 1',
          [actor.organizationId, quoteRow.rows[0].root_quote_id],
        );
        if (latest.rows[0]?.id !== id || !quote.items.length) throw new InvalidApproval();
        if (quote.careSetting === 'HOSPITALIZATION' && !quote.caseId) {
          const admissionDate = quote.admissionDate ?? '';
          const validDate =
            /^\d{4}-\d{2}-\d{2}$/.test(admissionDate) &&
            !Number.isNaN(Date.parse(`${admissionDate}T00:00:00Z`)) &&
            new Date(`${admissionDate}T00:00:00Z`).toISOString().slice(0, 10) === admissionDate;
          const doctor = quote.primaryDoctorId
            ? await client.query(
                'SELECT 1 FROM analiza.doctors WHERE organization_id=$1 AND id=$2',
                [actor.organizationId, quote.primaryDoctorId],
              )
            : null;
          if (!validDate || !doctor?.rowCount) throw new IncompleteAdmission();
        }
      }
      if (quote.status === 'DRAFT') {
        const sent = quoteSchema.parse({
          ...quote,
          status: 'SENT',
          immutable: true,
          sentAt: new Date().toISOString(),
        });
        const updated = await client.query(
          'UPDATE analiza.quotes SET body=$4::jsonb,record_version=record_version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 AND record_version=$3',
          [actor.organizationId, id, quoteRow.rows[0].record_version, JSON.stringify(sent)],
        );
        if (updated.rowCount !== 1) throw new DecisionConflict();
        await client.query(
          'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
          [actor.organizationId, randomUUID(), actor.userId, 'QUOTE_SENT_IMMUTABLE', 'quote', id],
        );
      }
      const inserted = await client.query<{
        id: string;
        quote_id: string;
        decision: string;
        reason: string | null;
        created_at: Date;
      }>(
        'INSERT INTO analiza.quote_decisions(organization_id,id,quote_id,actor_user_id,decision,reason) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id,quote_id,decision,reason,created_at',
        [actor.organizationId, input.id, id, actor.userId, input.decision, input.reason ?? null],
      );
      const row =
        inserted.rows[0] ??
        (
          await client.query<{
            id: string;
            quote_id: string;
            decision: string;
            reason: string | null;
            created_at: Date;
          }>(
            'SELECT id,quote_id,decision,reason,created_at FROM analiza.quote_decisions WHERE organization_id=$1 AND id=$2',
            [actor.organizationId, input.id],
          )
        ).rows[0];
      if (
        !row ||
        row.quote_id !== id ||
        row.decision !== input.decision ||
        row.reason !== (input.reason ?? null)
      )
        throw new DecisionConflict();
      if (inserted.rows[0]) {
        if (
          input.decision === 'APPROVED' &&
          quote.careSetting === 'HOSPITALIZATION' &&
          !quote.caseId
        ) {
          const alreadyLinked = await client.query(
            "SELECT id FROM analiza.hospitalizations WHERE organization_id=$1 AND body->'linkedQuoteIds' @> jsonb_build_array($2::text) LIMIT 1",
            [actor.organizationId, id],
          );
          if (!alreadyLinked.rowCount) {
            const admission = hospitalizationSchema.parse({
              id: randomUUID(),
              patientId: quote.patientId,
              startDate: quote.admissionDate,
              endDate: quote.dischargeDate || undefined,
              admissionPeriods: [
                {
                  admissionDate: quote.admissionDate,
                  dischargeDate: quote.dischargeDate || undefined,
                },
              ],
              status: quote.dischargeDate ? 'CLOSED' : 'ACTIVE',
              accountType: quote.accountType ?? 'PARTICULAR',
              insurer: quote.insurer,
              manager: quote.manager,
              priority: quote.priority,
              diagnosisSummary: quote.diagnosisSummary,
              primaryDoctorId: quote.primaryDoctorId,
              secondaryDoctorId: quote.secondaryDoctorId,
              linkedQuoteIds: [id],
            });
            await client.query(
              'INSERT INTO analiza.hospitalizations(organization_id,id,body,patient_id) VALUES($1,$2,$3::jsonb,$4)',
              [actor.organizationId, admission.id, JSON.stringify(admission), admission.patientId],
            );
            await client.query(
              'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
              [
                actor.organizationId,
                randomUUID(),
                actor.userId,
                'clinical_admission.created_from_quote',
                'hospitalization',
                admission.id,
              ],
            );
          }
        }
        await client.query(
          'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
          [
            actor.organizationId,
            randomUUID(),
            actor.userId,
            'quote.decision.recorded',
            'quote',
            id,
          ],
        );
      }
      return { row, created: Boolean(inserted.rows[0]) };
    });
    return NextResponse.json(
      quoteDecisionSchema.parse({
        id: result.row.id,
        quoteId: result.row.quote_id,
        decision: result.row.decision,
        reason: result.row.reason,
        createdAt: result.row.created_at.toISOString(),
      }),
      { status: result.created ? 201 : 200, headers: privateHeaders },
    );
  } catch (error) {
    return failure(error);
  }
}
