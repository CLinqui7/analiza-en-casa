import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus } from '@/server/http-auth';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { persistence } from '@/server/persistence';
import { MongoConflictError, MongoInputError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const backend = await persistence();
    const token = request.cookies.get(sessionCookieName)?.value;
    const actor = await backend.auth.requireSession(token);
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
    const result = await backend.insuranceObservations.recordObservation(
      actor,
      await request.json(),
    );
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status =
      error instanceof MongoInputError
        ? 400
        : error instanceof MongoConflictError
          ? 409
          : authorizationStatus(error);
    return NextResponse.json(
      {
        error:
          status === 400 && error instanceof MongoInputError
            ? error.message
            : status === 409
              ? 'El evento ya fue registrado con otro contenido.'
              : status === 401
                ? 'No autorizado.'
                : status === 403
                  ? 'No tiene autorización.'
                  : 'El acceso seguro no está disponible.',
      },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
