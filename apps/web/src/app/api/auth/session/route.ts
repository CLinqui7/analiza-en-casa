import { NextRequest, NextResponse } from 'next/server';
import { MongoAuthService, mongoAuthStore, sessionCookieName } from '@/server/mongo-auth';
import { mongoDatabase } from '@/server/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = new MongoAuthService(mongoAuthStore(await mongoDatabase()));
    const session = await auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    return NextResponse.json(
      { userId: session.userId, role: session.role },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'No autorizado.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
