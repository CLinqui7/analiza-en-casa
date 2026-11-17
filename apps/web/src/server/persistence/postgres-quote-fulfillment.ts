import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { quoteSchema } from '@analiza/contracts';
import { calculateQuoteTotals, createQuoteRevision } from '@analiza/domain';
import { can } from '@/lib/permissions';
import {
  assignSupplySchema,
  deliverOrderSchema,
  type PrequoteInbox,
  type ReceivedOrderInbox,
} from '@/lib/quote-fulfillment';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  type ServerActor,
} from '../validation/patients';
import { transaction } from './postgres-pool';
import { lockQuoteRoot, requireOpenQuote } from './quote-workflow';

async function audit(c: PoolClient, actor: ServerActor, action: string, kind: string, id: string) {
  await c.query(
    'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
    [actor.organizationId, randomUUID(), actor.userId, action, kind, id],
  );
}
const latestQuotes = `SELECT DISTINCT ON (root_quote_id) id,root_quote_id,patient_id,body,record_version,quote_version,created_at
  FROM analiza.quotes WHERE organization_id=$1 ORDER BY root_quote_id,quote_version DESC`;
const terminal = `SELECT 1 FROM analiza.quote_decisions d JOIN analiza.quotes qd ON qd.organization_id=d.organization_id AND qd.id=d.quote_id
  WHERE qd.organization_id=$1 AND qd.root_quote_id=q.root_quote_id`;
const orderLines = `WITH q AS (${latestQuotes}), lines AS (
  SELECT q.id AS "quoteId",q.root_quote_id AS "rootId",q.created_at AS "createdAt",p.body->>'fullName' AS "patientName",line->>'id' AS "lineId",
  line->>'name' AS "itemName",(line->>'quantity')::numeric AS quantity,q.body->>'status' AS status
  FROM q JOIN analiza.patients p ON p.organization_id=$1 AND p.id=q.patient_id CROSS JOIN LATERAL jsonb_array_elements(q.body->'items') line
  WHERE line->>'category' IN ('MEDICATIONS','SUPPLIES') AND NOT EXISTS (${terminal} AND d.decision='NOT_APPROVED')
)`;

export async function prequoteInbox(
  pool: Pool,
  actor: ServerActor,
  page: number,
): Promise<PrequoteInbox> {
  if (!can(actor.role, 'quotes:write')) throw new MongoAccessError();
  return transaction(pool, actor, async (c) => {
    const entries = await c.query(
      `SELECT r.id,r.created_at AS "createdAt",r.patient_id AS "patientId",p.body->>'fullName' AS "patientName",
      i.body->>'name' AS "itemName",r.quantity,r.note,r.priority,r.requested_by AS "requestedBy",
      CASE WHEN i.body->>'status'='ACTIVE' THEN (i.body->>'salePriceExcludingTax')::numeric ELSE NULL END AS "unitPrice",
      a.quote_id AS "assignedQuoteId",a.root_quote_id AS "rootQuoteId",latest.id AS "currentQuoteId",
      EXISTS(SELECT 1 FROM jsonb_array_elements(latest.body->'items') line WHERE line->>'id'=a.line_id) AS "assignmentPresent"
      FROM analiza.supply_requests r JOIN analiza.patients p ON p.organization_id=r.organization_id AND p.id=r.patient_id
      JOIN analiza.catalog_items i ON i.organization_id=r.organization_id AND i.id=r.catalog_item_id
      LEFT JOIN analiza.supply_request_assignments a ON a.organization_id=r.organization_id AND a.request_id=r.id
      LEFT JOIN LATERAL (SELECT q.id,q.body FROM analiza.quotes q WHERE q.organization_id=r.organization_id AND q.root_quote_id=a.root_quote_id ORDER BY q.quote_version DESC LIMIT 1) latest ON true
      WHERE r.organization_id=$1 ORDER BY r.created_at DESC,r.id LIMIT 50 OFFSET $2`,
      [actor.organizationId, (page - 1) * 50],
    );
    const count = await c.query(
      'SELECT count(*)::integer AS count FROM analiza.supply_requests WHERE organization_id=$1',
      [actor.organizationId],
    );
    const quotes = await c.query(
      `WITH q AS (${latestQuotes}) SELECT q.id,q.root_quote_id AS "rootId",q.patient_id AS "patientId",q.body->>'status' AS status,
      (q.body->>'total')::numeric AS total,q.record_version AS "recordVersion" FROM q
      WHERE q.patient_id=ANY($2::text[]) AND NOT EXISTS (${terminal}) ORDER BY q.created_at DESC`,
      [actor.organizationId, [...new Set(entries.rows.map((row) => row.patientId))]],
    );
    return {
      entries: entries.rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        unitPrice: row.unitPrice === null ? null : Number(row.unitPrice),
      })),
      quotes: quotes.rows.map((row) => ({
        ...row,
        total: Number(row.total),
        recordVersion: Number(row.recordVersion),
      })),
      page,
      total: count.rows[0].count,
    };
  });
}

export async function assignSupplyRequest(pool: Pool, actor: ServerActor, raw: unknown) {
  if (!can(actor.role, 'quotes:write')) throw new MongoAccessError();
  const parsed = assignSupplySchema.safeParse(raw);
  if (!parsed.success)
    throw new MongoInputError('Seleccione una cotización y confirme el precio del catálogo.');
  const input = parsed.data;
  return transaction(pool, actor, async (c) => {
    const root = await lockQuoteRoot(c, actor, input.quoteId);
    if (!root) throw new MongoInputError('La cotización no está disponible.');
    // The request table is append-only for the runtime role. Serialize assignments
    // without requiring UPDATE privileges merely to take a tuple lock.
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `supply:${actor.organizationId}:${input.requestId}`,
    ]);
    const request = (
      await c.query('SELECT * FROM analiza.supply_requests WHERE organization_id=$1 AND id=$2', [
        actor.organizationId,
        input.requestId,
      ])
    ).rows[0];
    if (!request) throw new MongoInputError('La solicitud no está disponible.');
    const existing = (
      await c.query(
        'SELECT * FROM analiza.supply_request_assignments WHERE organization_id=$1 AND request_id=$2',
        [actor.organizationId, input.requestId],
      )
    ).rows[0];
    if (existing) {
      if (
        existing.source_quote_id !== input.quoteId ||
        Number(existing.unit_price) !== input.expectedUnitPrice
      )
        throw new MongoConflictError();
      return { quoteId: existing.quote_id, rootId: existing.root_quote_id, alreadyAssigned: true };
    }
    await requireOpenQuote(c, actor, root);
    const current = (
      await c.query(
        'SELECT body,record_version,id FROM analiza.quotes WHERE organization_id=$1 AND root_quote_id=$2 ORDER BY quote_version DESC LIMIT 1',
        [actor.organizationId, root],
      )
    ).rows[0];
    if (
      current?.id !== input.quoteId ||
      Number(current.record_version) !== input.expectedRecordVersion
    )
      throw new MongoConflictError();
    const source = quoteSchema.parse(current.body);
    if (source.patientId !== request.patient_id)
      throw new MongoInputError('La cotización debe pertenecer al paciente de la solicitud.');
    const item = (
      await c.query(
        'SELECT body FROM analiza.catalog_items WHERE organization_id=$1 AND id=$2 FOR SHARE',
        [actor.organizationId, request.catalog_item_id],
      )
    ).rows[0]?.body;
    if (
      !item ||
      item.status !== 'ACTIVE' ||
      !['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(item.category) ||
      typeof item.salePriceExcludingTax !== 'number' ||
      !Number.isFinite(item.salePriceExcludingTax)
    )
      throw new MongoInputError(
        'Configure el precio de venta del artículo en Catálogos antes de asignarlo.',
      );
    if (item.salePriceExcludingTax !== input.expectedUnitPrice)
      throw new MongoInputError(
        'El precio cambió. Actualice la bandeja y confirme el nuevo importe.',
      );
    const lineId = `supply-request-${request.id}`;
    const items = [
      ...source.items,
      {
        id: lineId,
        category: item.category,
        inventoryItemId: request.catalog_item_id,
        name: item.name,
        quantity: request.quantity,
        unitPrice: item.salePriceExcludingTax,
        discountAmount: 0,
      },
    ];
    const totals = calculateQuoteTotals(items, source.discount, source.insurerAmount);
    const now = new Date().toISOString();
    // The sent snapshot is preserved; the new version immediately replaces its logical receivable.
    const updated = quoteSchema.parse({
      ...(source.immutable
        ? createQuoteRevision(source, randomUUID(), `Solicitud de insumos ${request.id}`, now)
        : source),
      items,
      ...totals,
      ...(source.immutable ? { status: 'SENT', immutable: true, sentAt: now } : {}),
    });
    if (source.immutable) {
      await c.query(
        'INSERT INTO analiza.quotes(organization_id,id,case_id,patient_id,root_quote_id,quote_version,body) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',
        [
          actor.organizationId,
          updated.id,
          updated.caseId ?? null,
          updated.patientId,
          root,
          updated.version,
          JSON.stringify(updated),
        ],
      );
    } else {
      await c.query(
        'UPDATE analiza.quotes SET body=$3::jsonb,record_version=record_version+1,updated_at=now() WHERE organization_id=$1 AND id=$2',
        [actor.organizationId, updated.id, JSON.stringify(updated)],
      );
    }
    await c.query(
      `INSERT INTO analiza.supply_request_assignments(organization_id,request_id,idempotency_key,source_quote_id,quote_id,root_quote_id,line_id,unit_price,actor_user_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        actor.organizationId,
        request.id,
        input.idempotencyKey,
        source.id,
        updated.id,
        root,
        lineId,
        item.salePriceExcludingTax,
        actor.userId,
      ],
    );
    await audit(c, actor, 'SUPPLY_REQUEST_ASSIGNED', 'supply_request', request.id);
    await audit(
      c,
      actor,
      source.immutable ? 'QUOTE_SUPPLIES_VERSION_SENT' : 'QUOTE_SUPPLIES_ADDED',
      'quote',
      updated.id,
    );
    return { quoteId: updated.id, rootId: root, alreadyAssigned: false };
  });
}

export async function receivedOrders(
  pool: Pool,
  actor: ServerActor,
  page: number,
): Promise<ReceivedOrderInbox> {
  if (!can(actor.role, 'inventory:read')) throw new MongoAccessError();
  return transaction(pool, actor, async (c) => {
    const rows = await c.query(
      `${orderLines} SELECT * FROM lines ORDER BY "createdAt" DESC,"quoteId","lineId" LIMIT 50 OFFSET $2`,
      [actor.organizationId, (page - 1) * 50],
    );
    const count = await c.query(`${orderLines} SELECT count(*)::integer AS count FROM lines`, [
      actor.organizationId,
    ]);
    const roots = [...new Set(rows.rows.map((row) => row.rootId))];
    const deliveries = await c.query(
      `SELECT d.*,n.body->>'displayName' AS nurse_name FROM analiza.received_order_deliveries d
      JOIN analiza.nursing_resources n ON n.organization_id=d.organization_id AND n.id=d.nursing_resource_id
      WHERE d.organization_id=$1 AND d.root_quote_id=ANY($2::text[]) ORDER BY d.created_at,d.id`,
      [actor.organizationId, roots],
    );
    const nurses = await c.query(
      `SELECT r.id,r.body->>'displayName' AS name FROM analiza.nursing_resources r
      JOIN analiza.memberships m ON m.organization_id=r.organization_id AND m.user_id=r.user_id
      WHERE r.organization_id=$1 AND m.active AND m.role IN ('NURSE','NURSE_MANAGER','ADMIN','WEBMASTER') ORDER BY name,r.id`,
      [actor.organizationId],
    );
    return {
      entries: rows.rows.map((row) => {
        const events = deliveries.rows.filter(
          (item) => item.root_quote_id === row.rootId && item.line_id === row.lineId,
        );
        return {
          ...row,
          createdAt: row.createdAt.toISOString(),
          quantity: Number(row.quantity),
          delivered: events.reduce((sum, item) => sum + Number(item.quantity), 0),
          deliveries: events.map((item) => ({
            id: item.id,
            nurseName: item.nurse_name,
            quantity: Number(item.quantity),
            createdAt: item.created_at.toISOString(),
          })),
        };
      }),
      nurses: nurses.rows,
      page,
      total: count.rows[0].count,
    };
  });
}

export async function deliverReceivedOrder(pool: Pool, actor: ServerActor, raw: unknown) {
  if (!can(actor.role, 'inventory:write')) throw new MongoAccessError();
  const parsed = deliverOrderSchema.safeParse(raw);
  if (!parsed.success) throw new MongoInputError('Seleccione la enfermera y una cantidad válida.');
  const input = parsed.data;
  return transaction(pool, actor, async (c) => {
    const root = await lockQuoteRoot(c, actor, input.quoteId);
    if (!root) throw new MongoInputError('El pedido no está disponible.');
    const previous = (
      await c.query(
        'SELECT * FROM analiza.received_order_deliveries WHERE organization_id=$1 AND id=$2',
        [actor.organizationId, input.idempotencyKey],
      )
    ).rows[0];
    if (previous) {
      if (
        previous.quote_id !== input.quoteId ||
        previous.line_id !== input.lineId ||
        previous.nursing_resource_id !== input.nursingResourceId ||
        Number(previous.quantity) !== input.quantity
      )
        throw new MongoConflictError();
      return { id: previous.id, alreadyDelivered: true };
    }
    const latest = (
      await c.query(
        'SELECT id,body FROM analiza.quotes WHERE organization_id=$1 AND root_quote_id=$2 ORDER BY quote_version DESC LIMIT 1',
        [actor.organizationId, root],
      )
    ).rows[0];
    if (latest?.id !== input.quoteId) throw new MongoConflictError();
    const quote = quoteSchema.parse(latest.body);
    const line = quote.items.find(
      (item) => item.id === input.lineId && ['MEDICATIONS', 'SUPPLIES'].includes(item.category),
    );
    if (!line || quote.status !== 'SENT')
      throw new MongoInputError('El pedido debe corresponder a una cotización enviada.');
    const rejected = await c.query(
      `SELECT 1 FROM analiza.quote_decisions d JOIN analiza.quotes q ON q.organization_id=d.organization_id AND q.id=d.quote_id WHERE q.organization_id=$1 AND q.root_quote_id=$2 AND d.decision='NOT_APPROVED' LIMIT 1`,
      [actor.organizationId, root],
    );
    if (rejected.rowCount) throw new MongoInputError('La cotización fue rechazada.');
    const nurse = await c.query(
      `SELECT r.id FROM analiza.nursing_resources r JOIN analiza.memberships m ON m.organization_id=r.organization_id AND m.user_id=r.user_id
      WHERE r.organization_id=$1 AND r.id=$2 AND m.active AND m.role IN ('NURSE','NURSE_MANAGER','ADMIN','WEBMASTER') FOR SHARE OF r,m`,
      [actor.organizationId, input.nursingResourceId],
    );
    if (!nurse.rowCount)
      throw new MongoInputError('Seleccione una enfermera con cuenta activa en esta organización.');
    const delivered = Number(
      (
        await c.query(
          'SELECT COALESCE(sum(quantity),0) AS quantity FROM analiza.received_order_deliveries WHERE organization_id=$1 AND root_quote_id=$2 AND line_id=$3',
          [actor.organizationId, root, line.id],
        )
      ).rows[0].quantity,
    );
    if (input.quantity > line.quantity - delivered + 0.000001)
      throw new MongoInputError(
        'La cantidad supera el saldo pendiente de entregar. Actualice el pedido.',
      );
    await c.query(
      `INSERT INTO analiza.received_order_deliveries(organization_id,id,quote_id,root_quote_id,line_id,quantity,nursing_resource_id,actor_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        actor.organizationId,
        input.idempotencyKey,
        quote.id,
        root,
        line.id,
        input.quantity,
        input.nursingResourceId,
        actor.userId,
      ],
    );
    await audit(
      c,
      actor,
      'RECEIVED_ORDER_DELIVERED',
      'received_order_delivery',
      input.idempotencyKey,
    );
    return { id: input.idempotencyKey, alreadyDelivered: false };
  });
}
