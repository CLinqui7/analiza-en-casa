import { NextRequest, NextResponse } from 'next/server';
import { persistence } from '@/server/persistence';
import { privateHeaders } from '@/server/auth-http';
import { sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    if (!backend.nurseProfile) {
      return NextResponse.json(
        { error: 'No disponible.' },
        { status: 404, headers: privateHeaders },
      );
    }
    return NextResponse.json(await backend.nurseProfile.listForAdmin(actor), {
      headers: privateHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'No fue posible cargar los cuestionarios.' },
      { status: authorizationStatus(error), headers: privateHeaders },
    );
  }
}
