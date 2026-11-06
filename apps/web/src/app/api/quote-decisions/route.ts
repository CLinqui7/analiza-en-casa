import { NextRequest, NextResponse } from 'next/server';
import { can } from '@/lib/permissions';
import { quoteDecisionSchema } from '@/lib/quote-decision';
import { privateHeaders } from '@/server/auth-http';
import { sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (process.env.ANALIZA_DATA_MODE !== 'postgresql')
      return NextResponse.json({ decisions: [] }, { headers: privateHeaders });
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    if (!can(actor.role, 'quotes:read'))
      return NextResponse.json(
        { error: 'No tiene autorización.' },
        { status: 403, headers: privateHeaders },
      );
    const decisions = await transaction(postgresPool(), actor, async (client) => {
      const result = await client.query<{
        id: string;
        quote_id: string;
        decision: string;
        reason: string | null;
        created_at: Date;
      }>(
        'SELECT DISTINCT ON (quote_id) id,quote_id,decision,reason,created_at FROM analiza.quote_decisions WHERE organization_id=$1 ORDER BY quote_id,created_at DESC,id DESC',
        [actor.organizationId],
      );
      return result.rows.map((row) =>
        quoteDecisionSchema.parse({
          id: row.id,
          quoteId: row.quote_id,
          decision: row.decision,
          reason: row.reason,
          createdAt: row.created_at.toISOString(),
        }),
      );
    });
    return NextResponse.json({ decisions }, { headers: privateHeaders });
  } catch (error) {
    const status = authorizationStatus(error);
    return NextResponse.json(
      { error: status === 401 ? 'Inicie sesión.' : 'No fue posible consultar las decisiones.' },
      { status, headers: privateHeaders },
    );
  }
}
