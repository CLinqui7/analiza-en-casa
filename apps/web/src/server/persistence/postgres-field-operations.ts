import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  commercialAdmissionInputSchema,
  commercialAdmissionSchema,
  commercialGoalInputSchema,
  commercialGoalSchema,
  commercialVisitInputSchema,
  commercialVisitSchema,
  confirmedSaleInputSchema,
  confirmedSaleSchema,
  homeCustodyCloseSchema,
  homeCustodyInputSchema,
  homeCustodySchema,
  inventoryMovementSchema,
  type OperationsSnapshot,
} from '@analiza/contracts';
import { can } from '@/lib/permissions';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  type ServerActor,
} from '../validation/patients';
import { transaction } from './postgres-pool';

const fieldCommands = new Set([
  'home.dispatch',
  'home.close',
  'commercial.visit.record',
  'commercial.admission.link',
  'commercial.goal.save',
  'sale.confirmed.record',
]);
export const isFieldCommand = (value: unknown): value is string =>
  typeof value === 'string' && fieldCommands.has(value);

function requirePermission(actor: ServerActor, permission: Parameters<typeof can>[1]) {
  if (!can(actor.role, permission)) throw new MongoAccessError();
}
async function audit(
  client: PoolClient,
  actor: ServerActor,
  action: string,
  kind: string,
  id: string,
) {
  await client.query(
    `INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [actor.organizationId, randomUUID(), actor.userId, action, kind, id],
  );
}
export async function commercialScope(client: PoolClient, actor: ServerActor) {
  const row = (
    await client.query<{ scope: 'REP' | 'MANAGER' }>(
      `SELECT CASE
          WHEN users.email_normalized IN ('claudia.pinzon@labanaliza.com','claudia.pinzon@analizaencasa.com') THEN 'REP'
          WHEN users.email_normalized IN ('sissy.chavez@labanaliza.com','sissy.chavez@analizaencasa.com') THEN 'MANAGER'
        END AS scope
       FROM analiza.memberships membership
       JOIN analiza.users users ON users.id=membership.user_id
       WHERE membership.organization_id=$1 AND membership.user_id=$2 AND membership.active
         AND users.disabled_at IS NULL`,
      [actor.organizationId, actor.userId],
    )
  ).rows[0];
  return row?.scope ?? null;
}
function requireScope(scope: 'REP' | 'MANAGER' | null, allowed: readonly ('REP' | 'MANAGER')[]) {
  if (!scope || !allowed.includes(scope)) throw new MongoAccessError();
}
function sameInput(previous: unknown, input: unknown, schema: z.ZodTypeAny) {
  const expected = schema.parse(input) as Record<string, unknown>;
  const stored = previous as Record<string, unknown>;
  if (
    Object.entries(expected).some(
      ([key, value]) => JSON.stringify(stored[key]) !== JSON.stringify(value),
    )
  )
    throw new MongoConflictError();
}
const salvadorDay = (instant: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
async function movementOut(
  client: PoolClient,
  actor: ServerActor,
  dispatch: z.infer<typeof homeCustodyInputSchema>,
  quantity: number,
  suffix: string,
  trace?: { id: string; number: string },
) {
  const movement = inventoryMovementSchema.parse({
    id: `${dispatch.id}:out:${suffix}`,
    itemId: dispatch.itemId,
    warehouseId: dispatch.warehouseId,
    kind: 'EXIT',
    quantity,
    createdAt: dispatch.sentAt,
    reason: 'Despacho a custodia domiciliaria',
    reference: dispatch.reference,
    user: actor.userId,
    ...(trace ? { traceRecordId: trace.id, traceNumber: trace.number } : {}),
  });
  await client.query(
    `INSERT INTO analiza.inventory_movements(
       organization_id,id,item_id,warehouse_id,idempotency_key,delta,body,created_at,trace_record_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
    [
      actor.organizationId,
      movement.id,
      movement.itemId,
      movement.warehouseId,
      `${dispatch.idempotencyKey}:out:${suffix}`,
      -quantity,
      JSON.stringify(movement),
      movement.createdAt,
      trace?.id ?? null,
    ],
  );
}

export async function populateFieldOperations(
  client: PoolClient,
  actor: ServerActor,
  result: OperationsSnapshot,
) {
  if (can(actor.role, 'inventory:read')) {
    const rows = await client.query<{ body: unknown }>(
      'SELECT body FROM analiza.home_custodies WHERE organization_id=$1 ORDER BY sent_at DESC,id',
      [actor.organizationId],
    );
    result.homeCustodies = rows.rows.map((row) => homeCustodySchema.parse(row.body));
  }
  if (can(actor.role, 'inventory:write')) {
    const patients = await client.query<{
      id: string;
      body: { fullName?: string; address?: { line?: string } };
    }>(
      "SELECT id,body FROM analiza.patients WHERE organization_id=$1 ORDER BY lower(body->>'fullName'),id",
      [actor.organizationId],
    );
    result.deliveryPatients = patients.rows.map((row) => ({
      id: row.id,
      fullName: row.body.fullName ?? 'Paciente',
      addressLine: row.body.address?.line || undefined,
    }));
  }
  const scope = await commercialScope(client, actor);
  result.commercialAccess = scope;
  if (scope) {
    const [visits, admissions, goals, doctors] = [
      await client.query<{ body: unknown }>(
        'SELECT body FROM analiza.commercial_visits WHERE organization_id=$1 ORDER BY occurred_at DESC,id',
        [actor.organizationId],
      ),
      await client.query<{ body: unknown }>(
        'SELECT body FROM analiza.commercial_admissions WHERE organization_id=$1 ORDER BY admitted_at DESC,id',
        [actor.organizationId],
      ),
      await client.query<{ body: unknown }>(
        'SELECT body FROM analiza.commercial_goals WHERE organization_id=$1 ORDER BY period_start DESC,id',
        [actor.organizationId],
      ),
      await client.query<{ id: string; body: { fullName?: string } }>(
        "SELECT id,body FROM analiza.doctors WHERE organization_id=$1 ORDER BY lower(body->>'fullName'),id",
        [actor.organizationId],
      ),
    ];
    result.commercialVisits = visits.rows.map((row) => commercialVisitSchema.parse(row.body));
    result.commercialAdmissions = admissions.rows.map((row) =>
      commercialAdmissionSchema.parse(row.body),
    );
    result.commercialGoals = goals.rows.map((row) => commercialGoalSchema.parse(row.body));
    result.commercialDoctors = doctors.rows.map((row) => ({
      id: row.id,
      fullName: row.body.fullName ?? 'Médico',
    }));
  }
  if (can(actor.role, 'payments:read') || scope) {
    const rows = await client.query<{ body: unknown }>(
      can(actor.role, 'payments:read')
        ? 'SELECT body FROM analiza.confirmed_sales WHERE organization_id=$1 ORDER BY occurred_at DESC,id'
        : `SELECT sale.body FROM analiza.confirmed_sales sale
           JOIN analiza.commercial_visits visit
             ON visit.organization_id=sale.organization_id
            AND visit.id=sale.body->>'commercialVisitId'
           WHERE sale.organization_id=$1 ORDER BY sale.occurred_at DESC,sale.id`,
      [actor.organizationId],
    );
    result.confirmedSales = rows.rows.map((row) => confirmedSaleSchema.parse(row.body));
  }
}

export async function executeFieldCommand(pool: Pool, actor: ServerActor, raw: unknown) {
  const command = z.object({ command: z.string() }).passthrough().parse(raw).command;
  if (!isFieldCommand(command)) throw new MongoInputError('Comando no reconocido.');
  return transaction(pool, actor, async (client) => {
    const scope = await commercialScope(client, actor);
    if (command === 'home.dispatch') {
      requirePermission(actor, 'inventory:write');
      const { dispatch } = z
        .object({ command: z.literal('home.dispatch'), dispatch: homeCustodyInputSchema })
        .strict()
        .parse(raw);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${actor.organizationId}:${dispatch.itemId}:${dispatch.warehouseId}`,
      ]);
      const old = (
        await client.query<{ body: unknown }>(
          'SELECT body FROM analiza.home_custodies WHERE organization_id=$1 AND idempotency_key=$2',
          [actor.organizationId, dispatch.idempotencyKey],
        )
      ).rows[0];
      if (old) {
        sameInput(old.body, dispatch, homeCustodyInputSchema);
        return homeCustodySchema.parse(old.body);
      }
      const patient = await client.query(
        'SELECT id FROM analiza.patients WHERE organization_id=$1 AND id=$2',
        [actor.organizationId, dispatch.patientId],
      );
      if (!patient.rowCount) throw new MongoInputError('Seleccione un paciente disponible.');
      if (dispatch.caseId) {
        const hospitalization = await client.query(
          'SELECT id FROM analiza.hospitalizations WHERE organization_id=$1 AND id=$2 AND patient_id=$3',
          [actor.organizationId, dispatch.caseId, dispatch.patientId],
        );
        if (!hospitalization.rowCount)
          throw new MongoInputError('El caso no pertenece al paciente.');
      }
      const item = await client.query(
        `SELECT id FROM analiza.catalog_items WHERE organization_id=$1 AND id=$2
         AND body->>'status'='ACTIVE' AND body->>'category'=ANY($3::text[])`,
        [actor.organizationId, dispatch.itemId, ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT']],
      );
      const warehouse = await client.query(
        "SELECT id FROM analiza.warehouses WHERE organization_id=$1 AND id=$2 AND status='ACTIVE'",
        [actor.organizationId, dispatch.warehouseId],
      );
      if (!item.rowCount || !warehouse.rowCount)
        throw new MongoInputError('Seleccione un artículo de inventario y una bodega activa.');
      const balance = Number(
        (
          await client.query<{ balance: string }>(
            `SELECT coalesce(sum(delta),0) AS balance FROM analiza.inventory_movements
         WHERE organization_id=$1 AND item_id=$2 AND warehouse_id=$3`,
            [actor.organizationId, dispatch.itemId, dispatch.warehouseId],
          )
        ).rows[0]?.balance ?? 0,
      );
      if (balance < dispatch.quantity)
        throw new MongoInputError('No hay existencias suficientes en esta bodega.');
      const traced = await client.query(
        'SELECT 1 FROM analiza.inventory_trace_records WHERE organization_id=$1 AND item_id=$2 LIMIT 1',
        [actor.organizationId, dispatch.itemId],
      );
      const allocations: Array<{ traceRecordId: string; number: string; quantity: number }> = [];
      if (traced.rowCount) {
        const candidates = await client.query<{
          id: string;
          number_normalized: string;
          quantity: number;
        }>(
          `SELECT record.id,record.number_normalized,balance.quantity
           FROM analiza.inventory_trace_records record
           JOIN analiza.inventory_trace_balances balance
             ON balance.organization_id=record.organization_id AND balance.trace_record_id=record.id
           WHERE record.organization_id=$1 AND record.item_id=$2 AND balance.warehouse_id=$3
             AND balance.quantity>0 AND record.quality_status='AVAILABLE'
             AND (record.expires_on IS NULL OR record.expires_on >= $4::date)
           ORDER BY record.expires_on ASC NULLS LAST,record.received_at,record.id
           FOR UPDATE OF record,balance`,
          [
            actor.organizationId,
            dispatch.itemId,
            dispatch.warehouseId,
            salvadorDay(dispatch.sentAt),
          ],
        );
        let remaining = dispatch.quantity;
        if (candidates.rows.reduce((sum, row) => sum + Number(row.quantity), 0) < remaining)
          throw new MongoInputError('No hay lotes liberados y vigentes suficientes.');
        for (const [index, row] of candidates.rows.entries()) {
          if (!remaining) break;
          const quantity = Math.min(remaining, Number(row.quantity));
          remaining -= quantity;
          await client.query(
            `UPDATE analiza.inventory_trace_balances SET quantity=quantity-$4,updated_at=$5
             WHERE organization_id=$1 AND trace_record_id=$2 AND warehouse_id=$3`,
            [actor.organizationId, row.id, dispatch.warehouseId, quantity, dispatch.sentAt],
          );
          await movementOut(client, actor, dispatch, quantity, String(index), {
            id: row.id,
            number: row.number_normalized,
          });
          await client.query(
            `INSERT INTO analiza.inventory_trace_events(
               organization_id,id,trace_record_id,event_type,idempotency_key,body,occurred_at
             ) VALUES($1,$2,$3,'ISSUED',$4,$5::jsonb,$6)`,
            [
              actor.organizationId,
              `${dispatch.id}:trace:${index}`,
              row.id,
              `${dispatch.idempotencyKey}:trace:${index}`,
              JSON.stringify({ dispatchId: dispatch.id, quantity, traceRecordId: row.id }),
              dispatch.sentAt,
            ],
          );
          allocations.push({ traceRecordId: row.id, number: row.number_normalized, quantity });
        }
      } else {
        await movementOut(client, actor, dispatch, dispatch.quantity, 'untraced');
      }
      const custody = homeCustodySchema.parse({
        ...dispatch,
        status: 'OPEN',
        dispatchedBy: actor.userId,
        returnedQuantity: 0,
        traceAllocations: allocations,
      });
      await client.query(
        `INSERT INTO analiza.home_custodies(
           organization_id,id,patient_id,item_id,warehouse_id,idempotency_key,status,body,sent_at
         ) VALUES($1,$2,$3,$4,$5,$6,'OPEN',$7::jsonb,$8)`,
        [
          actor.organizationId,
          custody.id,
          custody.patientId,
          custody.itemId,
          custody.warehouseId,
          custody.idempotencyKey,
          JSON.stringify(custody),
          custody.sentAt,
        ],
      );
      await audit(client, actor, 'HOME_CUSTODY_DISPATCHED', 'home_custodies', custody.id);
      return custody;
    }
    if (command === 'home.close') {
      requirePermission(actor, 'inventory:write');
      const { closure } = z
        .object({ command: z.literal('home.close'), closure: homeCustodyCloseSchema })
        .strict()
        .parse(raw);
      const old = (
        await client.query<{ body: unknown }>(
          `SELECT body FROM analiza.home_custodies
         WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
          [actor.organizationId, closure.custodyId],
        )
      ).rows[0];
      if (!old) throw new MongoInputError('El despacho no existe.');
      const current = homeCustodySchema.parse(old.body);
      if (current.status === 'CLOSED') {
        if (
          current.closeKey !== closure.idempotencyKey ||
          current.returnedQuantity !== closure.returnedQuantity ||
          current.receivedAt !== closure.receivedAt ||
          current.returnCondition !== closure.conditionNote
        )
          throw new MongoConflictError();
        return current;
      }
      if (closure.returnedQuantity > current.quantity)
        throw new MongoInputError('La devolución no puede exceder lo enviado.');
      const closed = homeCustodySchema.parse({
        ...current,
        status: 'CLOSED',
        returnedQuantity: closure.returnedQuantity,
        receivedAt: closure.receivedAt,
        returnCondition: closure.conditionNote,
        closeKey: closure.idempotencyKey,
      });
      if (closure.returnedQuantity) {
        await client.query(
          `INSERT INTO analiza.home_return_holds(
             organization_id,id,custody_id,item_id,quantity,condition_note,received_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [
            actor.organizationId,
            `${current.id}:return`,
            current.id,
            current.itemId,
            closure.returnedQuantity,
            closure.conditionNote,
            closure.receivedAt,
          ],
        );
      }
      await client.query(
        `UPDATE analiza.home_custodies SET status='CLOSED',body=$3::jsonb,closed_at=$4
         WHERE organization_id=$1 AND id=$2`,
        [actor.organizationId, current.id, JSON.stringify(closed), closure.receivedAt],
      );
      await audit(client, actor, 'HOME_CUSTODY_CLOSED', 'home_custodies', current.id);
      return closed;
    }
    if (command === 'commercial.visit.record') {
      requireScope(scope, ['REP']);
      const { visit } = z
        .object({
          command: z.literal('commercial.visit.record'),
          visit: commercialVisitInputSchema,
        })
        .strict()
        .parse(raw);
      const old = (
        await client.query<{ body: unknown }>(
          'SELECT body FROM analiza.commercial_visits WHERE organization_id=$1 AND idempotency_key=$2',
          [actor.organizationId, visit.idempotencyKey],
        )
      ).rows[0];
      if (old) {
        sameInput(old.body, visit, commercialVisitInputSchema);
        return commercialVisitSchema.parse(old.body);
      }
      if (
        !(
          await client.query('SELECT id FROM analiza.doctors WHERE organization_id=$1 AND id=$2', [
            actor.organizationId,
            visit.doctorId,
          ])
        ).rowCount
      )
        throw new MongoInputError('Seleccione un médico del directorio.');
      const recorded = commercialVisitSchema.parse({ ...visit, actorUserId: actor.userId });
      await client.query(
        `INSERT INTO analiza.commercial_visits(
           organization_id,id,doctor_id,actor_user_id,idempotency_key,body,occurred_at
         ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [
          actor.organizationId,
          visit.id,
          visit.doctorId,
          actor.userId,
          visit.idempotencyKey,
          JSON.stringify(recorded),
          visit.occurredAt,
        ],
      );
      await audit(client, actor, 'COMMERCIAL_VISIT_RECORDED', 'commercial_visits', visit.id);
      return recorded;
    }
    if (command === 'commercial.admission.link') {
      requireScope(scope, ['REP', 'MANAGER']);
      const { admission } = z
        .object({
          command: z.literal('commercial.admission.link'),
          admission: commercialAdmissionInputSchema,
        })
        .strict()
        .parse(raw);
      const old = (
        await client.query<{ body: unknown }>(
          'SELECT body FROM analiza.commercial_admissions WHERE organization_id=$1 AND idempotency_key=$2',
          [actor.organizationId, admission.idempotencyKey],
        )
      ).rows[0];
      if (old) {
        sameInput(old.body, admission, commercialAdmissionInputSchema);
        return commercialAdmissionSchema.parse(old.body);
      }
      const visit = (
        await client.query<{ actor_user_id: string }>(
          'SELECT actor_user_id FROM analiza.commercial_visits WHERE organization_id=$1 AND id=$2',
          [actor.organizationId, admission.visitId],
        )
      ).rows[0];
      if (!visit || (scope === 'REP' && visit.actor_user_id !== actor.userId))
        throw new MongoInputError('Vincule una visita comercial autorizada.');
      const caseRow = (
        await client.query<{ patient_id: string; body: { startDate?: string } }>(
          'SELECT patient_id,body FROM analiza.hospitalizations WHERE organization_id=$1 AND id=$2',
          [actor.organizationId, admission.hospitalizationId],
        )
      ).rows[0];
      if (!caseRow?.body.startDate)
        throw new MongoInputError('Seleccione una hospitalización registrada.');
      const linked = commercialAdmissionSchema.parse({
        ...admission,
        patientId: caseRow.patient_id,
        admittedAt: caseRow.body.startDate,
        actorUserId: actor.userId,
      });
      await client.query(
        `INSERT INTO analiza.commercial_admissions(
           organization_id,id,hospitalization_id,idempotency_key,body,admitted_at
         ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
        [
          actor.organizationId,
          linked.id,
          linked.hospitalizationId,
          linked.idempotencyKey,
          JSON.stringify(linked),
          linked.admittedAt,
        ],
      );
      await audit(client, actor, 'COMMERCIAL_ADMISSION_LINKED', 'commercial_admissions', linked.id);
      return linked;
    }
    if (command === 'commercial.goal.save') {
      requireScope(scope, ['MANAGER']);
      const { goal } = z
        .object({ command: z.literal('commercial.goal.save'), goal: commercialGoalInputSchema })
        .strict()
        .parse(raw);
      if (
        (goal.period === 'MONTH' && !goal.periodStart.endsWith('-01')) ||
        (goal.period === 'WEEK' && new Date(`${goal.periodStart}T00:00:00Z`).getUTCDay() !== 1)
      )
        throw new MongoInputError('El período debe iniciar el lunes o el primer día del mes.');
      const key = `commercial-goal:${goal.idempotencyKey}`;
      const hash = createHash('sha256').update(JSON.stringify(goal)).digest('hex');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${actor.organizationId}:${key}`,
      ]);
      const prior = (
        await client.query<{ payload_hash: string; result: unknown }>(
          'SELECT payload_hash,result FROM analiza.commands WHERE organization_id=$1 AND idempotency_key=$2',
          [actor.organizationId, key],
        )
      ).rows[0];
      if (prior) {
        if (prior.payload_hash !== hash) throw new MongoConflictError();
        return commercialGoalSchema.parse(prior.result);
      }
      const existing = (
        await client.query<{ id: string }>(
          'SELECT id FROM analiza.commercial_goals WHERE organization_id=$1 AND period=$2 AND period_start=$3 FOR UPDATE',
          [actor.organizationId, goal.period, goal.periodStart],
        )
      ).rows[0];
      const saved = commercialGoalSchema.parse({
        ...goal,
        id: existing?.id ?? goal.id,
        setBy: actor.userId,
      });
      await client.query(
        `INSERT INTO analiza.commercial_goals(
           organization_id,id,period,period_start,idempotency_key,body
         ) VALUES($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT(organization_id,period,period_start)
         DO UPDATE SET body=EXCLUDED.body,idempotency_key=EXCLUDED.idempotency_key`,
        [
          actor.organizationId,
          saved.id,
          saved.period,
          saved.periodStart,
          saved.idempotencyKey,
          JSON.stringify(saved),
        ],
      );
      await client.query(
        'INSERT INTO analiza.commands(organization_id,idempotency_key,payload_hash,result) VALUES($1,$2,$3,$4::jsonb)',
        [actor.organizationId, key, hash, JSON.stringify(saved)],
      );
      await audit(client, actor, 'COMMERCIAL_GOAL_SAVED', 'commercial_goals', saved.id);
      return saved;
    }
    if (!can(actor.role, 'payments:write') && scope !== 'MANAGER') throw new MongoAccessError();
    const { sale } = z
      .object({ command: z.literal('sale.confirmed.record'), sale: confirmedSaleInputSchema })
      .strict()
      .parse(raw);
    const normalizedReference = sale.reference.toLocaleUpperCase('es-SV');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `${actor.organizationId}:confirmed-sale:${normalizedReference}`,
    ]);
    const old = (
      await client.query<{ body: unknown }>(
        'SELECT body FROM analiza.confirmed_sales WHERE organization_id=$1 AND idempotency_key=$2',
        [actor.organizationId, sale.idempotencyKey],
      )
    ).rows[0];
    if (old) {
      sameInput(old.body, sale, confirmedSaleInputSchema);
      return confirmedSaleSchema.parse(old.body);
    }
    if (
      (
        await client.query(
          'SELECT id FROM analiza.confirmed_sales WHERE organization_id=$1 AND reference_normalized=$2',
          [actor.organizationId, normalizedReference],
        )
      ).rowCount
    )
      throw new MongoConflictError();
    if (sale.quoteId) {
      const quote = (
        await client.query<{ body: { status?: string; immutable?: boolean } }>(
          'SELECT body FROM analiza.quotes WHERE organization_id=$1 AND id=$2',
          [actor.organizationId, sale.quoteId],
        )
      ).rows[0];
      if (!quote || quote.body.status !== 'SENT' || !quote.body.immutable)
        throw new MongoInputError('La cotización de respaldo debe estar enviada e inmutable.');
    }
    if (
      sale.commercialVisitId &&
      !(
        await client.query(
          'SELECT id FROM analiza.commercial_visits WHERE organization_id=$1 AND id=$2',
          [actor.organizationId, sale.commercialVisitId],
        )
      ).rowCount
    )
      throw new MongoInputError('La visita comercial no está disponible.');
    const confirmed = confirmedSaleSchema.parse({ ...sale, confirmedBy: actor.userId });
    await client.query(
      `INSERT INTO analiza.confirmed_sales(
         organization_id,id,reference_normalized,idempotency_key,amount_cents,body,occurred_at
       ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [
        actor.organizationId,
        sale.id,
        normalizedReference,
        sale.idempotencyKey,
        Math.round(sale.amount * 100),
        JSON.stringify(confirmed),
        sale.occurredAt,
      ],
    );
    await audit(client, actor, 'SALE_CONFIRMED', 'confirmed_sales', confirmed.id);
    return confirmed;
  });
}
