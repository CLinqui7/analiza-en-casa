import { NextRequest, NextResponse } from 'next/server';
import { persistence } from '@/server/persistence';
import { AuthenticationError, RegistrationError } from '@/server/auth-service';
import { boundedJson, privateHeaders, sessionResponse, validPreAuthCsrf } from '@/server/auth-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (
    process.env.ANALIZA_REGISTRATION_MODE !== 'isolated' ||
    !['mongodb', 'postgresql'].includes(process.env.ANALIZA_DATA_MODE ?? '')
  ) {
    return NextResponse.json(
      { error: 'El registro no está habilitado.' },
      { status: 404, headers: privateHeaders },
    );
  }
  if (!validPreAuthCsrf(request))
    return NextResponse.json(
      { error: 'La solicitud no pudo verificarse.' },
      { status: 403, headers: privateHeaders },
    );
  try {
    const input = await boundedJson(request);
    const result = await (await persistence()).auth.register(input);
    return sessionResponse(request, result, 201);
  } catch (error) {
    const invalid =
      error instanceof RegistrationError ||
      error instanceof AuthenticationError ||
      error instanceof SyntaxError;
    return NextResponse.json(
      {
        error: invalid
          ? 'No fue posible crear la cuenta con esos datos. Revísalos o intenta iniciar sesión.'
          : 'No pudimos completar el registro. Intenta nuevamente en unos minutos.',
      },
      { status: invalid ? 400 : 503, headers: privateHeaders },
    );
  }
}
