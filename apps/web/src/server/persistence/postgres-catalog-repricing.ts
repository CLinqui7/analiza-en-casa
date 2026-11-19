import { randomUUID } from 'node:crypto';
import { quoteSchema, type Quote, type CatalogItem } from '@analiza/contracts';
import { calculateQuoteTotals, createQuoteRevision } from '@analiza/domain';
import type { PoolClient } from 'pg';
import type { ServerActor } from '../validation/patients';
import { lockQuoteRoot } from './quote-workflow';

/** Assignments and price changes take item locks first, then logical quotes in sorted order. */
export async function lockSupplyCatalogPrices(
  c: PoolClient,
  organizationId: string,
  ids: readonly string[],
) {
  if (!ids.length) return;
  // Lock a whole multi-product request in one round trip, in a deterministic order.
  await c.query(
    'SELECT pg_advisory_xact_lock(hashtextextended(key,0)) FROM unnest($1::text[]) WITH ORDINALITY AS locks(key,n) ORDER BY n',
    [[...new Set(ids)].sort().map((id) => `catalog-price:${organizationId}:${id}`)],
  );
}

type PendingLine = { root_quote_id: string; request_id: string; line_id: string };

function applyPendingPrices(
  source: Quote,
  requests: Map<string, PendingLine>,
  catalogId: string,
  price: number,
) {
  const matched: PendingLine[] = [];
  const items = source.items.map((line) => {
    const request = requests.get(line.id);
    if (!request || line.inventoryItemId !== catalogId || line.unitPrice !== 0) return line;
    matched.push(request);
    return { ...line, unitPrice: price };
  });
  const quote =
    matched.length && price > 0
      ? { ...source, items, ...calculateQuoteTotals(items, source.discount, source.insurerAmount) }
      : source;
  return { quote, matched };
}

/** Caller holds the catalog lock. The catalog, revisions and audit commit together. */
export async function reconcileSupplyCatalogPrice(
  c: PoolClient,
  actor: ServerActor,
  item: CatalogItem,
) {
  const price = item.salePriceExcludingTax;
  if (item.status !== 'ACTIVE' || price == null) return;
  const org = actor.organizationId;
  const pending = await c.query<PendingLine>(
    `SELECT a.root_quote_id,a.request_id,a.line_id FROM analiza.supply_requests r
     JOIN analiza.supply_request_assignments a ON a.organization_id=r.organization_id AND a.request_id=r.id
     WHERE r.organization_id=$1 AND r.catalog_item_id=$2 AND a.unit_price=0
       AND EXISTS (SELECT 1 FROM analiza.audit_events e WHERE e.organization_id=r.organization_id
         AND e.action='SUPPLY_REQUEST_PRICE_PENDING' AND e.resource_type='supply_request' AND e.resource_id=r.id)
       AND NOT EXISTS (SELECT 1 FROM analiza.supply_price_resolutions s
         WHERE s.organization_id=r.organization_id AND s.request_id=r.id)
     ORDER BY a.root_quote_id,a.line_id`,
    [org, item.id],
  );
  const groups = new Map<string, Map<string, PendingLine>>();
  for (const row of pending.rows) {
    const lines = groups.get(row.root_quote_id) ?? new Map<string, PendingLine>();
    lines.set(row.line_id, row);
    groups.set(row.root_quote_id, lines);
  }
  for (const [root, lines] of groups) {
    await lockQuoteRoot(c, actor, root);
    const snapshots = await c.query<{ body: unknown }>(
      `SELECT DISTINCT ON (q.body->>'status') q.body FROM analiza.quotes q
       WHERE q.organization_id=$1 AND q.root_quote_id=$2 AND NOT EXISTS (
         SELECT 1 FROM analiza.quote_decisions d JOIN analiza.quotes parent
           ON parent.organization_id=d.organization_id AND parent.id=d.quote_id
           WHERE d.organization_id=$1 AND parent.root_quote_id=$2 AND d.decision='NOT_APPROVED')
       ORDER BY q.body->>'status', q.quote_version DESC`,
      [org, root],
    );
    const versions = snapshots.rows.map((row) => quoteSchema.parse(row.body));
    const sent = versions.find((version) => version.status === 'SENT');
    const draft = versions.find(
      (version) => version.status === 'DRAFT' && (!sent || version.version > sent.version),
    );
    const issued = sent && applyPendingPrices(sent, lines, item.id, price);
    const working = draft && applyPendingPrices(draft, lines, item.id, price);
    const now = new Date().toISOString();
    const revised =
      sent && issued && issued.quote !== sent
        ? {
            ...createQuoteRevision(
              issued.quote,
              randomUUID(),
              'Actualización de precio pendiente desde el catálogo',
              now,
            ),
            immutable: true,
            status: 'SENT' as const,
            sentAt: now,
          }
        : undefined;
    // Preserve unsent work while inserting the next immutable billing version.
    if (draft && working && (working.quote !== draft || revised)) {
      const version = revised ? Math.max(draft.version, revised.version + 1) : draft.version;
      await c.query(
        'UPDATE analiza.quotes SET body=$3::jsonb,quote_version=$4,record_version=record_version+1,updated_at=now() WHERE organization_id=$1 AND id=$2',
        [org, draft.id, JSON.stringify({ ...working.quote, version }), version],
      );
    }
    if (revised) {
      await c.query(
        'INSERT INTO analiza.quotes(organization_id,id,case_id,patient_id,root_quote_id,quote_version,body) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',
        [
          org,
          revised.id,
          revised.caseId ?? null,
          revised.patientId,
          root,
          revised.version,
          JSON.stringify(revised),
        ],
      );
    }
    const resolved = new Map<string, string>();
    if (draft && working)
      for (const line of working.matched) resolved.set(line.request_id, draft.id);
    if (sent && issued)
      for (const line of issued.matched) resolved.set(line.request_id, revised?.id ?? sent.id);
    if (!resolved.size) continue;
    await c.query(
      `INSERT INTO analiza.supply_price_resolutions(organization_id,request_id,quote_id,unit_price,actor_user_id)
       SELECT $1,r.id,r.quote_id,$4,$5 FROM unnest($2::text[],$3::text[]) r(id,quote_id)`,
      [org, [...resolved.keys()], [...resolved.values()], price, actor.userId],
    );
    for (const quoteId of new Set([
      ...resolved.values(),
      ...(working?.matched.length && draft ? [draft.id] : []),
    ])) {
      await c.query(
        "INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,'QUOTE_CATALOG_PRICE_CONFIRMED','quote',$4)",
        [org, randomUUID(), actor.userId, quoteId],
      );
    }
  }
}
