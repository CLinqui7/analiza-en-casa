import { NextRequest, NextResponse } from 'next/server';
import { persistence } from '@/server/persistence';
import { boundedJson, privateHeaders } from '@/server/auth-http';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { MongoConflictError, MongoInputError } from '@/server/validation/patients';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const backend = await persistence();
    const token = request.cookies.get(sessionCookieName)?.value;
    const actor = await backend.auth.requireSession(token);
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
    if (!backend.quotes.reviseSent)
      return NextResponse.json(
        { error: 'La edición no está disponible en este ambiente.' },
        { status: 503, headers: privateHeaders },
      );
    const quote = await backend.quotes.reviseSent(
      actor,
      (await params).id,
      await boundedJson(request, 1024 * 1024),
    );
    return NextResponse.json(quote, { headers: privateHeaders });
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
          error instanceof MongoInputError
            ? error.message
            : status === 409
              ? 'La cotización cambió. Actualice antes de editar.'
              : status === 401
                ? 'Inicie sesión.'
                : status === 403
                  ? 'No tiene autorización.'
                  : 'No se pudo guardar la cotización.',
      },
      { status, headers: privateHeaders },
    );
  }
}
