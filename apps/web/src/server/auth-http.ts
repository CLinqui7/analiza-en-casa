import { NextRequest, NextResponse } from 'next/server';
import {
  AuthenticationError,
  csrfHeaderName,
  loginCsrfCookieName,
  sessionCookieName,
  type AuthService,
} from './auth-service';
import { authCookieOptions } from './auth-cookie';

export const privateHeaders = { 'Cache-Control': 'no-store' };

export function validPreAuthCsrf(request: NextRequest) {
  const cookie = request.cookies.get(loginCsrfCookieName)?.value;
  const header = request.headers.get(csrfHeaderName);
  const origin = request.headers.get('origin');
  // NextURL normalizes loopback hostnames to localhost. Compare the browser's Origin to
  // the actual Host header, retaining protocol/port checks and the double-submit token.
  const host = request.headers.get('host') ?? request.nextUrl.host;
  let sameOrigin = !origin;
  try {
    const target = new URL(`${request.nextUrl.protocol}//${host}`);
    sameOrigin = !origin || (target.host === host && origin === target.origin);
  } catch {
    sameOrigin = false;
  }
  return Boolean(
    cookie &&
    header &&
    cookie === header &&
    sameOrigin &&
    request.headers.get('sec-fetch-site') !== 'cross-site',
  );
}

/** Count actual bytes, including chunked bodies, before parsing untrusted JSON. */
export async function boundedJson(request: Request, limit = 8192): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new AuthenticationError();
  const reader = request.body?.getReader();
  if (!reader) throw new AuthenticationError();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new AuthenticationError();
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally {
    reader.releaseLock();
  }
}

export function sessionResponse(
  request: NextRequest,
  result: Awaited<ReturnType<AuthService['login']>>,
  status = 200,
) {
  const response = NextResponse.json(
    {
      userId: result.session.userId,
      role: result.session.role,
      csrfToken: result.csrfToken,
    },
    { status, headers: privateHeaders },
  );
  const cookieOptions = authCookieOptions(request.nextUrl.protocol);
  response.cookies.set(sessionCookieName, result.sessionToken, {
    ...cookieOptions,
    maxAge: Math.max(0, Math.floor((result.session.expiresAt.getTime() - Date.now()) / 1000)),
  });
  response.cookies.set(loginCsrfCookieName, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
