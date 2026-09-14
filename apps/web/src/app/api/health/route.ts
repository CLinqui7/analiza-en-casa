import { persistence } from '@/server/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

/** Readiness only; no credentials, topology, patient data or error messages. */
export async function GET() {
  try {
    await (await persistence()).ready();
    return Response.json({ status: 'ready' }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
