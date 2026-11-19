import {
  approvePurchaseInvoice,
  InvalidInvoice,
  ApprovalConflict,
  type ApprovalRow,
} from '@/server/persistence/postgres-purchase-approval';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { can } from '@/lib/permissions';
import { boundedJson, privateHeaders } from '@/server/auth-http';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { MongoAccessError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inputSchema = z.object({ invoiceGroupId: z.string().trim().min(1).max(120) }).strict();
async function actorFor(request: NextRequest, write: boolean) {
  if (process.env.ANALIZA_DATA_MODE !== 'postgresql') throw new MongoAccessError();
  const backend = await persistence();
  const token = request.cookies.get(sessionCookieName)?.value;
  const actor = await backend.auth.requireSession(token);
  if (!can(actor.role, write ? 'payments:write' : 'payments:read')) throw new MongoAccessError();
  if (write)
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
  return actor;
}

function responseBody(row: ApprovalRow) {
  return {
    invoiceGroupId: row.invoice_group_id,
    purchaseOrderId: row.purchase_order_id,
    invoiceNumber: row.invoice_number,
    supplierCatalogItemId: row.supplier_catalog_item_id,
    total: Number(row.total_cents) / 100,
    approvedAt: row.approved_at.toISOString(),
  };
}

function failure(error: unknown) {
  const status =
    error instanceof InvalidInvoice || error instanceof z.ZodError || error instanceof SyntaxError
      ? 400
      : error instanceof ApprovalConflict
        ? 409
        : authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 400
          ? 'La factura debe estar recibida, vigente, completa y vinculada a una orden válida cuando se indique.'
          : status === 409
            ? 'Esta factura ya tiene una aprobación diferente.'
            : status === 401
              ? 'Inicie sesión.'
              : status === 403
                ? 'No tiene autorización.'
                : 'No fue posible aprobar la factura.',
    },
    { status, headers: privateHeaders },
  );
}

export async function GET(request: NextRequest) {
  try {
    const actor = await actorFor(request, false);
    const approvals = await transaction(postgresPool(), actor, async (client) => {
      const rows = await client.query<ApprovalRow>(
        'SELECT invoice_group_id,purchase_order_id,invoice_number,supplier_catalog_item_id,total_cents,approved_at FROM analiza.purchase_invoice_approvals WHERE organization_id=$1 ORDER BY approved_at DESC',
        [actor.organizationId],
      );
      return rows.rows.map(responseBody);
    });
    return NextResponse.json({ approvals }, { headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await actorFor(request, true);
    const input = inputSchema.parse(await boundedJson(request, 4096));
    const result = await transaction(postgresPool(), actor, async (client) => {
      return approvePurchaseInvoice(client, actor, input.invoiceGroupId);
    });
    return NextResponse.json(responseBody(result.row), {
      status: result.created ? 201 : 200,
      headers: privateHeaders,
    });
  } catch (error) {
    return failure(error);
  }
}
