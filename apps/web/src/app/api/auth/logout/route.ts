import { NextRequest, NextResponse } from 'next/server';
import {
  CsrfError,
  csrfHeaderName,
  MongoAuthService,
  mongoAuthStore,
  sessionCookieName,
} from '@/server/mongo-auth';
import { mongoDatabase } from '@/server/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = new MongoAuthService(mongoAuthStore(await mongoDatabase()));
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    await auth.requireCsrf(sessionToken, request.headers.get(csrfHeaderName) ?? undefined);
    await auth.logout(sessionToken);
    const response = NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(sessionCookieName, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const status = error instanceof CsrfError ? 403 : 401;
    return NextResponse.json(
      { error: status === 403 ? 'La solicitud no pudo verificarse.' : 'No autorizado.' },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
