/** End-to-end SQL with synthetic data and separate financial approval. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  postgresPool,
  transaction,
  closePostgresPool,
} from '../apps/web/src/server/persistence/postgres-pool';
import {
  changePurchaseOrder,
  snapshotPurchaseOrder,
} from '../apps/web/src/server/persistence/postgres-purchase-orders';
import { approvePurchaseInvoice } from '../apps/web/src/server/persistence/postgres-purchase-approval';
import { purchaseOrderSchema, type OrderAction } from '../apps/web/src/lib/purchase-order';

assert.equal(process.env.ANALIZA_QA_MODE, '1');
assert.equal(process.env.PGDATABASE, 'analiza_qa');
assert.equal(process.env.PGHOST, '127.0.0.1');
const pool = postgresPool();
const actor = { userId: 'qa-admin', organizationId: 'qa-org-a', role: 'ADMIN' as const };
const org = actor.organizationId;
const run = randomUUID().slice(0, 8),
  now = new Date().toISOString();
const supplierId = 'qa-supplier-' + run,
  itemId = 'qa-supply-' + run;
async function draft() {
  return transaction(pool, actor, async (c) => {
    const data = {
      id: randomUUID(),
      supplierCatalogItemId: supplierId,
      items: [{ catalogItemId: itemId, quantity: 5, referenceUnitPrice: 1.725 }],
    };
    const snapshot = await snapshotPurchaseOrder(c, actor, data);
    const order = purchaseOrderSchema.parse({
      ...snapshot,
      issuedAt: now,
      orderNumber: 'QA-' + data.id,
      fingerprint: 'a'.repeat(64),
      workflowVersion: 1,
    });
    await c.query(
      'INSERT INTO analiza.purchase_orders(organization_id,id,created_by,body) VALUES($1,$2,$3,$4)',
      [org, order.id, actor.userId, JSON.stringify(order)],
    );
    return order;
  });
}
const act = (id: string, command: OrderAction) =>
  transaction(pool, actor, (c) => changePurchaseOrder(c, actor, id, command));
const approveDoc = (group: string) =>
  transaction(pool, actor, (c) => approvePurchaseInvoice(c, actor, group));
const receive = (
  documentNumber: string,
  revision: number,
): Extract<OrderAction, { action: 'receive' }> => ({
  action: 'receive',
  revision,
  destination: 'KIT',
  documentKind: 'INVOICE',
  documentNumber,
  lines: [
    {
      index: 0,
      quantity: 4,
      lotNumber: 'QA-' + run,
      expiresOn: '2030-01-01',
      usefulLife: 'Prueba',
      isFixedAsset: false,
      serialNumbers: [],
    },
  ],
});
try {
  await transaction(pool, actor, async (c) => {
    const kit = {
      id: 'qa-kit-order-reception',
      code: 'BOD-AC02',
      name: 'BOTIQUIN ANALIZA',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    await c.query(
      "INSERT INTO analiza.warehouses(organization_id,id,code_normalized,status,body) VALUES($1,$2,$3,'ACTIVE',$4::jsonb) ON CONFLICT DO NOTHING",
      [org, kit.id, kit.code, JSON.stringify(kit)],
    );
    for (const [id, category] of [
      [supplierId, 'PROVIDERS'],
      [itemId, 'SUPPLIES'],
    ]) {
      const body = {
        id,
        category,
        sku: id,
        name: 'Artículo QA ' + id,
        status: 'ACTIVE',
        createdAt: now,
      };
      await c.query('INSERT INTO analiza.catalog_items(organization_id,id,body) VALUES($1,$2,$3)', [
        org,
        id,
        JSON.stringify(body),
      ]);
    }
  });
  const order = await draft();
  await assert.rejects(act(order.id, receive('QA-' + run, 1)));
  const update = {
    id: order.id,
    supplierCatalogItemId: supplierId,
    items: [{ catalogItemId: itemId, quantity: 5, referenceUnitPrice: 2.125 }],
  };
  const result = await Promise.allSettled([
    act(order.id, { action: 'edit', revision: 1, order: update }),
    act(order.id, { action: 'edit', revision: 1, order: update }),
  ]);
  assert.equal(result.filter((x) => x.status === 'fulfilled').length, 1);
  const approved = await act(order.id, { action: 'approve', revision: 2 });
  assert.equal(approved.status, 'APPROVED');
  const request = receive('QA-' + run, 3);
  const copies = await Promise.all([act(order.id, request), act(order.id, request)]);
  assert.equal(copies[0].receipt?.fingerprint, copies[1].receipt?.fingerprint);
  const lineId = await transaction(pool, actor, async (c) => {
    const rows = await c.query<{
      id: string;
      balance: number;
      warehouse_code: string;
      events: string;
      approvals: string;
      quantity: number;
    }>(
      `SELECT p.id, (p.body->>'quantity')::integer quantity,
      b.quantity balance,(SELECT code_normalized FROM analiza.warehouses WHERE organization_id=p.organization_id AND id=b.warehouse_id) warehouse_code,(SELECT count(*) FROM analiza.inventory_trace_events e WHERE e.organization_id=p.organization_id AND e.trace_record_id=p.id) events,
      (SELECT count(*) FROM analiza.purchase_invoice_approvals a WHERE a.organization_id=p.organization_id AND a.purchase_order_id=$2) approvals
      FROM analiza.purchases p JOIN analiza.inventory_trace_balances b ON p.organization_id=b.organization_id AND p.id=b.trace_record_id WHERE p.organization_id=$1 AND p.body->>'purchaseOrderId'=$2::text`,
      [org, order.id],
    );
    assert.equal(rows.rowCount, 1);
    assert.equal(rows.rows[0].warehouse_code, 'BOD-AC02');
    assert.equal(rows.rows[0].quantity, 4);
    assert.equal(rows.rows[0].balance, 4);
    assert.equal(Number(rows.rows[0].events), 1);
    assert.equal(Number(rows.rows[0].approvals), 0);
    return rows.rows[0].id;
  });
  await assert.rejects(approveDoc(lineId));
  const approvals = await Promise.all([approveDoc(order.id), approveDoc(order.id)]);
  assert.equal(approvals.filter((a) => a.created).length, 1);
  assert.equal(Number(approvals[0].row.total_cents), 961);
  await assert.rejects(
    act(order.id, { action: 'cancel', revision: 4, reason: 'QA después de aprobación financiera' }),
  );
  const other = await draft();
  await act(other.id, { action: 'approve', revision: 1 });
  await assert.rejects(act(other.id, { ...request, revision: 2 }));
  const voided = await act(other.id, {
    action: 'cancel',
    reason: 'Orden duplicada de prueba',
    revision: 2,
  });
  assert.equal(voided.cancelReason, 'Orden duplicada de prueba');
  await assert.rejects(act(other.id, { ...request, documentNumber: 'OTHER', revision: 3 }));
  const credit = await draft();
  await act(credit.id, { action: 'approve', revision: 1 });
  await act(credit.id, { ...receive('CN-' + run, 2), documentKind: 'CREDIT_NOTE' });
  await assert.rejects(approveDoc(credit.id));
  await act(credit.id, { action: 'cancel', revision: 3, reason: 'Documento de prueba sustituido' });
  await transaction(pool, actor, async (c) => {
    const body = (
      await c.query(
        "SELECT body FROM analiza.purchases WHERE organization_id=$1 AND body->>'invoiceGroupId'=$2",
        [org, credit.id],
      )
    ).rows[0].body;
    assert.equal(body.status, 'RECEIVED');
    assert.equal(body.invoiceVoidReason, 'Documento de prueba sustituido');
    assert.ok(body.invoiceVoidedAt);
  });
  const otherTenant = { ...actor, organizationId: 'qa-org-c', userId: 'qa-foreign' };
  await assert.rejects(
    transaction(pool, otherTenant, (c) => changePurchaseOrder(c, otherTenant, order.id, request)),
  );
  console.log(
    'PASS · orden editable y bloqueo de edición simultánea, aprobación de orden, recepción parcial idempotente, Kárdex físico, ausencia de deuda automática, aprobación financiera única, rechazo de aprobar línea aislada, documento duplicado, anulación auditada, nota de crédito sin deuda positiva y aislamiento por organización.',
  );
} finally {
  await closePostgresPool();
}
