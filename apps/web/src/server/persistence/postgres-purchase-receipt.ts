import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { inventoryTraceRecordSchema, purchaseSchema } from '@analiza/contracts';
import { receiptWarehouseNames, type OrderAction, type PurchaseOrder } from '@/lib/purchase-order';
import { MongoInputError, type ServerActor } from '../validation/patients';

type Receive = Extract<OrderAction, { action: 'receive' }>;

async function resolveWarehouse(
  c: PoolClient,
  actor: ServerActor,
  destination: Receive['destination'],
  now: string,
) {
  const name = receiptWarehouseNames[destination];
  const code = destination === 'GENERAL' ? 'BOD-AC01G' : 'BOD-AC02';
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `purchase-warehouse:${actor.organizationId}:${code}`,
  ]);
  const existing = await c.query<{ id: string; status: string }>(
    `SELECT id,status FROM analiza.warehouses WHERE organization_id=$1
      AND (translate(lower(btrim(body->>'name')), 'áéíóúü', 'aeiouu') = $2 OR code_normalized=$3)
      ORDER BY id LIMIT 2`,
    [
      actor.organizationId,
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase(),
      code,
    ],
  );
  if (existing.rows.length > 1)
    throw new MongoInputError(
      'Más de una bodega coincide con el destino. Revise los códigos y nombres en Existencias.',
    );
  if (existing.rows[0]) {
    if (existing.rows[0].status !== 'ACTIVE')
      throw new MongoInputError('La bodega está inactiva. Actívela en Existencias.');
    return existing.rows[0].id;
  }
  const id = randomUUID();
  const body = { id, name, code, status: 'ACTIVE', createdAt: now, updatedAt: now };
  await c.query(
    "INSERT INTO analiza.warehouses(organization_id,id,code_normalized,status,body) VALUES($1,$2,$3,'ACTIVE',$4::jsonb)",
    [actor.organizationId, id, code, JSON.stringify(body)],
  );
  await c.query(
    "INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,'WAREHOUSE_CREATED','warehouse',$4)",
    [actor.organizationId, randomUUID(), actor.userId, id],
  );
  return id;
}

export function buildReceiptLines(
  order: PurchaseOrder,
  input: Receive,
  categories: Map<string, string>,
  warehouseId: string,
  now: string,
) {
  if (
    input.lines.length !== order.items.length ||
    new Set(input.lines.map((line) => line.index)).size !== order.items.length
  )
    throw new MongoInputError('Revise todas las líneas de la orden.');
  const serials = new Set<string>();
  const result = [];
  for (const line of input.lines) {
    const source = order.items[line.index];
    if (!source || line.quantity > source.quantity)
      throw new MongoInputError('La cantidad recibida excede la orden.');
    if (!line.quantity) continue;
    const category = categories.get(source.catalogItemId);
    if (!category || !['SUPPLIES', 'MEDICATIONS', 'EQUIPMENT'].includes(category))
      throw new MongoInputError('La orden contiene un producto inactivo.');
    const equipment = category === 'EQUIPMENT';
    if (
      equipment
        ? line.serialNumbers.length !== line.quantity
        : !line.lotNumber || !line.expiresOn || line.serialNumbers.length
    )
      throw new MongoInputError(
        equipment
          ? 'Indique una serie distinta por cada equipo recibido.'
          : 'Indique lote y vencimiento por cada medicamento o insumo recibido.',
      );
    for (const [serialIndex, rawNumber] of (equipment
      ? line.serialNumbers
      : [line.lotNumber]
    ).entries()) {
      const number = rawNumber.trim().toUpperCase();
      if (equipment && serials.has(number))
        throw new MongoInputError('Cada equipo debe tener una serie distinta.');
      if (equipment) serials.add(number);
      const id = `oc:${order.id}:${line.index}:${serialIndex}`;
      const qty = equipment ? 1 : line.quantity;
      const trace = inventoryTraceRecordSchema.parse({
        id,
        itemId: source.catalogItemId,
        supplierCatalogItemId: order.supplierCatalogItemId,
        kind: equipment ? 'SERIAL' : 'LOT',
        number,
        receivedQuantity: qty,
        expiresOn: equipment ? undefined : line.expiresOn,
        qualityStatus: 'QUARANTINED',
        receiptReference: input.documentNumber,
        createdAt: now,
        updatedAt: now,
        receivedAt: now,
        balances: [],
      });
      const purchase = purchaseSchema.parse({
        id,
        catalogItemId: source.catalogItemId,
        supplierCatalogItemId: order.supplierCatalogItemId,
        warehouseId,
        reference: order.orderNumber,
        invoiceNumber: input.documentNumber,
        invoiceGroupId: order.id,
        purchaseOrderId: order.id,
        usefulLife: line.usefulLife || undefined,
        isFixedAsset: line.isFixedAsset,
        quantity: qty,
        unitCost: source.referenceUnitPrice,
        taxRates: { iva: 0.13, perception: order.applyPerception ? 0.01 : 0 },
        expirationDate: line.expiresOn || undefined,
        serialNumber: equipment ? number : undefined,
        lotNumber: line.lotNumber || undefined,
        status: 'RECEIVED',
        receivedAt: now,
        traceRecordId: id,
        createdAt: now,
      });
      result.push({
        id,
        trace,
        purchase: {
          ...purchase,
          providerDocumentKind: input.documentKind,
          purchaseOrderLineIndex: line.index,
        },
      });
    }
  }
  if (!result.length) throw new MongoInputError('Indique al menos una unidad recibida.');
  return result;
}

export async function recordPurchaseReceipt(
  c: PoolClient,
  actor: ServerActor,
  order: PurchaseOrder,
  input: Receive,
) {
  const org = actor.organizationId;
  const now = new Date().toISOString();
  const documentIdentity = [
    org,
    order.supplierCatalogItemId,
    input.documentKind,
    input.documentNumber.toUpperCase(),
  ];
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    JSON.stringify(documentIdentity),
  ]);
  const duplicate = await c.query(
    `SELECT 1 FROM analiza.purchases WHERE organization_id=$1 AND body->>'supplierCatalogItemId'=$2
    AND coalesce(body->>'providerDocumentKind','INVOICE')=$3 AND upper(btrim(body->>'invoiceNumber'))=$4 LIMIT 1`,
    documentIdentity,
  );
  if (duplicate.rowCount)
    throw new MongoInputError('Este número de documento ya está registrado para el proveedor.');
  const catalog = await c.query<{ id: string; category: string }>(
    `SELECT id, body->>'category' AS category FROM analiza.catalog_items
    WHERE organization_id=$1 AND id=ANY($2::text[]) AND body->>'status'='ACTIVE'`,
    [org, order.items.map((i) => i.catalogItemId)],
  );
  const warehouseId = await resolveWarehouse(c, actor, input.destination, now);
  const records = buildReceiptLines(
    order,
    input,
    new Map(catalog.rows.map((i) => [i.id, i.category])),
    warehouseId,
    now,
  );
  const data = JSON.stringify(records);
  // Bulk inserts are in the caller's transaction. Physical stock starts in quarantine.
  const rows = 'FROM jsonb_to_recordset($2::jsonb) AS r(id text, trace jsonb, purchase jsonb)';
  await c.query(
    `INSERT INTO analiza.inventory_trace_records(organization_id,id,kind,item_id,supplier_catalog_item_id,number_normalized,quality_status,expires_on,received_at,body,created_at,updated_at)
    SELECT $1,id,trace->>'kind',trace->>'itemId',trace->>'supplierCatalogItemId',trace->>'number','QUARANTINED',(trace->>'expiresOn')::date,(trace->>'receivedAt')::timestamptz,trace,now(),now() ${rows}`,
    [org, data],
  );
  await c.query(
    `INSERT INTO analiza.inventory_trace_balances(organization_id,trace_record_id,warehouse_id,quantity)
    SELECT $1,id,purchase->>'warehouseId',(purchase->>'quantity')::integer ${rows}`,
    [org, data],
  );
  await c.query(
    `INSERT INTO analiza.inventory_trace_events(organization_id,id,trace_record_id,event_type,idempotency_key,body,occurred_at)
    SELECT $1,id,id,'RECEIVED',id,jsonb_build_object('id',id,'purchaseId',id,'itemId',trace->>'itemId','quantity',purchase->'quantity','warehouseId',purchase->>'warehouseId','receiptReference',trace->>'receiptReference','receivedAt',trace->>'receivedAt'),now() ${rows}`,
    [org, data],
  );
  await c.query(
    `INSERT INTO analiza.purchases(organization_id,id,warehouse_id,body) SELECT $1,id,purchase->>'warehouseId',purchase ${rows}`,
    [org, data],
  );
}
