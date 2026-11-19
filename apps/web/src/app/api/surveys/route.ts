import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  surveyCounts,
  surveyInvitationInputSchema,
  validSurveyAnswers,
  type SurveyKind,
} from '@/lib/satisfaction-surveys';
import { can } from '@/lib/permissions';
import { boundedJson, privateHeaders } from '@/server/auth-http';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { publicOrigin } from '@/server/public-origin';
import { MongoAccessError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
class InvalidInvitation extends Error {}

async function actorFor(request: NextRequest, write: boolean) {
  if (process.env.ANALIZA_DATA_MODE !== 'postgresql') throw new MongoAccessError();
  const backend = await persistence();
  const token = request.cookies.get(sessionCookieName)?.value;
  const actor = await backend.auth.requireSession(token);
  if (
    write
      ? !['ADMIN', 'MANAGER', 'WEBMASTER'].includes(actor.role)
      : !can(actor.role, 'reports:read')
  )
    throw new MongoAccessError();
  if (write)
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
  return actor;
}

function failure(error: unknown) {
  const status =
    error instanceof InvalidInvitation || error instanceof SyntaxError
      ? 400
      : authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 400
          ? 'Verifique el tipo de encuesta, destinatario y vencimiento.'
          : status === 401
            ? 'Inicie sesión para continuar.'
            : status === 403
              ? 'No tiene autorización.'
              : 'No fue posible procesar la encuesta.',
    },
    { status, headers: privateHeaders },
  );
}

export async function GET(request: NextRequest) {
  try {
    const actor = await actorFor(request, false);
    const result = await transaction(postgresPool(), actor, async (client) => {
      const rows = await client.query<{
        kind: string;
        response: unknown;
        respondent_name: string | null;
        responded_at: Date | null;
      }>(
        'SELECT kind,response,respondent_name,responded_at FROM analiza.survey_invitations WHERE organization_id=$1 ORDER BY created_at DESC',
        [actor.organizationId],
      );
      return Object.fromEntries(
        ['PATIENT', 'DOCTOR'].map((kind) => {
          const subset = rows.rows.filter((row) => row.kind === kind);
          const responses = subset
            .map((row) => row.response)
            .filter((value): value is string[] => validSurveyAnswers(kind as SurveyKind, value));
          return [
            kind,
            {
              invited: subset.length,
              responded: responses.length,
              questions: surveyCounts(kind as SurveyKind, responses),
              comments:
                kind === 'DOCTOR' && ['ADMIN', 'MANAGER', 'WEBMASTER'].includes(actor.role)
                  ? responses
                      .map((answers) => answers[6]?.trim())
                      .filter(Boolean)
                      .slice(0, 100)
                  : [],
              respondents:
                kind === 'DOCTOR' && ['ADMIN', 'MANAGER', 'WEBMASTER'].includes(actor.role)
                  ? subset
                      .filter(
                        (row) =>
                          validSurveyAnswers('DOCTOR', row.response) &&
                          row.respondent_name &&
                          row.responded_at,
                      )
                      .map((row) => ({
                        name: row.respondent_name,
                        respondedAt: row.responded_at!.toISOString(),
                      }))
                      .slice(0, 100)
                  : [],
            },
          ];
        }),
      );
    });
    return NextResponse.json({ summaries: result }, { headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await actorFor(request, true);
    const parsed = surveyInvitationInputSchema.safeParse(await boundedJson(request, 4096));
    if (!parsed.success) throw new InvalidInvitation();
    const input = parsed.data;
    const expiry = new Date(input.expiresAt);
    if (!Number.isFinite(expiry.valueOf()) || expiry.valueOf() <= Date.now())
      throw new InvalidInvitation();
    const origin = publicOrigin();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await transaction(postgresPool(), actor, async (client) => {
      if (input.targetId) {
        const table = input.kind === 'PATIENT' ? 'patients' : 'doctors';
        const target = await client.query(
          `SELECT 1 FROM analiza.${table} WHERE organization_id=$1 AND id=$2`,
          [actor.organizationId, input.targetId],
        );
        if (!target.rowCount) throw new InvalidInvitation();
      }
      const inviteId = randomUUID();
      await client.query(
        'INSERT INTO analiza.survey_invitations(organization_id,id,kind,target_id,token_hash,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          actor.organizationId,
          inviteId,
          input.kind,
          input.targetId ?? null,
          tokenHash,
          expiry,
          actor.userId,
        ],
      );
      await client.query(
        'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          actor.organizationId,
          randomUUID(),
          actor.userId,
          'survey.invitation.created',
          'survey_invitation',
          inviteId,
        ],
      );
    });
    const url = new URL('/survey', origin);
    url.searchParams.set('o', actor.organizationId);
    url.hash = token;
    return NextResponse.json(
      { url: url.toString(), kind: input.kind, expiresAt: input.expiresAt },
      { status: 201, headers: privateHeaders },
    );
  } catch (error) {
    return failure(error);
  }
}
