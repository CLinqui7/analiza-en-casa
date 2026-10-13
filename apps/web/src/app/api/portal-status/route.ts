import { NextRequest, NextResponse } from 'next/server';
import { MongoPortalService } from '@/server/mongo-portal';
import { mongoDatabase } from '@/server/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (process.env.ANALIZA_DATA_MODE !== 'mongodb') throw new Error('Portal is unavailable.');
    const database = await mongoDatabase();
    const snapshot = await new MongoPortalService(database).verify(
      await request.json().catch(() => null),
      request,
    );
    if (!snapshot)
      return NextResponse.json(
        { error: 'No fue posible validar el acceso.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'Servicio temporalmente no disponible.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
