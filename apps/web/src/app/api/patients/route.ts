import { persistence } from '@/server/persistence';
import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus } from '@/server/http-auth';
import { MongoDuplicatePatientError, MongoInputError } from '@/server/validation/patients';
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

/** Bounded patient collection commands. Tenant and role derive exclusively from the server session. */
export async function GET(request: NextRequest) {
  try {
    const backend = await persistence();
    const auth = backend.auth;
    const actor = await auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    const patients = await backend.patients.listWithVersions(actor);
    return NextResponse.json({ patients }, { headers: { 'Cache-Control': 'no-store' } });
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
    const patient = await backend.patients.create(actor, await request.json());
    return NextResponse.json(patient, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MongoInputError || error instanceof MongoDuplicatePatientError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return secureError(authorizationStatus(error));
  }
}
