import { persistence } from '@/server/persistence';
import { NextRequest, NextResponse } from 'next/server';
import { AuthenticationError, csrfHeaderName } from '@/server/auth-service';
import { boundedJson, sessionResponse, validPreAuthCsrf } from '@/server/auth-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!validPreAuthCsrf(request)) {
      return NextResponse.json(
        { error: 'La solicitud no pudo verificarse.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const input = await boundedJson(request);
    const backend = await persistence();
    const auth = backend.auth;
    const result = await auth.login(input);
    return sessionResponse(request, result);
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
