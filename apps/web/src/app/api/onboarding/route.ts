import { NextRequest, NextResponse } from 'next/server';
import { persistence } from '@/server/persistence';
import { AuthenticationError, sessionCookieName, csrfHeaderName } from '@/server/auth-service';
import { boundedJson, privateHeaders } from '@/server/auth-http';
import { authorizationStatus } from '@/server/http-auth';
import { MongoConflictError, MongoInputError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function failure(error: unknown) {
  const status =
    error instanceof MongoConflictError
      ? 409
      : error instanceof MongoInputError ||
          error instanceof AuthenticationError ||
          error instanceof SyntaxError
        ? 400
        : authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 409
          ? 'El cuestionario cambió en otra pestaña. Recarga los datos antes de guardar.'
          : status === 400
            ? 'Revisa los campos del cuestionario.'
            : status === 401
              ? 'Inicia sesión para continuar.'
              : status === 403
                ? 'No tienes permiso para editar este espacio.'
                : 'No pudimos guardar ni cargar tus datos. Intenta nuevamente.',
    },
    { status, headers: privateHeaders },
  );
}

export async function GET(request: NextRequest) {
  try {
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    if (!backend.onboarding)
      return NextResponse.json(
        { error: 'No disponible en este ambiente.' },
        { status: 404, headers: privateHeaders },
      );
    return NextResponse.json(await backend.onboarding.get(actor), { headers: privateHeaders });
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
    if (!backend.onboarding)
      return NextResponse.json(
        { error: 'No disponible en este ambiente.' },
        { status: 404, headers: privateHeaders },
      );
    return NextResponse.json(
      await backend.onboarding.save(actor, await boundedJson(request, 128 * 1024)),
      { headers: privateHeaders },
    );
  } catch (error) {
    return failure(error);
  }
}
