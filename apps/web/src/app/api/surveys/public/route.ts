import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  doctorRespondentNameSchema,
  surveyPublicInputSchema,
  surveyQuestions,
  validSurveyAnswers,
  type SurveyKind,
} from '@/lib/satisfaction-surveys';
import { boundedJson } from '@/server/auth-http';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
const inputSchema = z.discriminatedUnion('action', [
  surveyPublicInputSchema.extend({ action: z.literal('LOOKUP') }),
  surveyPublicInputSchema.extend({
    action: z.literal('SUBMIT'),
    answers: z.array(z.string().max(1000)).max(7),
    respondentName: doctorRespondentNameSchema.optional(),
  }),
]);

export async function POST(request: NextRequest) {
  // Public capability tokens are 256-bit random values. The organization hint only selects an RLS partition.
  try {
    if (process.env.ANALIZA_DATA_MODE !== 'postgresql') throw new Error();
    const parsed = inputSchema.safeParse(await boundedJson(request, 8192));
    if (!parsed.success) throw new Error();
    const input = parsed.data;
    const actor = { organizationId: input.organizationId };
    const result = await transaction(postgresPool(), actor, async (client) => {
      const hash = createHash('sha256').update(input.token).digest('hex');
      const rows = await client.query<{
        id: string;
        kind: SurveyKind;
        expires_at: Date;
        response: unknown;
        respondent_name: string | null;
      }>(
        'SELECT id,kind,expires_at,response,respondent_name FROM analiza.survey_invitations WHERE organization_id=$1 AND token_hash=$2 FOR UPDATE',
        [input.organizationId, hash],
      );
      const invitation = rows.rows[0];
      if (!invitation) return null;
      if (
        input.action === 'SUBMIT' &&
        (invitation.kind === 'DOCTOR' ? !input.respondentName : Boolean(input.respondentName))
      )
        return null;
      if (invitation.response) {
        return input.action === 'SUBMIT' &&
          validSurveyAnswers(invitation.kind, input.answers) &&
          (invitation.respondent_name ?? null) === (input.respondentName ?? null) &&
          JSON.stringify(invitation.response) === JSON.stringify(input.answers)
          ? { accepted: true }
          : null;
      }
      if (invitation.expires_at.valueOf() <= Date.now()) return null;
      if (input.action === 'LOOKUP')
        return { kind: invitation.kind, questions: surveyQuestions[invitation.kind] };
      if (!validSurveyAnswers(invitation.kind, input.answers)) return null;
      await client.query(
        'UPDATE analiza.survey_invitations SET response=$3::jsonb,respondent_name=$4,responded_at=now() WHERE organization_id=$1 AND id=$2 AND response IS NULL',
        [
          input.organizationId,
          invitation.id,
          JSON.stringify(input.answers),
          input.respondentName ?? null,
        ],
      );
      return { accepted: true };
    });
    if (!result)
      return NextResponse.json(
        { error: 'El enlace no está disponible o ya fue utilizado.' },
        { status: 404, headers },
      );
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      { error: 'El enlace no está disponible o ya fue utilizado.' },
      { status: 404, headers },
    );
  }
}
