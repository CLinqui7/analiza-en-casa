export const dynamic = 'force-dynamic';

/** Liveness is separate from Atlas readiness: do not restart-loop on network outages. */
export function GET() {
  return Response.json({ status: 'alive' }, { headers: { 'Cache-Control': 'no-store' } });
}
