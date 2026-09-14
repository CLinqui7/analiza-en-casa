import { NextResponse } from 'next/server';
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
            ? 'No tiene autorización para esta operación.'
            : 'El acceso seguro al espacio de trabajo no está configurado.',
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function GET(request?: Request) {
  try {
    const backend = await persistence();
    const token = request?.headers
      .get('cookie')
      ?.split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith(sessionCookieName + '='))
      ?.slice(sessionCookieName.length + 1);
    const actor = await backend.auth.requireSession(token);
    return NextResponse.json(await backend.workspace(actor), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(authorizationStatus(error));
  }
}
export async function POST() {
  try {
    await persistence();
    return errorResponse(403);
  } catch {
    return errorResponse(503);
  }
}
