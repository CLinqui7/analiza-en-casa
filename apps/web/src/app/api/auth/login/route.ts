import { NextRequest, NextResponse } from 'next/server';
import {
  AuthenticationError,
  csrfHeaderName,
  MongoAuthService,
  mongoAuthStore,
  loginCsrfCookieName,
  sessionCookieName,
} from '@/server/mongo-auth';
import { mongoDatabase } from '@/server/mongodb';
import { authCookieOptions } from '@/server/auth-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cookieOptions(request: NextRequest) {
  return authCookieOptions(request.nextUrl.protocol);
}

export async function POST(request: NextRequest) {
  try {
    const loginCsrf = request.cookies.get(loginCsrfCookieName)?.value;
    const presentedCsrf = request.headers.get(csrfHeaderName);
    if (!loginCsrf || !presentedCsrf || loginCsrf !== presentedCsrf) {
      return NextResponse.json(
        { error: 'La solicitud no pudo verificarse.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const database = await mongoDatabase();
    const auth = new MongoAuthService(mongoAuthStore(database));
    const result = await auth.login(await request.json());
    const response = NextResponse.json(
      { userId: result.session.userId, role: result.session.role, csrfToken: result.csrfToken },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    response.cookies.set(sessionCookieName, result.sessionToken, {
      ...cookieOptions(request),
      maxAge: Math.floor((result.session.expiresAt.getTime() - Date.now()) / 1000),
    });
    response.cookies.set(loginCsrfCookieName, '', { ...cookieOptions(request), maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'No fue posible iniciar sesión.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { error: 'El acceso seguro no está disponible.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const csrfHeader = csrfHeaderName;
