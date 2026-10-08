import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthenticationError, csrfHeaderName, sessionCookieName } from './auth-service';
import { boundedJson, privateHeaders } from './auth-http';
import { authorizationStatus } from './http-auth';
import { InvalidCurrentPasswordError, ProfileUnavailableError } from './profile-errors';
import { persistence } from './persistence';
import { maximumAvatarBytes } from '@/lib/account-profile';

export async function profileRequest(request: NextRequest, mutation = false) {
  const backend = await persistence();
  const token = request.cookies.get(sessionCookieName)?.value;
  const actor = await backend.auth.requireSession(token);
  if (mutation)
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
  return { backend, actor };
}

export function profileFailure(error: unknown) {
  const status =
    error instanceof InvalidCurrentPasswordError
      ? 400
      : error instanceof ProfileUnavailableError
        ? 404
        : error instanceof AuthenticationError ||
            error instanceof ZodError ||
            error instanceof SyntaxError ||
            (error instanceof Error && error.message === 'AVATAR_INVALID')
          ? 400
          : authorizationStatus(error);
  const message =
    status === 400
      ? error instanceof InvalidCurrentPasswordError
        ? 'La contraseña actual no coincide o hay demasiados intentos.'
        : 'Revisa los datos o el archivo seleccionado.'
      : status === 401
        ? 'Inicia sesión para continuar.'
        : status === 403
          ? 'La solicitud no pudo verificarse.'
          : status === 404
            ? 'La cuenta ya no está disponible.'
            : 'No pudimos guardar el perfil. Intenta nuevamente.';
  return NextResponse.json({ error: message }, { status, headers: privateHeaders });
}

export async function profileJson(request: NextRequest) {
  return boundedJson(request, 4096);
}

export async function boundedAvatar(request: Request): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) throw new AuthenticationError();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximumAvatarBytes) {
        await reader.cancel();
        throw new AuthenticationError();
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    reader.releaseLock();
  }
}
