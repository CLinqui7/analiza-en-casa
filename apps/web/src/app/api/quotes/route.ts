import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus } from '@/server/http-auth';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { MongoInputError } from '@/server/mongo-patients';
import { persistence } from '@/server/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function secureError(error: unknown) {
  const status = authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 401
          ? 'No autorizado.'
          : status === 403
            ? 'No tiene autorización.'
            : 'El acceso seguro no está disponible.',
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: NextRequest) {
  try {
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    return NextResponse.json(
      { quotes: await backend.quotes.listWithVersions(actor) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return secureError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const backend = await persistence();
    const auth = backend.auth;
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const actor = await auth.requireSession(sessionToken);
    await auth.requireCsrf(sessionToken, request.headers.get(csrfHeaderName) ?? undefined);
    const quote = await backend.quotes.create(actor, await request.json());
    return NextResponse.json(quote, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MongoInputError)
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    return secureError(error);
  }
}
