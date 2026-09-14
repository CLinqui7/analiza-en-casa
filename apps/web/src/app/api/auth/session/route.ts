import { persistence } from '@/server/persistence';
import { NextRequest, NextResponse } from 'next/server';
import { sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = (await persistence()).auth;
    const session = await auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    return NextResponse.json(
      { userId: session.userId, role: session.role },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const status = authorizationStatus(error);
    return NextResponse.json(
      { error: status === 401 ? 'No autorizado.' : 'El acceso seguro no está disponible.' },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
