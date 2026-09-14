import { persistence } from '@/server/persistence';
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { loginCsrfCookieName, sessionCookieName, SessionError } from '@/server/auth-service';

import { authCookieOptions } from '@/server/auth-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pre-auth double-submit token. The cookie is HttpOnly; the same token is returned only to a
 * same-origin caller and must be echoed in the login header. It is consumed after successful login.
 */
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  if (sessionToken) {
    try {
      const auth = (await persistence()).auth;
      const csrfToken = await auth.rotateCsrf(sessionToken);
      return NextResponse.json({ csrfToken }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (!(error instanceof SessionError)) {
        return NextResponse.json(
          { error: 'El acceso seguro no está disponible.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
      }
    }
  }
  const token = randomBytes(32).toString('base64url');
  const response = NextResponse.json(
    { csrfToken: token },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  response.cookies.set(loginCsrfCookieName, token, {
    ...authCookieOptions(request.nextUrl.protocol),
    maxAge: 10 * 60,
  });
  if (sessionToken)
    response.cookies.set(sessionCookieName, '', {
      ...authCookieOptions(request.nextUrl.protocol),
      maxAge: 0,
    });
  return response;
}
