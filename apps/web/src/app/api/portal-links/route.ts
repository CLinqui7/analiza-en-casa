import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus } from '@/server/http-auth';
import {
  csrfHeaderName,
  MongoAuthService,
  mongoAuthStore,
  sessionCookieName,
} from '@/server/mongo-auth';
import { MongoInputError } from '@/server/mongo-patients';
import { MongoPortalService } from '@/server/mongo-portal';
import { mongoDatabase } from '@/server/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const unavailable = () =>
  NextResponse.json(
    { error: 'El acceso seguro no está disponible.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );

export async function POST(request: NextRequest) {
  if (process.env.ANALIZA_DATA_MODE !== 'mongodb') return unavailable();
  // Avoid opening a database connection for anonymous requests. The generic
  // response does not disclose whether a portal or account exists.
  if (!request.cookies.get(sessionCookieName)?.value) return unavailable();
  try {
    const database = await mongoDatabase();
    const auth = new MongoAuthService(mongoAuthStore(database));
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const actor = await auth.requireSession(sessionToken);
    await auth.requireCsrf(sessionToken, request.headers.get(csrfHeaderName) ?? undefined);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const result = await new MongoPortalService(database).createLink(
      actor,
      await request.json(),
      baseUrl,
    );
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MongoInputError)
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    const status = authorizationStatus(error);
    if (status === 503) return unavailable();
    return NextResponse.json(
      { error: status === 401 ? 'No autorizado.' : 'No tiene autorización.' },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
