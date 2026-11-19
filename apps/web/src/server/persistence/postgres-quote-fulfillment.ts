import { randomUUID, createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { quoteSchema, type Quote } from '@analiza/contracts';
import { calculateQuoteTotals, createQuoteRevision } from '@analiza/domain';
import { can } from '@/lib/permissions';
import {
  assignSupplySchema,
  deliverOrderSchema,
  type PrequoteInbox,
  type PrequoteEntry,
  type PrequoteProduct,
  type ReceivedOrderInbox,
} from '@/lib/quote-fulfillment';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  type ServerActor,
} from '../validation/patients';
import { transaction } from './postgres-pool';
import { requestQuoteCategories, productKey, type RequestProduct } from '@/lib/supply-requests';
import { lockSupplyCatalogPrices } from './postgres-catalog-repricing';
import { insertRequestProducts, productProjection } from './postgres-supply-requests';
import { lockQuoteRoot } from './quote-workflow';

async function audit(c: PoolClient, actor: ServerActor, action: string, kind: string, id: string) {
  await c.query(
    'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
    [actor.organizationId, randomUUID(), actor.userId, action, kind, id],
  );
}
const latestQuotes = (
  patientScoped = false,
) => `SELECT DISTINCT ON (root_quote_id) id,root_quote_id,patient_id,body,record_version,quote_version,created_at
  FROM analiza.quotes WHERE organization_id=$1 ${patientScoped ? 'AND patient_id=ANY($2::text[])' : ''} ORDER BY root_quote_id,quote_version DESC`;
const terminal = `SELECT 1 FROM analiza.quote_decisions d JOIN analiza.quotes qd ON qd.organization_id=d.organization_id AND qd.id=d.quote_id
  WHERE qd.organization_id=$1 AND qd.root_quote_id=q.root_quote_id`;
const orderLines = `WITH q AS (${latestQuotes()}), lines AS (
  SELECT q.id AS "quoteId",q.root_quote_id AS "rootId",q.created_at AS "createdAt",p.body->>'fullName' AS "patientName",coalesce(p.body->>'documentId','') AS "patientDocument",line->>'id' AS "lineId",
  line->>'name' AS "itemName",(line->>'quantity')::numeric AS quantity,q.body->>'status' AS status
  FROM q JOIN analiza.patients p ON p.organization_id=$1 AND p.id=q.patient_id CROSS JOIN LATERAL jsonb_array_elements(q.body->'items') line
  WHERE line->>'category' IN ('MEDICATIONS','SUPPLIES','EQUIPMENT') AND NOT EXISTS (${terminal} AND d.decision='NOT_APPROVED')
)`;

export async function prequoteInbox(
  pool: Pool,
  actor: ServerActor,
  page: number,
  requestId?: string,
): Promise<PrequoteInbox> {
  if (!can(actor.role, 'quotes:write')) throw new MongoAccessError();
  return transaction(pool, actor, async (c) => {
    const entries = await c.query(
      `WITH heads AS (
        SELECT id,created_at FROM analiza.supply_requests WHERE organization_id=$1 AND group_id IS NULL AND ($3::text IS NULL OR id=$3)
        ORDER BY created_at DESC,id LIMIT 50 OFFSET $2
      ) SELECT r.id,h.id AS "groupId",r.created_at AS "createdAt",r.patient_id AS "patientId",p.body->>'fullName' AS "patientName",
      coalesce(i.body->>'name',r.fee_service) AS "itemName",coalesce(i.body->>'category','FEES') AS "itemCategory",
      r.catalog_item_id AS "catalogItemId",r.quantity,r.note,r.priority,r.requested_by AS "requestedBy",
      CASE WHEN r.fee_service IS NOT NULL THEN r.fee_amount WHEN i.body->>'status'='ACTIVE' THEN (i.body->>'salePriceExcludingTax')::numeric END AS "unitPrice",
      coalesce((applied.line->>'unitPrice')::numeric,resolved.unit_price,a.unit_price) AS "assignedUnitPrice",
      CASE WHEN a.request_id IS NULL THEN r.catalog_item_id IS NOT NULL AND i.body->>'salePriceExcludingTax' IS NULL
        ELSE a.unit_price=0 AND resolved.request_id IS NULL AND EXISTS (
          SELECT 1 FROM analiza.audit_events e WHERE e.organization_id=r.organization_id AND e.action='SUPPLY_REQUEST_PRICE_PENDING'
          AND e.resource_type='supply_request' AND e.resource_id=r.id) END AS "pricePending",
      (r.fee_service IS NOT NULL OR (i.body->>'status'='ACTIVE' AND i.body->>'category'=ANY($4::text[]))) AS "itemAvailable",
      a.quote_id AS "assignedQuoteId",a.root_quote_id AS "rootQuoteId",latest.id AS "currentQuoteId",applied.line IS NOT NULL AS "assignmentPresent"
      FROM heads h JOIN analiza.supply_requests r ON r.organization_id=$1 AND (r.id=h.id OR r.group_id=h.id)
      JOIN analiza.patients p ON p.organization_id=r.organization_id AND p.id=r.patient_id
      LEFT JOIN analiza.catalog_items i ON i.organization_id=r.organization_id AND i.id=r.catalog_item_id
      LEFT JOIN analiza.supply_request_assignments a ON a.organization_id=r.organization_id AND a.request_id=r.id
      LEFT JOIN analiza.supply_price_resolutions resolved ON resolved.organization_id=a.organization_id AND resolved.request_id=a.request_id
      LEFT JOIN LATERAL (SELECT q.id,q.body FROM analiza.quotes q WHERE q.organization_id=r.organization_id AND q.root_quote_id=a.root_quote_id ORDER BY q.quote_version DESC LIMIT 1) latest ON true
      LEFT JOIN LATERAL (SELECT line FROM jsonb_array_elements(latest.body->'items') line WHERE line->>'id'=a.line_id LIMIT 1) applied ON true
      ORDER BY h.created_at DESC,h.id,r.product_position`,
      [
        actor.organizationId,
        requestId ? 0 : (page - 1) * 50,
        requestId ?? null,
        Object.keys(requestQuoteCategories),
      ],
    );
    const count = await c.query(
      'SELECT count(*)::integer AS count FROM analiza.supply_requests WHERE organization_id=$1 AND group_id IS NULL AND ($2::text IS NULL OR id=$2)',
      [actor.organizationId, requestId ?? null],
    );
    const quotes = await c.query(
      `WITH q AS (${latestQuotes(true)}) SELECT q.id,q.root_quote_id AS "rootId",q.patient_id AS "patientId",
      CASE WHEN approval.id IS NOT NULL THEN 'APPROVED' ELSE q.body->>'status' END AS status,
      approval.id AS "approvalDecisionId",(q.body->>'total')::numeric AS total,q.record_version AS "recordVersion" FROM q
      LEFT JOIN LATERAL (SELECT d.id FROM analiza.quote_decisions d JOIN analiza.quotes qd ON qd.organization_id=d.organization_id AND qd.id=d.quote_id
        WHERE qd.organization_id=$1 AND qd.root_quote_id=q.root_quote_id AND d.decision='APPROVED' ORDER BY d.created_at DESC,d.id DESC LIMIT 1) approval ON true
      WHERE NOT EXISTS (${terminal} AND d.decision='NOT_APPROVED') ORDER BY q.created_at DESC`,
      [actor.organizationId, [...new Set(entries.rows.map((row) => row.patientId))]],
    );
    const groups = new Map<string, PrequoteEntry>();
    for (const row of entries.rows) {
      const product: PrequoteProduct = {
        id: row.id,
        catalogItemId: row.catalogItemId,
        itemName: row.itemName,
        itemCategory: row.itemCategory,
        quantity: row.quantity,
        unitPrice: row.unitPrice === null ? null : Number(row.unitPrice),
        assignedUnitPrice: row.assignedUnitPrice === null ? null : Number(row.assignedUnitPrice),
        itemAvailable: row.itemAvailable,
        pricePending: row.pricePending,
        assignmentPresent: row.assignmentPresent,
      };
      const group = groups.get(row.groupId);
      if (group) {
        group.products!.push(product);
        group.itemAvailable &&= product.itemAvailable;
        group.assignmentPresent &&= product.assignmentPresent;
      } else {
        groups.set(row.groupId, {
          ...row,
          ...product,
          products: [product],
          createdAt: row.createdAt.toISOString(),
        });
      }
    }
    return {
      entries: [...groups.values()],
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
  const revisionReason = input.approvedExtension
    ? `Ampliación aprobada · aprobación ${input.approvedExtension.decisionId} · solicitud ${input.requestId}: ${input.approvedExtension.reason}`
    : `Solicitud de insumos ${input.requestId}`;
  return transaction(pool, actor, async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `supply:${actor.organizationId}:${input.requestId}`,
    ]);
    const members = (
      await c.query<{
        id: string;
        patient_id: string;
        priority: string;
        note: string;
        group_id: string | null;
        product: RequestProduct;
      }>(
        `SELECT s.id,s.patient_id,s.priority,s.note,s.group_id,${productProjection} AS product FROM analiza.supply_requests s
       WHERE organization_id=$1 AND (id=$2 OR group_id=$2) ORDER BY product_position`,
        [actor.organizationId, input.requestId],
      )
    ).rows;
    const request = members[0];
    if (!request || request.group_id !== null)
      throw new MongoInputError('La solicitud no está disponible.');
    const additions = input.additions ?? [];
    const allProducts = [
      ...members.map((row) => row.product),
      ...additions.map((line) => line.product),
    ];
    const catalogIds = allProducts.flatMap((line) =>
      'catalogItemId' in line ? [line.catalogItemId] : [],
    );
    await lockSupplyCatalogPrices(c, actor.organizationId, catalogIds);
    const root = await lockQuoteRoot(c, actor, input.quoteId);
    if (!root) throw new MongoInputError('La cotización no está disponible.');
    const commandHash = createHash('sha256')
      .update(JSON.stringify({ ...input, idempotencyKey: undefined }))
      .digest('hex');
    const existing = (
      await c.query(
        'SELECT * FROM analiza.supply_request_assignments WHERE organization_id=$1 AND request_id=$2',
        [actor.organizationId, input.requestId],
      )
    ).rows[0];
    if (existing) {
      if (
        (existing.command_hash && existing.command_hash !== commandHash) ||
        (!existing.command_hash &&
          (additions.length || (input.expectedProducts?.length ?? 0) > 1)) ||
        existing.source_quote_id !== input.quoteId ||
        Number(existing.unit_price) !== input.expectedUnitPrice
      )
        throw new MongoConflictError();
      const saved = await c.query(
        'SELECT body FROM analiza.quotes WHERE organization_id=$1 AND id=$2',
        [actor.organizationId, existing.quote_id],
      );
      const savedReason = saved.rows[0]?.body.revisionReason as string | undefined;
      if (
        (input.approvedExtension || savedReason?.startsWith('Ampliación aprobada ·')) &&
        savedReason !== revisionReason
      )
        throw new MongoConflictError();
      return { quoteId: existing.quote_id, rootId: existing.root_quote_id, alreadyAssigned: true };
    }
    // This exception only appends a recorded nursing request. General editing stays closed.
    const decisions = await c.query<{ id: string; decision: string }>(
      `SELECT d.id,d.decision FROM analiza.quote_decisions d JOIN analiza.quotes q ON q.organization_id=d.organization_id AND q.id=d.quote_id
       WHERE q.organization_id=$1 AND q.root_quote_id=$2 ORDER BY d.created_at DESC,d.id DESC`,
      [actor.organizationId, root],
    );
    if (decisions.rows.some((decision) => decision.decision === 'NOT_APPROVED'))
      throw new MongoInputError('No se pueden ampliar cotizaciones rechazadas.');
    const approval = decisions.rows.find((decision) => decision.decision === 'APPROVED');
    if (
      approval &&
      (!input.approvedExtension || input.approvedExtension.decisionId !== approval.id)
    )
      throw new MongoInputError(
        'La cotización está aprobada. Actualice la bandeja y confirme el motivo de la ampliación.',
      );
    if (!approval && input.approvedExtension) throw new MongoConflictError();
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
    if (approval && (!source.immutable || source.status !== 'SENT'))
      throw new MongoInputError('Revise el estado de la cotización aprobada antes de ampliarla.');
    if (source.patientId !== request.patient_id)
      throw new MongoInputError('La cotización debe pertenecer al paciente de la solicitud.');
    if (allProducts.length > 50 || new Set(allProducts.map(productKey)).size !== allProducts.length)
      throw new MongoInputError(
        'Use una sola línea por concepto y hasta 50 conceptos por solicitud.',
      );
    if (input.priceSource === 'MANUAL')
      throw new MongoInputError('Registre el precio de venta en la tabla de insumos.');
    const expected = new Map(input.expectedProducts?.map((row) => [row.id, row.unitPrice]));
    if (
      (members.length > 1 || input.expectedProducts) &&
      (expected.size !== members.length ||
        input.expectedProducts?.length !== members.length ||
        members.some((member) => !expected.has(member.id)))
    )
      throw new MongoInputError(
        'Vuelva a revisar los precios de todos los productos de la solicitud.',
      );
    const catalogue = (
      await c.query<{
        id: string;
        body: {
          name: string;
          status: string;
          category: keyof typeof requestQuoteCategories;
          salePriceExcludingTax?: number;
        };
      }>(
        'SELECT id,body FROM analiza.catalog_items WHERE organization_id=$1 AND id=ANY($2::text[]) ORDER BY id FOR SHARE',
        [actor.organizationId, catalogIds],
      )
    ).rows;
    const catalogById = new Map(catalogue.map((row) => [row.id, row.body]));
    const hasFee = allProducts.some((product) => 'feeService' in product);
    const doctor =
      hasFee && source.primaryDoctorId
        ? (
            await c.query<{ id: string; name: string }>(
              "SELECT id,body->>'fullName' AS name FROM analiza.doctors WHERE organization_id=$1 AND id=$2 FOR SHARE",
              [actor.organizationId, source.primaryDoctorId],
            )
          ).rows[0]
        : undefined;
    if (hasFee && !doctor)
      throw new MongoInputError(
        'La cotización debe tener un médico tratante principal registrado para añadir honorarios.',
      );
    const added = additions.length
      ? (
          await insertRequestProducts(
            c,
            actor,
            {
              patientId: request.patient_id,
              priority: request.priority,
              note: request.note,
              idempotencyKey: input.idempotencyKey,
            },
            additions.map((line) => line.product),
            { groupId: request.id, offset: members.length },
          )
        ).lines
      : [];
    const planned = [
      ...members.map((row) => ({
        id: row.id,
        product: row.product,
        expected: expected.has(row.id)
          ? expected.get(row.id)!
          : input.priceSource === 'PENDING'
            ? null
            : input.expectedUnitPrice,
      })),
      ...added.map((product, index) => ({
        id: product.id,
        product,
        expected: additions[index].expectedPrice,
      })),
    ];
    const appended = planned.map(({ id, product, expected }) => {
      const item = 'catalogItemId' in product ? catalogById.get(product.catalogItemId) : undefined;
      if (
        'catalogItemId' in product &&
        (!item || item.status !== 'ACTIVE' || !Object.hasOwn(requestQuoteCategories, item.category))
      )
        throw new MongoInputError(
          'El artículo no está disponible para añadirlo. Revise su estado en Catálogos.',
        );
      const price =
        'feeAmount' in product ? product.feeAmount : (item!.salePriceExcludingTax ?? null);
      if (
        price !== expected ||
        (id === request.id &&
          ((price ?? 0) !== input.expectedUnitPrice ||
            (input.priceSource === 'PENDING') !== (price === null)))
      )
        throw new MongoInputError(
          'El precio cambió. Cierre y vuelva a revisar la solicitud para usar el importe vigente.',
        );
      const line: Quote['items'][number] = {
        id: `supply-request-${id}`,
        quantity: product.quantity,
        unitPrice: price ?? 0,
        discountAmount: 0,
        ...('feeService' in product
          ? {
              category: 'FEES' as const,
              name: product.feeService,
              doctorId: doctor!.id,
              doctorName: doctor!.name,
            }
          : {
              category: requestQuoteCategories[item!.category],
              inventoryItemId: product.catalogItemId,
              name: item!.name,
            }),
      };
      return { requestId: id, line, pending: price === null };
    });
    const items = [...source.items, ...appended.map((row) => row.line)];
    const totals = calculateQuoteTotals(items, source.discount, source.insurerAmount);
    const now = new Date().toISOString();
    let caseId = source.caseId;
    if (approval && !caseId) {
      // Approval links the original immutable snapshot to the admission. Associate the
      // new snapshot with that same admission so all existing clinical readers see it.
      const admissions = await c.query<{ id: string }>(
        `SELECT h.id FROM analiza.hospitalizations h WHERE h.organization_id=$1 AND h.patient_id=$2 AND EXISTS (
          SELECT 1 FROM analiza.quotes q WHERE q.organization_id=h.organization_id AND q.root_quote_id=$3
          AND (q.case_id=h.id OR h.body->'linkedQuoteIds' @> jsonb_build_array(q.id)))`,
        [actor.organizationId, source.patientId, root],
      );
      if (admissions.rows.length > 1)
        throw new MongoInputError(
          'La cotización está vinculada a varios ingresos. Revise sus vínculos antes de ampliarla.',
        );
      caseId = admissions.rows[0]?.id;
    }
    // The sent snapshot is preserved; the new version immediately replaces its logical receivable.
    const updated = quoteSchema.parse({
      ...(source.immutable
        ? createQuoteRevision(source, randomUUID(), revisionReason, now)
        : source),
      ...(caseId ? { caseId } : {}),
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
    const assignments = appended.map((row) => ({
      id: row.requestId,
      key: row.requestId === request.id ? input.idempotencyKey : randomUUID(),
      line: row.line.id,
      price: row.line.unitPrice,
    }));
    await c.query(
      `INSERT INTO analiza.supply_request_assignments(organization_id,request_id,idempotency_key,source_quote_id,quote_id,root_quote_id,line_id,unit_price,actor_user_id,command_hash)
      SELECT $1,r.id,r.key,$3,$4,$5,r.line,r.price,$6,$7 FROM jsonb_to_recordset($2::jsonb) AS r(id text,key uuid,line text,price numeric)`,
      [
        actor.organizationId,
        JSON.stringify(assignments),
        source.id,
        updated.id,
        root,
        actor.userId,
        commandHash,
      ],
    );
    const events = appended.flatMap((row) =>
      (row.pending
        ? ['SUPPLY_REQUEST_ASSIGNED', 'SUPPLY_REQUEST_PRICE_PENDING']
        : ['SUPPLY_REQUEST_ASSIGNED']
      ).map((action) => ({ id: randomUUID(), resource: row.requestId, action })),
    );
    await c.query(
      `INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id)
       SELECT $1,e.id,$2,e.action,'supply_request',e.resource FROM jsonb_to_recordset($3::jsonb) AS e(id text,resource text,action text)`,
      [actor.organizationId, actor.userId, JSON.stringify(events)],
    );
    await audit(
      c,
      actor,
      approval
        ? 'QUOTE_APPROVED_SUPPLIES_EXTENDED'
        : source.immutable
          ? 'QUOTE_SUPPLIES_VERSION_SENT'
          : 'QUOTE_SUPPLIES_ADDED',
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
  search = '',
): Promise<ReceivedOrderInbox> {
  if (!can(actor.role, 'inventory:read')) throw new MongoAccessError();
  return transaction(pool, actor, async (c) => {
    const normalizedSearch = search
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const filter = `WHERE $2='' OR strpos(translate(lower("patientName"),'áéíóúüñ','aeiouun'),$2)>0
      OR strpos(lower("patientDocument"),$2)>0
      OR ($3<>'' AND strpos(regexp_replace("patientDocument",'[^0-9]','','g'),$3)>0)`;
    const digits = /^[\d\s.-]+$/.test(normalizedSearch) ? normalizedSearch.replace(/\D/g, '') : '';
    const params = [actor.organizationId, normalizedSearch, digits];
    const rows = await c.query(
      `${orderLines} SELECT * FROM lines ${filter} ORDER BY "createdAt" DESC,"quoteId","lineId" LIMIT 50 OFFSET $4`,
      [...params, (page - 1) * 50],
    );
    const count = await c.query(
      `${orderLines} SELECT count(*)::integer AS count FROM lines ${filter}`,
      params,
    );
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
      (item) =>
        item.id === input.lineId &&
        ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(item.category),
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
