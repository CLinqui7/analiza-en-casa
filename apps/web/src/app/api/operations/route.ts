import { NextRequest, NextResponse } from 'next/server';
import {
  MongoAuthService,
  mongoAuthStore,
  sessionCookieName,
  csrfHeaderName,
} from '@/server/mongo-auth';
import { mongoDatabase } from '@/server/mongodb';
import { MongoOperationsRepository } from '@/server/mongo-operations';
import { MongoConflictError, MongoInputError } from '@/server/mongo-patients';
import { authorizationStatus } from '@/server/http-auth';
import { isReleasedCommand } from '@/lib/release-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
function failure(error: unknown) {
  const status =
    error instanceof MongoConflictError
      ? 409
      : error instanceof MongoInputError || error instanceof SyntaxError
        ? 400
        : authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 400 && error instanceof MongoInputError
          ? error.message
          : status === 409
            ? 'El registro cambió o ya existe; actualice antes de continuar.'
            : status === 403
              ? 'No tiene permiso para esta operación.'
              : status === 401
                ? 'Inicie sesión para continuar.'
                : 'No se pudo guardar ni cargar la información. Intente nuevamente.',
    },
    { status, headers },
  );
}
export async function GET(request: NextRequest) {
  try {
    const database = await mongoDatabase();
    const actor = await new MongoAuthService(mongoAuthStore(database)).requireSession(
      request.cookies.get(sessionCookieName)?.value,
    );
    return NextResponse.json(await new MongoOperationsRepository(database).list(actor), {
      headers,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const database = await mongoDatabase();
    const auth = new MongoAuthService(mongoAuthStore(database));
    const token = request.cookies.get(sessionCookieName)?.value;
    const actor = await auth.requireSession(token);
    await auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
    const input = await request.json();
    if (!isReleasedCommand(input?.command)) {
      return NextResponse.json(
        { error: 'Operación no disponible en esta edición.' },
        { status: 404, headers },
      );
    }
    const result = await new MongoOperationsRepository(database).execute(actor, input);
    return NextResponse.json(result, { status: 200, headers });
  } catch (error) {
    return failure(error);
  }
}
