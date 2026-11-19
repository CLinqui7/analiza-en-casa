import { createHash, randomUUID } from 'node:crypto';
import { catalogItemSchema } from '@analiza/contracts';
import type { PoolClient } from 'pg';
import {
  purchaseOrderLineTotal,
  purchaseOrderSchema,
  purchaseOrderTotals,
  type PurchaseOrderInput,
  type PurchaseOrder,
  type OrderAction,
} from '@/lib/purchase-order';
import { MongoConflictError, MongoInputError, type ServerActor } from '../validation/patients';
import { recordPurchaseReceipt } from './postgres-purchase-receipt';

export async function snapshotPurchaseOrder(
  c: PoolClient,
  actor: ServerActor,
  input: PurchaseOrderInput,
) {
  const ids = [
    ...new Set([input.supplierCatalogItemId, ...input.items.map((item) => item.catalogItemId)]),
  ];
  const catalog = await c.query<{ id: string; body: unknown }>(
    'SELECT id,body FROM analiza.catalog_items WHERE organization_id=$1 AND id=ANY($2::text[])',
    [actor.organizationId, ids],
  );
  const items = new Map(catalog.rows.map((row) => [row.id, catalogItemSchema.parse(row.body)]));
  const supplier = items.get(input.supplierCatalogItemId);
  if (supplier?.status !== 'ACTIVE' || supplier.category !== 'PROVIDERS')
    throw new MongoInputError('Seleccione un proveedor activo.');
  const lines = input.items.map((item) => {
    const product = items.get(item.catalogItemId);
    if (
      product?.status !== 'ACTIVE' ||
      !['SUPPLIES', 'MEDICATIONS', 'EQUIPMENT'].includes(product.category ?? '')
    )
      throw new MongoInputError('Seleccione un producto activo del catálogo.');
    return {
      ...item,
      sku: product.sku,
      name: product.name,
      lineTotal: purchaseOrderLineTotal(item.quantity, item.referenceUnitPrice),
    };
  });
  return {
    ...input,
    items: lines,
    supplierName: supplier.name,
    ...purchaseOrderTotals(lines, input.applyPerception === true),
  };
}

export async function changePurchaseOrder(
  c: PoolClient,
  actor: ServerActor,
  id: string,
  input: OrderAction,
) {
  const org = actor.organizationId;
  const locked = await c.query<{ body: unknown }>(
    'SELECT body FROM analiza.purchase_orders WHERE organization_id=$1 AND id=$2 FOR UPDATE',
    [org, id],
  );
  if (!locked.rowCount) throw new MongoInputError('No se encontró la orden.');
  const order = purchaseOrderSchema.parse(locked.rows[0].body);
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  if (
    order.status === 'RECEIVED' &&
    input.action === 'receive' &&
    order.receipt?.fingerprint === fingerprint
  )
    return order;
  if (
    order.status === 'APPROVED' &&
    input.action === 'approve' &&
    order.revision === input.revision + 1
  )
    return order;
  if (
    order.status === 'CANCELLED' &&
    input.action === 'cancel' &&
    order.cancelReason === input.reason &&
    order.revision === input.revision + 1
  )
    return order;
  if (input.revision !== order.revision) throw new MongoConflictError();
  if (order.status === 'DRAFT' && !order.workflowVersion) {
    const linked = await c.query(
      "SELECT 1 FROM analiza.purchases WHERE organization_id=$1 AND body->>'purchaseOrderId'=$2 LIMIT 1",
      [org, id],
    );
    if (linked.rowCount)
      throw new MongoInputError('Esta orden ya tiene una compra histórica vinculada.');
  }
  let updated: PurchaseOrder;
  switch (input.action) {
    case 'edit':
      if (input.order.id !== id || order.status !== 'DRAFT') throw new MongoConflictError();
      updated = { ...order, ...(await snapshotPurchaseOrder(c, actor, input.order)) };
      break;
    case 'approve':
      if (order.status !== 'DRAFT') throw new MongoConflictError();
      updated = { ...order, status: 'APPROVED' };
      break;
    case 'cancel':
      if (order.status === 'RECEIVED') {
        // Finance locks these same lines in this order. Whichever action wins remains authoritative.
        await c.query(
          "SELECT id FROM analiza.purchases WHERE organization_id=$1 AND body->>'invoiceGroupId'=$2 ORDER BY id FOR UPDATE",
          [org, id],
        );
        const approved = await c.query(
          'SELECT 1 FROM analiza.purchase_invoice_approvals WHERE organization_id=$1 AND invoice_group_id=$2',
          [org, id],
        );
        if (approved.rowCount)
          throw new MongoInputError(
            'Financiero ya aprobó este documento. La anulación requiere conciliación de la cuenta por pagar.',
          );
        await c.query(
          "UPDATE analiza.purchases SET body=body || jsonb_build_object('invoiceVoidedAt',$3::text,'invoiceVoidReason',$4::text) WHERE organization_id=$1 AND body->>'invoiceGroupId'=$2",
          [org, id, new Date().toISOString(), input.reason],
        );
      } else if (!['APPROVED', 'DRAFT'].includes(order.status)) throw new MongoConflictError();
      updated = { ...order, status: 'CANCELLED', cancelReason: input.reason };
      break;
    case 'receive':
      if (order.status !== 'APPROVED') throw new MongoConflictError();
      await recordPurchaseReceipt(c, actor, order, input);
      updated = {
        ...order,
        status: 'RECEIVED',
        receipt: { kind: input.documentKind, number: input.documentNumber, fingerprint },
      };
      break;
  }
  updated.revision++;
  updated.workflowVersion = 1;
  await c.query(
    'UPDATE analiza.purchase_orders SET body=$3::jsonb WHERE organization_id=$1 AND id=$2',
    [org, id, JSON.stringify(updated)],
  );
  await c.query(
    'INSERT INTO analiza.purchase_order_revisions(organization_id,order_id,revision,actor_user_id,action,previous_body) VALUES($1,$2,$3,$4,$5,$6::jsonb)',
    [org, id, order.revision, actor.userId, input.action, JSON.stringify(order)],
  );
  await c.query(
    'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
    [org, randomUUID(), actor.userId, `purchase_order.${input.action}`, 'purchase_orders', id],
  );
  return updated;
}
