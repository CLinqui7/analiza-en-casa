import { persistence } from '@/server/persistence';
import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus } from '@/server/http-auth';

import { MongoInputError } from '@/server/validation/patients';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';

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

/** Bounded hospitalization commands validate their patient against the authenticated organization. */
export async function GET(request: NextRequest) {
  try {
    const backend = await persistence();
    const auth = backend.auth;
    const actor = await auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    const hospitalizations = await backend.hospitalizations.listWithVersions(actor);
    return NextResponse.json({ hospitalizations }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return secureError(authorizationStatus(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const backend = await persistence();
    const auth = backend.auth;
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const actor = await auth.requireSession(sessionToken);
    await auth.requireCsrf(sessionToken, request.headers.get(csrfHeaderName) ?? undefined);
    const hospitalization = await backend.hospitalizations.create(actor, await request.json());
    return NextResponse.json(hospitalization, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
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
