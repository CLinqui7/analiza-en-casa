import { NextRequest, NextResponse } from 'next/server';
import { persistence } from '@/server/persistence';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { privateHeaders } from '@/server/auth-http';
import { authorizationStatus } from '@/server/http-auth';
import { MongoInputError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

function failure(error: unknown) {
  const status =
    error instanceof MongoInputError || error instanceof SyntaxError
      ? 400
      : authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 400 && error instanceof Error
          ? error.message
          : status === 401
            ? 'Inicia sesión para consultar las escalas.'
            : status === 403
              ? 'No tienes permiso para consultar o guardar escalas.'
              : 'No fue posible cargar o guardar las capturas. Intenta de nuevo.',
    },
    { status, headers: privateHeaders },
  );
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    if (!id || id.length > 120) throw new MongoInputError('Paciente no válido.');
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    if (!backend.clinicalScales)
      return NextResponse.json(
        { error: 'Captura no disponible en este ambiente.' },
        { status: 503, headers: privateHeaders },
      );
    const captures = await backend.clinicalScales.listForPatient(actor, id);
    return captures
      ? NextResponse.json(captures, { headers: privateHeaders })
      : NextResponse.json(
          { error: 'Paciente no encontrado.' },
          { status: 404, headers: privateHeaders },
        );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    if (!id || id.length > 120) throw new MongoInputError('Paciente no válido.');
    const backend = await persistence();
    const token = request.cookies.get(sessionCookieName)?.value;
    const actor = await backend.auth.requireSession(token);
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
    if (!backend.clinicalScales)
      return NextResponse.json(
        { error: 'Captura no disponible en este ambiente.' },
        { status: 503, headers: privateHeaders },
      );
    const capture = await backend.clinicalScales.create(actor, id, await request.json());
    return capture
      ? NextResponse.json(capture, { status: 201, headers: privateHeaders })
      : NextResponse.json(
          { error: 'Paciente no encontrado.' },
          { status: 404, headers: privateHeaders },
        );
  } catch (error) {
    return failure(error);
  }
}
