import { NextRequest, NextResponse } from 'next/server';
import { can } from '@/lib/permissions';
import { quoteFormDraftSchema } from '@/lib/quote-form-draft';
import { privateHeaders, boundedJson } from '@/server/auth-http';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { MongoAccessError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function draftKey(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!key || key.length > 200 || !/^quote\.(create|edit|revise)\.[a-zA-Z0-9-]+$/.test(key)) {
    throw new Error('Invalid draft key');
  }
  return key;
}

async function authorized(request: NextRequest, mutation: boolean) {
  if (process.env.ANALIZA_DATA_MODE !== 'postgresql') throw new MongoAccessError();
  const backend = await persistence();
  const token = request.cookies.get(sessionCookieName)?.value;
  const actor = await backend.auth.requireSession(token);
  if (!can(actor.role, 'quotes:write')) throw new MongoAccessError();
  if (mutation)
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
  return actor;
}

function failure(error: unknown) {
  const status =
    error instanceof SyntaxError ||
    (error instanceof Error && error.message === 'Invalid draft key')
      ? 400
      : authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 400
          ? 'Borrador inválido.'
          : status === 401
            ? 'Inicia sesión para continuar.'
            : status === 403
              ? 'No tiene autorización.'
              : 'No fue posible guardar el borrador.',
    },
    { status, headers: privateHeaders },
  );
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authorized(request, false);
    const key = draftKey(request);
    const result = await transaction(postgresPool(), actor, async (client) => {
      await client.query("SELECT set_config('analiza.user_id',$1,true)", [actor.userId]);
      return client.query<{ body: unknown; updated_at: Date }>(
        'SELECT body, updated_at FROM analiza.quote_form_drafts WHERE organization_id=$1 AND user_id=$2 AND draft_key=$3',
        [actor.organizationId, actor.userId, key],
      );
    });
    return NextResponse.json(
      result.rows[0]
        ? { draft: result.rows[0].body, updatedAt: result.rows[0].updated_at }
        : { draft: null },
      { headers: privateHeaders },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await authorized(request, true);
    const key = draftKey(request);
    const draft = quoteFormDraftSchema.safeParse(await boundedJson(request, 65536));
    if (!draft.success)
      return NextResponse.json(
        { error: 'Borrador inválido.' },
        { status: 400, headers: privateHeaders },
      );
    await transaction(postgresPool(), actor, async (client) => {
      await client.query("SELECT set_config('analiza.user_id',$1,true)", [actor.userId]);
      await client.query(
        `INSERT INTO analiza.quote_form_drafts (organization_id,user_id,draft_key,body)
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT (organization_id,user_id,draft_key)
         DO UPDATE SET body=EXCLUDED.body,updated_at=now()`,
        [actor.organizationId, actor.userId, key, JSON.stringify(draft.data)],
      );
    });
    return NextResponse.json({ saved: true }, { headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await authorized(request, true);
    const key = draftKey(request);
    await transaction(postgresPool(), actor, async (client) => {
      await client.query("SELECT set_config('analiza.user_id',$1,true)", [actor.userId]);
      await client.query(
        'DELETE FROM analiza.quote_form_drafts WHERE organization_id=$1 AND user_id=$2 AND draft_key=$3',
        [actor.organizationId, actor.userId, key],
      );
    });
    return NextResponse.json({ deleted: true }, { headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}
