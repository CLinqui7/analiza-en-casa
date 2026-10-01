import { NextRequest, NextResponse } from 'next/server';
import { sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(status: 401 | 403 | 503) {
  return NextResponse.json(
    {
      error:
        status === 401
          ? 'No autorizado.'
          : status === 403
            ? 'Esta bitácora es privada para la cuenta de analítica.'
            : 'La bitácora de accesos no está disponible.',
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: NextRequest) {
  try {
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    return NextResponse.json(await backend.loginAnalytics.snapshot(actor), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(authorizationStatus(error));
  }
}
