import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { purchaseSchema } from '@analiza/contracts';
import { purchaseOrderSchema } from '@/lib/purchase-order';
import { purchaseTotals } from '@/lib/purchase-totals';
import type { ServerActor } from '../validation/patients';

export type ApprovalRow = {
  invoice_group_id: string;
  purchase_order_id: string | null;
  invoice_number: string;
  supplier_catalog_item_id: string;
  total_cents: string;
  approved_at: Date;
};
export class InvalidInvoice extends Error {}
export class ApprovalConflict extends Error {}

export async function approvePurchaseInvoice(
  client: PoolClient,
  actor: ServerActor,
  invoiceGroupId: string,
) {
  const rows = await client.query<{ id: string; body: unknown }>(
    "SELECT id,body FROM analiza.purchases WHERE organization_id=$1 AND (body->>'invoiceGroupId'=$2 OR (id=$2 AND body->>'invoiceGroupId' IS NULL)) ORDER BY id FOR UPDATE",
    [actor.organizationId, invoiceGroupId],
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
      order.receipt?.kind === 'CREDIT_NOTE' ||
      order.supplierCatalogItemId !== first.supplierCatalogItemId ||
      lines.some((line) => !order.items.some((item) => item.catalogItemId === line.catalogItemId))
    )
      throw new InvalidInvoice();
  }
  const totalCents = Math.round(totals.total * 100);
  const existing = await client.query<ApprovalRow>(
    'SELECT invoice_group_id,purchase_order_id,invoice_number,supplier_catalog_item_id,total_cents,approved_at FROM analiza.purchase_invoice_approvals WHERE organization_id=$1 AND invoice_group_id=$2',
    [actor.organizationId, invoiceGroupId],
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
      invoiceGroupId,
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
      invoiceGroupId,
    ],
  );
  return { row: inserted.rows[0], created: true };
}
