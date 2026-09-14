import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus } from '@/server/http-auth';
import {
  csrfHeaderName,
  MongoAuthService,
  mongoAuthStore,
  sessionCookieName,
} from '@/server/mongo-auth';
import { MongoConflictError, MongoInputError } from '@/server/mongo-patients';
import { MongoQuoteRepository } from '@/server/mongo-quotes';
import { mongoDatabase } from '@/server/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const database = await mongoDatabase();
    const auth = new MongoAuthService(mongoAuthStore(database));
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const actor = await auth.requireSession(sessionToken);
    await auth.requireCsrf(sessionToken, request.headers.get(csrfHeaderName) ?? undefined);
    const body: unknown = await request.json();
    const expectedVersion =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as { expectedVersion?: unknown }).expectedVersion
        : undefined;
    const quote = await new MongoQuoteRepository(database).send(
      actor,
      (await context.params).id,
      expectedVersion as number,
    );
    return NextResponse.json(quote, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MongoConflictError)
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    if (error instanceof MongoInputError)
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
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
}
