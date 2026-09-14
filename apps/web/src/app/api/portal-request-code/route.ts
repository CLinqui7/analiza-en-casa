import { NextRequest, NextResponse } from 'next/server';
import { MongoPortalService, portalDeliveryConfigured } from '@/server/mongo-portal';
import { mongoDatabase } from '@/server/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const message = 'Si el enlace es válido, enviamos un código al canal registrado.';

export async function POST(request: NextRequest) {
  try {
    if (!portalDeliveryConfigured()) throw new Error('Portal delivery is not configured.');
    const database = await mongoDatabase();
    await new MongoPortalService(database).requestCode(
      await request.json().catch(() => null),
      request,
    );
    return NextResponse.json(
      { message },
      { status: 202, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Servicio temporalmente no disponible.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
