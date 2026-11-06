import { randomUUID } from 'node:crypto';
import { purchaseSchema } from '@analiza/contracts';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { can } from '@/lib/permissions';
import { purchaseOrderSchema } from '@/lib/purchase-order';
import { purchaseTotals } from '@/lib/purchase-totals';
import { boundedJson, privateHeaders } from '@/server/auth-http';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { MongoAccessError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inputSchema = z.object({ invoiceGroupId: z.string().trim().min(1).max(120) }).strict();
type ApprovalRow = {
  invoice_group_id: string;
  purchase_order_id: string | null;
  invoice_number: string;
  supplier_catalog_item_id: string;
  total_cents: string;
  approved_at: Date;
};
class InvalidInvoice extends Error {}
class ApprovalConflict extends Error {}

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
      const rows = await client.query<{ id: string; body: unknown }>(
        "SELECT id,body FROM analiza.purchases WHERE organization_id=$1 AND (body->>'invoiceGroupId'=$2 OR id=$2) ORDER BY id FOR UPDATE",
        [actor.organizationId, input.invoiceGroupId],
      );
      const lines = rows.rows.map((row) => purchaseSchema.parse(row.body));
      const first = lines[0];
      const totals = purchaseTotals(lines);
      if (
        !first ||
        !totals ||
        !first.invoiceNumber ||
        lines.some(
          (line) =>
            line.status !== 'RECEIVED' ||
            line.invoiceVoidedAt ||
            line.invoiceNumber !== first.invoiceNumber ||
            line.supplierCatalogItemId !== first.supplierCatalogItemId ||
            line.purchaseOrderId !== first.purchaseOrderId,
        )
      )
        throw new InvalidInvoice();
      if (first.purchaseOrderId) {
        const orderRow = await client.query<{ body: unknown }>(
          'SELECT body FROM analiza.purchase_orders WHERE organization_id=$1 AND id=$2',
          [actor.organizationId, first.purchaseOrderId],
        );
        const order = orderRow.rows[0] ? purchaseOrderSchema.parse(orderRow.rows[0].body) : null;
        if (
          !order ||
          order.supplierCatalogItemId !== first.supplierCatalogItemId ||
          lines.some(
            (line) => !order.items.some((item) => item.catalogItemId === line.catalogItemId),
          )
        )
          throw new InvalidInvoice();
      }
      const totalCents = Math.round(totals.total * 100);
      const existing = await client.query<ApprovalRow>(
        'SELECT invoice_group_id,purchase_order_id,invoice_number,supplier_catalog_item_id,total_cents,approved_at FROM analiza.purchase_invoice_approvals WHERE organization_id=$1 AND invoice_group_id=$2',
        [actor.organizationId, input.invoiceGroupId],
      );
      if (existing.rows[0]) {
        if (
          Number(existing.rows[0].total_cents) !== totalCents ||
          existing.rows[0].invoice_number !== first.invoiceNumber ||
          existing.rows[0].purchase_order_id !== (first.purchaseOrderId ?? null)
        )
          throw new ApprovalConflict();
        return { row: existing.rows[0], created: false };
      }
      const inserted = await client.query<ApprovalRow>(
        'INSERT INTO analiza.purchase_invoice_approvals(organization_id,invoice_group_id,purchase_order_id,invoice_number,supplier_catalog_item_id,total_cents,approved_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING invoice_group_id,purchase_order_id,invoice_number,supplier_catalog_item_id,total_cents,approved_at',
        [
          actor.organizationId,
          input.invoiceGroupId,
          first.purchaseOrderId ?? null,
          first.invoiceNumber,
          first.supplierCatalogItemId,
          totalCents,
          actor.userId,
        ],
      );
      await client.query(
        'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          actor.organizationId,
          randomUUID(),
          actor.userId,
          'purchase_invoice.approved',
          'purchase_invoice',
          input.invoiceGroupId,
        ],
      );
      return { row: inserted.rows[0], created: true };
    });
    return NextResponse.json(responseBody(result.row), {
      status: result.created ? 201 : 200,
      headers: privateHeaders,
    });
  } catch (error) {
    return failure(error);
  }
}
