import { persistence } from '@/server/persistence';
import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus } from '@/server/http-auth';

import { MongoAccessError } from '@/server/validation/patients';
import { sessionCookieName } from '@/server/auth-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(status: 401 | 403 | 404 | 503) {
  const error =
    status === 401
      ? 'No autorizado.'
      : status === 403
        ? 'No tiene autorización.'
        : status === 404
          ? 'No encontrado.'
          : 'El almacenamiento privado no está disponible.';
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Same-origin authenticated download; object keys and tenant IDs never cross this HTTP boundary. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const backend = await persistence();
    const auth = backend.auth;
    const actor = await auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    const { id } = await context.params;
    const result = await backend.files.download(actor, id);
    if (!result) return errorResponse(404);
    const body = result.bytes.buffer.slice(
      result.bytes.byteOffset,
      result.bytes.byteOffset + result.bytes.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(body, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.metadata.name)}`,
        'Content-Length': String(result.bytes.byteLength),
        'Content-Type': result.metadata.mimeType,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof MongoAccessError) return errorResponse(403);
    return errorResponse(authorizationStatus(error));
  }
}
