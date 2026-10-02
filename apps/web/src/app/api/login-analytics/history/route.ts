import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  userId: z.string().min(1).max(200),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    userId: request.nextUrl.searchParams.get('userId'),
    month: request.nextUrl.searchParams.get('month'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Selecciona un usuario y mes válidos.' }, { status: 400, headers });
  }
  try {
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    const history = await backend.loginAnalytics.history(actor, parsed.data.userId, parsed.data.month);
    if (!history) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404, headers });
    return NextResponse.json(history, { headers });
  } catch (error) {
    const status = authorizationStatus(error);
    return NextResponse.json(
      { error: status === 401 ? 'No autorizado.' : status === 403 ? 'Acceso restringido.' : 'No se pudo cargar el historial.' },
      { status, headers },
    );
  }
}
