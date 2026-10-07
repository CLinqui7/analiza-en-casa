import { NextRequest, NextResponse } from 'next/server';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { privateHeaders } from '@/server/auth-http';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { MongoConflictError, MongoInputError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function failure(error: unknown) {
  const status =
    error instanceof MongoInputError
      ? 400
      : error instanceof MongoConflictError
        ? 409
        : authorizationStatus(error);
  const message =
    status === 400 && error instanceof Error
      ? error.message
      : status === 409
        ? 'La solicitud ya se utilizó con otros datos.'
        : status === 401
          ? 'Inicie sesión para continuar.'
          : status === 403
            ? 'No tiene autorización para esta solicitud.'
            : 'No fue posible procesar la solicitud.';
  return NextResponse.json({ error: message }, { status, headers: privateHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    if (!backend.supplyRequests)
      return NextResponse.json(
        { error: 'No disponible en este ambiente.' },
        { status: 404, headers: privateHeaders },
      );
    const [requests, catalogItems] = await Promise.all([
      backend.supplyRequests.list(actor),
      backend.supplyRequests.catalog(actor),
    ]);
    return NextResponse.json({ requests, catalogItems }, { headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const backend = await persistence();
    const token = request.cookies.get(sessionCookieName)?.value;
    const actor = await backend.auth.requireSession(token);
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
    if (!backend.supplyRequests)
      return NextResponse.json(
        { error: 'No disponible en este ambiente.' },
        { status: 404, headers: privateHeaders },
      );
    if (Number(request.headers.get('content-length') ?? 0) > 16_384)
      throw new MongoInputError('La solicitud es demasiado grande.');
    return NextResponse.json(await backend.supplyRequests.create(actor, await request.json()), {
      status: 201,
      headers: privateHeaders,
    });
  } catch (error) {
    return failure(error);
  }
}
