import { NextRequest, NextResponse } from 'next/server';
import { can } from '@/lib/permissions';
import { buildPurchaseOrderPdf } from '@/lib/purchase-order-pdf';
import { purchaseOrderInputSchema } from '@/lib/purchase-order';
import { purchaseOrderSchema } from '@/lib/purchase-order';
import { sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { MongoAccessError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (process.env.ANALIZA_DATA_MODE !== 'postgresql') throw new MongoAccessError();
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    if (!can(actor.role, 'purchases:read')) throw new MongoAccessError();
    const id = (await context.params).id;
    if (!purchaseOrderInputSchema.shape.id.safeParse(id).success)
      return NextResponse.json(
        { error: 'Orden no encontrada.' },
        { status: 404, headers: noStore },
      );
    const row = await transaction(
      postgresPool(),
      actor,
      async (client) =>
        (
          await client.query<{ body: unknown }>(
            'SELECT body FROM analiza.purchase_orders WHERE organization_id=$1 AND id=$2',
            [actor.organizationId, id],
          )
        ).rows[0],
    );
    if (!row)
      return NextResponse.json(
        { error: 'Orden no encontrada.' },
        { status: 404, headers: noStore },
      );
    const order = purchaseOrderSchema.parse(row.body);
    const bytes = await buildPurchaseOrderPdf(order);
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        ...noStore,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${request.nextUrl.searchParams.get('inline') === '1' ? 'inline' : 'attachment'}; filename="orden-compra-${order.id}.pdf"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const status = authorizationStatus(error);
    return NextResponse.json(
      { error: status === 401 ? 'Inicie sesión para continuar.' : 'No tiene autorización.' },
      { status, headers: noStore },
    );
  }
}
