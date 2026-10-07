import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { can } from '@/lib/permissions';
import {
  supplyRequestInputSchema,
  supplyRequestSchema,
  type SupplyRequest,
  type SupplyRequestCatalogItem,
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
  catalog_item_id: string;
  quantity: number;
  priority: SupplyRequest['priority'];
  note: string;
  status: 'RECEIVED';
  created_at: Date;
  idempotency_key: string;
};

function publicRequest(row: Row): SupplyRequest {
  return supplyRequestSchema.parse({
    id: row.id,
    requestedBy: row.requested_by,
    patientId: row.patient_id,
    catalogItemId: row.catalog_item_id,
    quantity: row.quantity,
    priority: row.priority,
    note: row.note,
    status: row.status,
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
         AND body->>'category' IN ('MEDICATIONS','SUPPLIES','EQUIPMENT') ORDER BY category,name,id`,
        [actor.organizationId],
      );
      return rows.rows;
    });
  }

  async list(actor: ServerActor): Promise<SupplyRequest[]> {
    if (!can(actor.role, 'supply-requests:read')) throw new MongoAccessError();
    return transaction(this.pool, actor, async (client) => {
      const rows = await client.query<Row>(
        `SELECT id,idempotency_key,requested_by,patient_id,catalog_item_id,quantity,priority,note,status,created_at
         FROM analiza.supply_requests
         WHERE organization_id=$1 AND ($2::boolean OR requested_by=$3)
         ORDER BY created_at DESC,id LIMIT 500`,
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
      const patient = await client.query(
        "SELECT 1 FROM analiza.patients WHERE organization_id=$1 AND id=$2 AND body->>'status'='ACTIVE'",
        [actor.organizationId, request.patientId],
      );
      if (!patient.rowCount)
        throw new MongoInputError('Seleccione un paciente activo de esta organización.');
      const item = await client.query(
        `SELECT 1 FROM analiza.catalog_items
         WHERE organization_id=$1 AND id=$2 AND body->>'status'='ACTIVE'
         AND body->>'category' IN ('MEDICATIONS','SUPPLIES','EQUIPMENT')`,
        [actor.organizationId, request.catalogItemId],
      );
      if (!item.rowCount)
        throw new MongoInputError(
          'Seleccione un medicamento, insumo o equipo activo del catálogo.',
        );
      const inserted = await client.query<Row>(
        `INSERT INTO analiza.supply_requests
          (organization_id,id,idempotency_key,requested_by,patient_id,catalog_item_id,quantity,priority,note)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT(organization_id,idempotency_key) DO NOTHING
         RETURNING id,idempotency_key,requested_by,patient_id,catalog_item_id,quantity,priority,note,status,created_at`,
        [
          actor.organizationId,
          randomUUID(),
          request.idempotencyKey,
          actor.userId,
          request.patientId,
          request.catalogItemId,
          request.quantity,
          request.priority,
          request.note,
        ],
      );
      if (inserted.rowCount) {
        const row = inserted.rows[0];
        await client.query(
          `INSERT INTO analiza.audit_events
            (organization_id,id,actor_user_id,action,resource_type,resource_id)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [
            actor.organizationId,
            randomUUID(),
            actor.userId,
            'supply_request.created',
            'supply_requests',
            row.id,
          ],
        );
        return publicRequest(row);
      }
      const existing = await client.query<Row>(
        `SELECT id,idempotency_key,requested_by,patient_id,catalog_item_id,quantity,priority,note,status,created_at
         FROM analiza.supply_requests WHERE organization_id=$1 AND idempotency_key=$2`,
        [actor.organizationId, request.idempotencyKey],
      );
      const row = existing.rows[0];
      if (
        !row ||
        row.requested_by !== actor.userId ||
        row.patient_id !== request.patientId ||
        row.catalog_item_id !== request.catalogItemId ||
        row.quantity !== request.quantity ||
        row.priority !== request.priority ||
        row.note !== request.note
      )
        throw new MongoConflictError();
      return publicRequest(row);
    });
  }
}
