import { persistence } from '@/server/persistence';
import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus, resourceStatus } from '@/server/http-auth';
import {
  MongoConflictError,
  MongoDuplicatePatientError,
  MongoInputError,
} from '@/server/validation/patients';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const backend = await persistence();
    const auth = backend.auth;
    const actor = await auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    const { id } = await context.params;
    const patient = await backend.patients.get(actor, id);
    if (resourceStatus(patient) === 404) {
      return NextResponse.json(
        { error: 'No encontrado.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(patient, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = authorizationStatus(error);
    return NextResponse.json(
      {
        error:
          status === 401
            ? 'No autorizado.'
            : status === 403
              ? 'No tiene autorización.'
              : 'El acceso seguro no está disponible.',
      },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
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
    const patient = await backend.patients.replace(actor, id, await request.json());
    return NextResponse.json(patient, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MongoConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (error instanceof MongoInputError || error instanceof MongoDuplicatePatientError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const status = authorizationStatus(error);
    return NextResponse.json(
      {
        error:
          status === 401
            ? 'No autorizado.'
            : status === 403
              ? 'No tiene autorización.'
              : 'El acceso seguro no está disponible.',
      },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
