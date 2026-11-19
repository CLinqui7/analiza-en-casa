import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { can } from '@/lib/permissions';
import {
  supplyRequestInputSchema,
  supplyRequestSchema,
  type SupplyRequest,
  type SupplyRequestCatalogItem,
  type RequestProduct,
  productKey,
  requestQuoteCategories,
} from '@/lib/supply-requests';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  type ServerActor,
} from '@/server/validation/patients';
import { transaction } from './postgres-pool';

type Row = {
  id: string;
  requested_by: string;
  patient_id: string;
  catalog_item_id: string | null;
  fee_service: 'Visita' | 'Seguimiento' | null;
  fee_amount: string | null;
  quantity: number;
  priority: SupplyRequest['priority'];
  note: string;
  status: 'RECEIVED';
  created_at: Date;
  idempotency_key: string;
  assigned_quote_id?: string | null;
  assignment_present?: boolean;
  products?: SupplyRequest['products'];
};

export const productProjection = `jsonb_strip_nulls(jsonb_build_object('id',s.id,'catalogItemId',s.catalog_item_id,'feeService',s.fee_service,'feeAmount',s.fee_amount,'quantity',s.quantity))`;

export async function insertRequestProducts(
  client: PoolClient,
  actor: ServerActor,
  header: { patientId: string; priority: string; note: string; idempotencyKey: string },
  products: RequestProduct[],
  review?: { groupId: string; offset: number },
) {
  const lines = products.map((product) => ({ ...product, id: randomUUID() }));
  const head = review?.groupId ?? lines[0].id;
  const inserted = await client.query<Row>(
    `INSERT INTO analiza.supply_requests
      (organization_id,id,idempotency_key,requested_by,patient_id,catalog_item_id,quantity,priority,note,group_id,product_position,fee_service,fee_amount,added_in_review)
     SELECT $1,line.id,CASE WHEN position=0 THEN $2 ELSE $2 || ':' || position::text END,
       $3,$4,line."catalogItemId",line.quantity,$5,$6,CASE WHEN position>0 THEN $7::text END,position,line."feeService",line."feeAmount",$9
     FROM jsonb_to_recordset($8::jsonb) AS line(id text,"catalogItemId" text,quantity integer,position integer,"feeService" text,"feeAmount" numeric)
     RETURNING *`,
    [
      actor.organizationId,
      header.idempotencyKey,
      actor.userId,
      header.patientId,
      header.priority,
      header.note,
      head,
      JSON.stringify(
        lines.map((line, index) => ({ ...line, position: (review?.offset ?? 0) + index })),
      ),
      Boolean(review),
    ],
  );
  return { head: inserted.rows.find((row) => row.id === head), lines };
}

function publicRequest(row: Row): SupplyRequest {
  return supplyRequestSchema.parse({
    id: row.id,
    products: row.products,
    requestedBy: row.requested_by,
    patientId: row.patient_id,
    catalogItemId: row.catalog_item_id,
    quantity: row.quantity,
    priority: row.priority,
    note: row.note,
    status: row.assigned_quote_id ? (row.assignment_present ? 'ASSIGNED' : 'REMOVED') : row.status,
    assignedQuoteId: row.assigned_quote_id ?? undefined,
    createdAt: row.created_at.toISOString(),
  });
}

export class PostgresSupplyRequestRepository {
  constructor(private readonly pool: Pool) {}

  async catalog(actor: ServerActor): Promise<SupplyRequestCatalogItem[]> {
    if (!can(actor.role, 'supply-requests:read')) throw new MongoAccessError();
    return transaction(this.pool, actor, async (client) => {
      const rows = await client.query<SupplyRequestCatalogItem>(
        `SELECT id,body->>'sku' AS sku,body->>'name' AS name,body->>'category' AS category
         FROM analiza.catalog_items WHERE organization_id=$1 AND body->>'status'='ACTIVE'
         AND body->>'category'=ANY($2::text[]) ORDER BY category,name,id`,
        [actor.organizationId, Object.keys(requestQuoteCategories)],
      );
      return rows.rows;
    });
  }

  async list(actor: ServerActor): Promise<SupplyRequest[]> {
    if (!can(actor.role, 'supply-requests:read')) throw new MongoAccessError();
    return transaction(this.pool, actor, async (client) => {
      const rows = await client.query<Row>(
        `SELECT r.*,a.quote_id AS assigned_quote_id,
         coalesce((SELECT jsonb_agg(${productProjection} ORDER BY s.product_position)
           FROM analiza.supply_requests s WHERE s.organization_id=r.organization_id AND (s.id=r.id OR s.group_id=r.id)), '[]'::jsonb) AS products,
         NOT EXISTS (
           SELECT 1 FROM analiza.supply_requests child JOIN analiza.supply_request_assignments assigned
             ON assigned.organization_id=child.organization_id AND assigned.request_id=child.id
           WHERE child.organization_id=r.organization_id AND (child.id=r.id OR child.group_id=r.id)
           AND NOT (latest.body->'items' @> jsonb_build_array(jsonb_build_object('id',assigned.line_id)))
         ) AS assignment_present
         FROM analiza.supply_requests r LEFT JOIN analiza.supply_request_assignments a ON a.organization_id=r.organization_id AND a.request_id=r.id
         LEFT JOIN LATERAL (SELECT q.body FROM analiza.quotes q WHERE q.organization_id=r.organization_id AND q.root_quote_id=a.root_quote_id ORDER BY q.quote_version DESC LIMIT 1) latest ON true
         WHERE r.organization_id=$1 AND r.group_id IS NULL AND ($2::boolean OR r.requested_by=$3)
         ORDER BY r.created_at DESC,r.id LIMIT 500`,
        [actor.organizationId, actor.role !== 'NURSE', actor.userId],
      );
      return rows.rows.map(publicRequest);
    });
  }

  async create(actor: ServerActor, input: unknown): Promise<SupplyRequest> {
    if (!can(actor.role, 'supply-requests:write')) throw new MongoAccessError();
    const checked = supplyRequestInputSchema.safeParse(input);
    if (!checked.success) throw new MongoInputError('Revise paciente, ítem, cantidad y prioridad.');
    const request = checked.data;
    return transaction(this.pool, actor, async (client) => {
      const organization = actor.organizationId;
      // Serialize the command before validation so retries also work after a catalogue change.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `supply-create:${organization}:${request.idempotencyKey}`,
      ]);
      const existing = (
        await client.query<Row>(
          'SELECT * FROM analiza.supply_requests WHERE organization_id=$1 AND idempotency_key=$2 AND group_id IS NULL',
          [organization, request.idempotencyKey],
        )
      ).rows[0];
      if (existing) {
        const members = (
          await client.query<{ product: RequestProduct & { id: string } }>(
            `SELECT ${productProjection} AS product FROM analiza.supply_requests s WHERE organization_id=$1 AND (id=$2 OR group_id=$2) AND NOT added_in_review ORDER BY product_position`,
            [organization, existing.id],
          )
        ).rows.map((row) => row.product);
        if (
          existing.requested_by !== actor.userId ||
          existing.patient_id !== request.patientId ||
          existing.priority !== request.priority ||
          existing.note !== request.note ||
          members.length !== request.products.length ||
          members.some(
            (line, index) =>
              productKey(line) !== productKey(request.products[index]) ||
              line.quantity !== request.products[index].quantity ||
              ('feeAmount' in line &&
                line.feeAmount !== (request.products[index] as { feeAmount?: number }).feeAmount),
          )
        )
          throw new MongoConflictError();
        return publicRequest({ ...existing, products: members });
      }
      const patient = await client.query(
        "SELECT 1 FROM analiza.patients WHERE organization_id=$1 AND id=$2 AND body->>'status'='ACTIVE'",
        [organization, request.patientId],
      );
      if (!patient.rowCount)
        throw new MongoInputError('Seleccione un paciente activo de esta organización.');
      const ids = request.products.flatMap((product) =>
        'catalogItemId' in product ? [product.catalogItemId] : [],
      );
      const active = await client.query(
        `SELECT id FROM analiza.catalog_items WHERE organization_id=$1 AND id=ANY($2::text[])
         AND body->>'status'='ACTIVE' AND body->>'category'=ANY($3::text[])`,
        [organization, ids, Object.keys(requestQuoteCategories)],
      );
      if (active.rowCount !== ids.length)
        throw new MongoInputError('Seleccione conceptos activos del catálogo.');
      const { head, lines } = await insertRequestProducts(client, actor, request, request.products);
      if (!head) throw new Error('Solicitud incompleta.');
      await client.query(
        `INSERT INTO analiza.audit_events (organization_id,id,actor_user_id,action,resource_type,resource_id)
         VALUES ($1,$2,$3,'supply_request.created','supply_requests',$4)`,
        [organization, randomUUID(), actor.userId, head.id],
      );
      return publicRequest({ ...head, products: lines });
    });
  }
}
