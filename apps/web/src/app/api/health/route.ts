import { mongoDatabase } from '@/server/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

/** Readiness only; no credentials, topology, patient data or error messages. */
export async function GET() {
  try {
    const database = await mongoDatabase();
    await database.command({ ping: 1 }, { timeoutMS: 2000 });
    return Response.json({ status: 'ready' }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
