import { purchaseSchema } from '@analiza/contracts';
import { NextRequest, NextResponse } from 'next/server';
import { can } from '@/lib/permissions';
import { buildPurchaseInvoicePdf } from '@/lib/purchase-invoice-pdf';
import { sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { MongoAccessError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (process.env.ANALIZA_DATA_MODE !== 'postgresql') throw new MongoAccessError();
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    if (!can(actor.role, 'purchases:read')) throw new MongoAccessError();
    const { id } = await params;
    if (id.length > 120 || !/^[A-Za-z0-9:_-]+$/.test(id))
      return NextResponse.json(
        { error: 'Compra no encontrada.' },
        { status: 404, headers: privateHeaders },
      );
    const data = await transaction(postgresPool(), actor, async (client) => {
      const rows = await client.query<{ body: unknown }>(
        "SELECT body FROM analiza.purchases WHERE organization_id=$1 AND (body->>'invoiceGroupId'=$2 OR (id=$2 AND body->>'invoiceGroupId' IS NULL)) ORDER BY created_at,id LIMIT 100",
        [actor.organizationId, id],
      );
      const lines = rows.rows.map((row) => purchaseSchema.parse(row.body));
      if (!lines.length) return null;
      const ids = [
        ...new Set([
          lines[0].supplierCatalogItemId ?? '',
          ...lines.map((line) => line.catalogItemId),
        ]),
      ];
      const catalog = await client.query<{ id: string; body: { name?: string } }>(
        'SELECT id,body FROM analiza.catalog_items WHERE organization_id=$1 AND id=ANY($2::text[])',
        [actor.organizationId, ids],
      );
      return {
        lines,
        names: new Map(catalog.rows.map((row) => [row.id, row.body.name ?? row.id])),
      };
    });
    if (!data)
      return NextResponse.json(
        { error: 'Compra no encontrada.' },
        { status: 404, headers: privateHeaders },
      );
    const bytes = await buildPurchaseInvoicePdf(data.lines, data.names);
    return new Response(Buffer.from(bytes), {
      headers: {
        ...privateHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${request.nextUrl.searchParams.get('inline') === '1' ? 'inline' : 'attachment'}; filename="compra-${encodeURIComponent(id)}.pdf"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const status = authorizationStatus(error);
    return NextResponse.json(
      { error: status === 401 ? 'Inicie sesión para continuar.' : 'No se pudo generar el PDF.' },
      { status, headers: privateHeaders },
    );
  }
}
