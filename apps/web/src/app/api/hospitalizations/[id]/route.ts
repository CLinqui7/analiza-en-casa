import { persistence } from '@/server/persistence';
import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus, resourceStatus } from '@/server/http-auth';

import { MongoConflictError, MongoInputError } from '@/server/validation/patients';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(status: 401 | 403 | 404 | 503) {
  const error =
    status === 401
      ? 'No autorizado.'
      : status === 403
        ? 'No tiene autorización.'
        : status === 404
          ? 'No encontrado.'
          : 'El acceso seguro no está disponible.';
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const backend = await persistence();
    const auth = backend.auth;
    const actor = await auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    const { id } = await context.params;
    const hospitalization = await backend.hospitalizations.get(actor, id);
    if (resourceStatus(hospitalization) === 404) return errorResponse(404);
    return NextResponse.json(hospitalization, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(authorizationStatus(error));
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const backend = await persistence();
    const auth = backend.auth;
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const actor = await auth.requireSession(sessionToken);
    await auth.requireCsrf(sessionToken, request.headers.get(csrfHeaderName) ?? undefined);
    const { id } = await context.params;
    const hospitalization = await backend.hospitalizations.replace(actor, id, await request.json());
    return NextResponse.json(hospitalization, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MongoConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (error instanceof MongoInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return errorResponse(authorizationStatus(error));
  }
}
