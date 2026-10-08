import { NextRequest, NextResponse } from 'next/server';
import { sessionCookieName } from '@/server/auth-service';
import { persistence } from '@/server/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    return NextResponse.json(
      { commercialAccess: await backend.operations.access(actor) },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch {
    return NextResponse.json(
      { commercialAccess: null },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
