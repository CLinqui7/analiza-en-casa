import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus } from '@/server/http-auth';
import {
  MongoAuthService,
  mongoAuthStore,
  sessionCookieName,
  csrfHeaderName,
} from '@/server/mongo-auth';
import { MongoInputError } from '@/server/mongo-patients';
import { MongoShiftRepository } from '@/server/mongo-shifts';
import { mongoDatabase } from '@/server/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function secureError(status: 401 | 403 | 503) {
  const error =
    status === 401
      ? 'No autorizado.'
      : status === 403
        ? 'No tiene autorización.'
        : 'El acceso seguro no está disponible.';
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  try {
    const database = await mongoDatabase();
    const auth = new MongoAuthService(mongoAuthStore(database));
    const actor = await auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    const shifts = await new MongoShiftRepository(database as never).list(actor);
    return NextResponse.json({ shifts }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return secureError(authorizationStatus(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const database = await mongoDatabase();
    const auth = new MongoAuthService(mongoAuthStore(database));
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const actor = await auth.requireSession(sessionToken);
    await auth.requireCsrf(sessionToken, request.headers.get(csrfHeaderName) ?? undefined);
    const shifts = await new MongoShiftRepository(database as never).createSeries(
      actor,
      await request.json(),
    );
    return NextResponse.json({ shifts }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MongoInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return secureError(authorizationStatus(error));
  }
}
