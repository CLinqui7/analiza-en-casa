import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus } from '@/server/http-auth';
import {
  csrfHeaderName,
  MongoAuthService,
  mongoAuthStore,
  sessionCookieName,
} from '@/server/mongo-auth';
import { MongoInputError } from '@/server/mongo-patients';
import { MongoQuoteRepository } from '@/server/mongo-quotes';
import { mongoDatabase } from '@/server/mongodb';

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
    const database = await mongoDatabase();
    const actor = await new MongoAuthService(mongoAuthStore(database)).requireSession(
      request.cookies.get(sessionCookieName)?.value,
    );
    return NextResponse.json(
      { quotes: await new MongoQuoteRepository(database).listWithVersions(actor) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return secureError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const database = await mongoDatabase();
    const auth = new MongoAuthService(mongoAuthStore(database));
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const actor = await auth.requireSession(sessionToken);
    await auth.requireCsrf(sessionToken, request.headers.get(csrfHeaderName) ?? undefined);
    const quote = await new MongoQuoteRepository(database).create(actor, await request.json());
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
