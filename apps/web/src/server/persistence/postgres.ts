import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  patientSchema,
  doctorSchema,
  hospitalizationSchema,
  nursingResourceSchema,
  shiftSchema,
  configurationEntrySchema,
  catalogItemSchema,
  purchaseSchema,
  clinicalDocumentSchema,
  inventoryMovementSchema,
  paymentSchema,
  visitInputSchema,
  visitSchema,
  goalInputSchema,
  goalSchema,
  emptyOperations,
  warehouseInputSchema,
  warehouseSchema,
  warehouseTransferSchema,
  inventoryTraceReceiptSchema,
  inventoryTraceRecordSchema,
  inventoryTraceStatusChangeSchema,
  inventoryFefoIssueSchema,
  type Patient,
  type Doctor,
  type Hospitalization,
  type NursingResource,
  type OperationsSnapshot,
  type Quote,
  type Shift,
  type ClinicalDocument,
  type Payment,
  type InventoryMovement,
} from '@analiza/contracts';
import { can, isAdministrator, type Permission } from '@/lib/permissions';
import { normalizePurchaseTraceability } from '@/lib/purchase-catalog';
import { emptyServerWorkspace } from '@/lib/workspace-empty';
import { AuthService, hashPassword } from '../auth-service';
import {
  MongoAccessError,
  MongoInputError,
  MongoConflictError,
  MongoDuplicatePatientError,
  parsePatientCreate,
  parsePatientReplace,
  rejectBrowserAuthority,
  type ServerActor,
} from '../validation/patients';
import { parseDoctorCreate, parseDoctorReplace } from '../validation/doctors';
import {
  parseHospitalizationCreate,
  parseHospitalizationReplace,
} from '../validation/hospitalizations';
import {
  parseShiftSeriesCommand,
  parseShiftUpdateCommand,
  assertNoSeriesCollisions,
} from '../validation/shifts';
import type { EntityRepository, Persistence } from './contracts';
import { postgresPool, transaction } from './postgres-pool';
import { postgresAuthStore } from './postgres-auth';
import { postgresFiles } from './postgres-files';
import { PostgresWorkspaceSetupRepository } from './postgres-workspace-setup';
import { PostgresLoginAnalyticsRepository } from '../login-analytics';
import { PostgresNurseProfileRepository } from './postgres-nurse-profile';
import { PostgresFeedbackRepository } from './postgres-feedback';
import { PostgresInformationImportRepository } from './postgres-information-import';
import { postgresQuotes } from './postgres-quotes';

export function authorize(actor: ServerActor, permission: Permission) {
  if (!can(actor.role, permission)) throw new MongoAccessError();
}
export async function audit(
  client: PoolClient,
  actor: ServerActor,
  action: string,
  type: string,
  id: string,
) {
  await client.query(
    'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
    [actor.organizationId, randomUUID(), actor.userId, action, type, id],
  );
}
type Entity = Patient | Doctor | Hospitalization;
type Kind = 'patients' | 'doctors' | 'hospitalizations';
const tables: Record<Kind, string> = {
  patients: 'analiza.patients',
  doctors: 'analiza.doctors',
  hospitalizations: 'analiza.hospitalizations',
};

function entityRepository<T extends Entity, K extends string>(
  pool: Pool,
  kind: Kind,
  key: K,
  schema: z.ZodType<T>,
  readPermission: Permission,
  writePermission: Permission,
  create: (input: unknown) => T,
  replace: (input: unknown) => { value: T; expectedVersion: number },
): EntityRepository<T, K> {
  // SQL identifiers come exclusively from this static allowlist, never HTTP or environment values.
  const table = tables[kind];
  async function resolveCase(client: PoolClient, actor: ServerActor, value: T): Promise<T> {
    if (kind !== 'hospitalizations') return value;
    const h = value as Hospitalization;
    const patient = await client.query(
      'SELECT id FROM analiza.patients WHERE organization_id=$1 AND id=$2',
      [actor.organizationId, h.patientId],
    );
    if (!patient.rowCount) throw new MongoInputError('El paciente asociado no está disponible.');
    const ids = [...new Set(h.assignedNursingResourceIds ?? [])];
    const nurses = ids.length
      ? await client.query(
          `SELECT r.id,r.user_id FROM analiza.nursing_resources r JOIN analiza.memberships m ON m.user_id=r.user_id AND m.organization_id=r.organization_id
          WHERE r.organization_id=$1 AND r.id=ANY($2::text[]) AND m.active AND m.role IN ('ADMIN','WEBMASTER','NURSE','NURSE_MANAGER')`,
          [actor.organizationId, ids],
        )
      : { rows: [], rowCount: 0 };
    if (ids.length && nurses.rowCount !== ids.length)
      throw new MongoInputError('Una enfermera no tiene una cuenta activa en esta organización.');
    return {
      ...h,
      assignedNursingResourceIds: ids,
      assignedNurseUserIds: ids.map((id) => nurses.rows.find((r) => r.id === id).user_id),
    } as T;
  }
  async function write(actor: ServerActor, value: T, version?: number): Promise<T> {
    try {
      return await transaction(pool, actor, async (client) => {
        const resolved = await resolveCase(client, actor, value);
        const values: unknown[] = [actor.organizationId, resolved.id, JSON.stringify(resolved)];
        let extra = '';
        if (kind === 'patients') {
          values.push((resolved as Patient).documentId.replace(/\s/g, '').toUpperCase());
          extra = 'document_key';
        }
        if (kind === 'hospitalizations') {
          values.push((resolved as Hospitalization).patientId);
          extra = 'patient_id';
        }
        if (version === undefined) {
          await client.query(
            `INSERT INTO ${table}(organization_id,id,body${extra ? ',' + extra : ''}) VALUES($1,$2,$3::jsonb${extra ? ',$4' : ''})`,
            values,
          );
        } else {
          values.push(version);
          const result = await client.query(
            `UPDATE ${table} SET body=$3::jsonb,version=version+1,updated_at=now()${extra ? ',' + extra + '=$4' : ''} WHERE organization_id=$1 AND id=$2 AND version=$${values.length}`,
            values,
          );
          if (result.rowCount !== 1) throw new MongoConflictError();
        }
        if (kind === 'hospitalizations') {
          await client.query(
            'UPDATE analiza.hospitalization_nurses SET active=false WHERE organization_id=$1 AND hospitalization_id=$2',
            [actor.organizationId, value.id],
          );
          for (const id of (resolved as Hospitalization).assignedNursingResourceIds ?? [])
            await client.query(
              'INSERT INTO analiza.hospitalization_nurses(organization_id,hospitalization_id,resource_id) VALUES($1,$2,$3) ON CONFLICT(organization_id,hospitalization_id,resource_id) DO UPDATE SET active=true',
              [actor.organizationId, value.id, id],
            );
        }
        await audit(client, actor, version === undefined ? 'CREATED' : 'UPDATED', kind, value.id);
        return schema.parse(resolved);
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        if (kind === 'patients') throw new MongoDuplicatePatientError();
        throw new MongoConflictError();
      }
      throw error;
    }
  }
  return {
    async listWithVersions(actor) {
      authorize(actor, readPermission);
      return transaction(pool, actor, async (client) =>
        (
          await client.query(
            `SELECT body,version FROM ${table} WHERE organization_id=$1 ORDER BY id`,
            [actor.organizationId],
          )
        ).rows.map(
          (r) =>
            ({ [key]: schema.parse(r.body), version: r.version }) as Record<K, T> & {
              version: number;
            },
        ),
      );
    },
    async get(actor, id) {
      authorize(actor, readPermission);
      return transaction(pool, actor, async (client) => {
        const row = (
          await client.query(`SELECT body FROM ${table} WHERE organization_id=$1 AND id=$2`, [
            actor.organizationId,
            id,
          ])
        ).rows[0];
        return row ? schema.parse(row.body) : null;
      });
    },
    async create(actor, input) {
      authorize(actor, writePermission);
      return write(actor, create(input));
    },
    async replace(actor, id, input) {
      authorize(actor, writePermission);
      const parsed = replace(input);
      if (parsed.value.id !== id)
        throw new MongoInputError('El identificador de ruta no coincide.');
      return write(actor, parsed.value, parsed.expectedVersion);
    },
  };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}

async function insertTraceMovement(
  client: PoolClient,
  actor: ServerActor,
  input: {
    id: string;
    idempotencyKey: string;
    itemId: string;
    warehouseId: string;
    quantity: number;
    delta: number;
    createdAt: string;
    reason: string;
    reference?: string;
    traceRecordId: string;
    traceNumber: string;
    kind?: 'ENTRY' | 'EXIT' | 'TRANSFER';
    transferId?: string;
    transferDirection?: 'IN' | 'OUT';
    counterpartWarehouseId?: string;
  },
) {
  const movement = inventoryMovementSchema.parse({
    id: input.id,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    quantity: input.quantity,
    createdAt: input.createdAt,
    reason: input.reason,
    reference: input.reference,
    user: actor.userId,
    kind: input.kind ?? (input.delta > 0 ? 'ENTRY' : 'EXIT'),
    traceRecordId: input.traceRecordId,
    traceNumber: input.traceNumber,
    transferId: input.transferId,
    transferDirection: input.transferDirection,
    counterpartWarehouseId: input.counterpartWarehouseId,
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
      input.idempotencyKey,
      input.delta,
      JSON.stringify(movement),
      movement.createdAt,
      input.traceRecordId,
    ],
  );
  return movement;
}

export function postgresPersistence(): Persistence {
  const pool = postgresPool();
  const patients = entityRepository(
    pool,
    'patients',
    'patient',
    patientSchema,
    'patients:read',
    'patients:write',
    parsePatientCreate,
    (input) => {
      const p = parsePatientReplace(input);
      return { value: p.patient, expectedVersion: p.expectedVersion };
    },
  );
  const doctors = entityRepository(
    pool,
    'doctors',
    'doctor',
    doctorSchema,
    'settings:write',
    'settings:write',
    parseDoctorCreate,
    (input) => {
      const p = parseDoctorReplace(input);
      return { value: p.doctor, expectedVersion: p.expectedVersion };
    },
  );
  const hospitalizations = entityRepository(
    pool,
    'hospitalizations',
    'hospitalization',
    hospitalizationSchema,
    'cases:read',
    'cases:write',
    parseHospitalizationCreate,
    (input) => {
      const p = parseHospitalizationReplace(input);
      return { value: p.hospitalization, expectedVersion: p.expectedVersion };
    },
  );
  const quotes = postgresQuotes(pool);
  const shifts: Persistence['shifts'] = {
    async list(actor) {
      authorize(actor, 'agenda:read');
      return transaction(pool, actor, async (c) =>
        (
          await c.query(
            'SELECT body FROM analiza.shifts WHERE organization_id=$1 ORDER BY starts_at,id',
            [actor.organizationId],
          )
        ).rows.map((r) => shiftSchema.parse(r.body)),
      );
    },
    async listResources(actor) {
      authorize(actor, 'agenda:read');
      return transaction(pool, actor, async (c) =>
        (
          await c.query(
            'SELECT body FROM analiza.nursing_resources WHERE organization_id=$1 ORDER BY id',
            [actor.organizationId],
          )
        ).rows.map((r) => nursingResourceSchema.parse(r.body)),
      );
    },
    async createSeries(actor, input) {
      authorize(actor, 'agenda:write');
      const parsed = parseShiftSeriesCommand(input);
      assertNoSeriesCollisions(parsed.shifts);
      return transaction(pool, actor, async (c) => {
        const hash = createHash('sha256').update(canonical(parsed.shifts)).digest('hex');
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          actor.organizationId + ':shift:' + parsed.idempotencyKey,
        ]);
        const old = (
          await c.query(
            'SELECT payload_hash,result FROM analiza.commands WHERE organization_id=$1 AND idempotency_key=$2',
            [actor.organizationId, parsed.idempotencyKey],
          )
        ).rows[0];
        if (old) {
          if (old.payload_hash !== hash) throw new MongoConflictError();
          return z.array(shiftSchema).parse(old.result);
        }
        // Lock resources in a stable order so different concurrent commands cannot double-book.
        for (const id of [...new Set(parsed.shifts.map((s) => s.resourceId))].sort()) {
          if (
            !(
              await c.query(
                'SELECT id FROM analiza.nursing_resources WHERE organization_id=$1 AND id=$2 FOR UPDATE',
                [actor.organizationId, id],
              )
            ).rowCount
          )
            throw new MongoInputError('El recurso asignado no está disponible.');
        }
        for (const shift of parsed.shifts) {
          if (
            shift.patientId &&
            !(
              await c.query('SELECT id FROM analiza.patients WHERE organization_id=$1 AND id=$2', [
                actor.organizationId,
                shift.patientId,
              ])
            ).rowCount
          )
            throw new MongoInputError('El paciente asignado no está disponible.');
          if (
            shift.status !== 'CANCELLED' &&
            (
              await c.query(
                "SELECT id FROM analiza.shifts WHERE organization_id=$1 AND resource_id=$2 AND status<>'CANCELLED' AND starts_at<$4 AND ends_at>$3 LIMIT 1",
                [actor.organizationId, shift.resourceId, shift.startsAt, shift.endsAt],
              )
            ).rowCount
          )
            throw new MongoInputError('El recurso ya tiene un turno que colisiona.');
          await c.query(
            'INSERT INTO analiza.shifts(organization_id,id,resource_id,patient_id,starts_at,ends_at,status,body) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [
              actor.organizationId,
              shift.id,
              shift.resourceId,
              shift.patientId ?? null,
              shift.startsAt,
              shift.endsAt,
              shift.status,
              JSON.stringify(shift),
            ],
          );
        }
        await c.query(
          'INSERT INTO analiza.commands(organization_id,idempotency_key,payload_hash,result) VALUES($1,$2,$3,$4)',
          [actor.organizationId, parsed.idempotencyKey, hash, JSON.stringify(parsed.shifts)],
        );
        await audit(c, actor, 'SHIFT_SERIES_CREATED', 'shifts', parsed.idempotencyKey);
        return parsed.shifts;
      });
    },
    async update(actor, input) {
      authorize(actor, 'agenda:write');
      const parsed = parseShiftUpdateCommand(input);
      return transaction(pool, actor, async (c) => {
        const hash = createHash('sha256').update(canonical(parsed.shift)).digest('hex');
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          actor.organizationId + ':shift-update:' + parsed.idempotencyKey,
        ]);
        const old = (
          await c.query(
            'SELECT payload_hash,result FROM analiza.commands WHERE organization_id=$1 AND idempotency_key=$2',
            [actor.organizationId, parsed.idempotencyKey],
          )
        ).rows[0];
        if (old) {
          if (old.payload_hash !== hash) throw new MongoConflictError();
          return shiftSchema.parse(old.result);
        }
        const current = (
          await c.query(
            'SELECT body,status FROM analiza.shifts WHERE organization_id=$1 AND id=$2 FOR UPDATE',
            [actor.organizationId, parsed.shift.id],
          )
        ).rows[0];
        if (!current) throw new MongoInputError('El turno ya no está disponible.');
        if (current.status !== 'SCHEDULED' || parsed.shift.status !== 'SCHEDULED')
          throw new MongoInputError('Sólo se pueden editar turnos programados.');
        if (
          !(
            await c.query(
              'SELECT id FROM analiza.nursing_resources WHERE organization_id=$1 AND id=$2 FOR UPDATE',
              [actor.organizationId, parsed.shift.resourceId],
            )
          ).rowCount
        )
          throw new MongoInputError('El recurso asignado no está disponible.');
        if (
          parsed.shift.patientId &&
          !(
            await c.query('SELECT id FROM analiza.patients WHERE organization_id=$1 AND id=$2', [
              actor.organizationId,
              parsed.shift.patientId,
            ])
          ).rowCount
        )
          throw new MongoInputError('El paciente asignado no está disponible.');
        if (
          (
            await c.query(
              "SELECT id FROM analiza.shifts WHERE organization_id=$1 AND id<>$2 AND resource_id=$3 AND status<>'CANCELLED' AND starts_at<$5 AND ends_at>$4 LIMIT 1",
              [
                actor.organizationId,
                parsed.shift.id,
                parsed.shift.resourceId,
                parsed.shift.startsAt,
                parsed.shift.endsAt,
              ],
            )
          ).rowCount
        )
          throw new MongoInputError('El recurso ya tiene un turno que colisiona.');
        await c.query(
          'UPDATE analiza.shifts SET resource_id=$3,patient_id=$4,starts_at=$5,ends_at=$6,status=$7,body=$8 WHERE organization_id=$1 AND id=$2',
          [
            actor.organizationId,
            parsed.shift.id,
            parsed.shift.resourceId,
            parsed.shift.patientId ?? null,
            parsed.shift.startsAt,
            parsed.shift.endsAt,
            parsed.shift.status,
            JSON.stringify(parsed.shift),
          ],
        );
        await c.query(
          'INSERT INTO analiza.commands(organization_id,idempotency_key,payload_hash,result) VALUES($1,$2,$3,$4)',
          [actor.organizationId, parsed.idempotencyKey, hash, JSON.stringify(parsed.shift)],
        );
        await audit(c, actor, 'SHIFT_UPDATED', 'shifts', parsed.shift.id);
        return parsed.shift;
      });
    },
  };
  const operations: Persistence['operations'] = {
    async list(actor) {
      return transaction(pool, actor, async (c) => {
        const result: OperationsSnapshot = emptyOperations();
        if (can(actor.role, 'catalogs:read') || can(actor.role, 'clinical:read'))
          result.configuration = (
            await c.query(
              'SELECT body FROM analiza.configuration_entries WHERE organization_id=$1 ORDER BY id',
              [actor.organizationId],
            )
          ).rows.map((r) => configurationEntrySchema.parse(r.body));
        if (can(actor.role, 'inventory:read'))
          result.warehouses = (
            await c.query(
              `SELECT body FROM analiza.warehouses
               WHERE organization_id=$1
               ORDER BY CASE status WHEN 'ACTIVE' THEN 0 ELSE 1 END,lower(body->>'name'),id`,
              [actor.organizationId],
            )
          ).rows.map((row) => warehouseSchema.parse(row.body));
        if (can(actor.role, 'inventory:read')) {
          const traceRows = await c.query<{ body: Record<string, unknown> }>(
            `SELECT body FROM analiza.inventory_trace_records
             WHERE organization_id=$1
             ORDER BY received_at DESC,id`,
            [actor.organizationId],
          );
          const balanceRows = await c.query<{
            trace_record_id: string;
            warehouse_id: string;
            quantity: number;
          }>(
            `SELECT trace_record_id,warehouse_id,quantity
             FROM analiza.inventory_trace_balances
             WHERE organization_id=$1
             ORDER BY trace_record_id,warehouse_id`,
            [actor.organizationId],
          );
          result.traceRecords = traceRows.rows.map((row) => {
            const recordId = String(row.body.id);
            return inventoryTraceRecordSchema.parse({
              ...row.body,
              balances: balanceRows.rows
                .filter((balance) => balance.trace_record_id === recordId)
                .map((balance) => ({
                  warehouseId: balance.warehouse_id,
                  quantity: Number(balance.quantity),
                })),
            });
          });
        }
        if (can(actor.role, 'reports:read')) {
          // A transaction owns one pg client. Keep its queries sequential: pg@9 will reject
          // overlapping client.query calls even when the current driver only warns about them.
          const professionals = await c.query(
            `SELECT u.id,u.display_name,m.role FROM analiza.users u JOIN analiza.memberships m ON m.user_id=u.id WHERE m.organization_id=$1 AND m.active AND m.role IN ('ADMIN','WEBMASTER','NURSE','NURSE_MANAGER','DOCTOR')`,
            [actor.organizationId],
          );
          result.professionals = professionals.rows.map((r) => ({
            userId: r.id,
            name: r.display_name,
            profession: r.role === 'DOCTOR' ? 'DOCTOR' : 'NURSE',
          }));
          const visits = await c.query(
            'SELECT body FROM analiza.home_visits WHERE organization_id=$1 ORDER BY created_at DESC,id',
            [actor.organizationId],
          );
          result.visits = visits.rows.map((r) => visitSchema.parse(r.body));
          const goals = await c.query(
            'SELECT body FROM analiza.visit_goals WHERE organization_id=$1 ORDER BY month DESC,id',
            [actor.organizationId],
          );
          result.goals = goals.rows.map((r) => goalSchema.parse(r.body));
        }
        return result;
      });
    },
    async execute(actor, input) {
      rejectBrowserAuthority(input);
      const command = z.object({ command: z.string() }).passthrough().parse(input);
      if (command.command === 'warehouse.save') {
        authorize(actor, 'inventory:write');
        const { warehouse: submitted } = z
          .object({ command: z.literal('warehouse.save'), warehouse: warehouseInputSchema })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `${actor.organizationId}:warehouse:${submitted.id}`,
          ]);
          const existing = (
            await c.query<{ body: unknown }>(
              'SELECT body FROM analiza.warehouses WHERE organization_id=$1 AND id=$2 FOR UPDATE',
              [actor.organizationId, submitted.id],
            )
          ).rows[0];
          if (!existing && submitted.status !== 'ACTIVE')
            throw new MongoInputError('Una bodega nueva debe iniciar activa.');
          if (existing && submitted.status === 'INACTIVE') {
            const stockedItems = await c.query(
              `SELECT 1 FROM (
                 SELECT item_id FROM analiza.inventory_movements
                 WHERE organization_id=$1 AND warehouse_id=$2
                 GROUP BY item_id HAVING sum(delta)<>0
                 UNION ALL
                 SELECT trace_record_id FROM analiza.inventory_trace_balances
                 WHERE organization_id=$1 AND warehouse_id=$2 AND quantity>0
               ) stocked LIMIT 1`,
              [actor.organizationId, submitted.id],
            );
            if (stockedItems.rowCount)
              throw new MongoInputError(
                'Traslade o ajuste todas las existencias antes de desactivar la bodega.',
              );
          }
          const now = new Date().toISOString();
          const prior = existing ? warehouseSchema.parse(existing.body) : null;
          const warehouse = warehouseSchema.parse({
            ...submitted,
            code: submitted.code.toUpperCase(),
            description: submitted.description || undefined,
            createdAt: prior?.createdAt ?? now,
            updatedAt: now,
          });
          try {
            await c.query(
              `INSERT INTO analiza.warehouses(
                 organization_id,id,code_normalized,status,body,created_at,updated_at
               ) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)
               ON CONFLICT(organization_id,id) DO UPDATE SET
                 code_normalized=EXCLUDED.code_normalized,
                 status=EXCLUDED.status,
                 body=EXCLUDED.body,
                 updated_at=EXCLUDED.updated_at`,
              [
                actor.organizationId,
                warehouse.id,
                warehouse.code.toUpperCase(),
                warehouse.status,
                JSON.stringify(warehouse),
                warehouse.createdAt,
                warehouse.updatedAt,
              ],
            );
          } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
              throw new MongoConflictError();
            throw error;
          }
          const action = !prior
            ? 'WAREHOUSE_CREATED'
            : prior.status !== warehouse.status && warehouse.status === 'INACTIVE'
              ? 'WAREHOUSE_DEACTIVATED'
              : 'WAREHOUSE_UPDATED';
          await audit(c, actor, action, 'warehouses', warehouse.id);
          return warehouse;
        });
      }
      if (command.command === 'inventory.trace.receive') {
        authorize(actor, 'inventory:write');
        const { receipt } = z
          .object({
            command: z.literal('inventory.trace.receive'),
            receipt: inventoryTraceReceiptSchema,
          })
          .strict()
          .parse(input);
        if (receipt.purchaseId) authorize(actor, 'purchases:write');
        return transaction(pool, actor, async (c) => {
          const previous = (
            await c.query<{ body: unknown }>(
              `SELECT body FROM analiza.inventory_trace_events
               WHERE organization_id=$1 AND idempotency_key=$2`,
              [actor.organizationId, receipt.idempotencyKey],
            )
          ).rows[0];
          if (previous) {
            if (canonical(previous.body) !== canonical(receipt)) throw new MongoConflictError();
            const existing = (
              await c.query<{ body: Record<string, unknown> }>(
                `SELECT body FROM analiza.inventory_trace_records
                 WHERE organization_id=$1 AND id=$2`,
                [actor.organizationId, receipt.id],
              )
            ).rows[0];
            if (!existing) throw new MongoConflictError();
            const balances = await c.query<{ warehouse_id: string; quantity: number }>(
              `SELECT warehouse_id,quantity FROM analiza.inventory_trace_balances
               WHERE organization_id=$1 AND trace_record_id=$2 ORDER BY warehouse_id`,
              [actor.organizationId, receipt.id],
            );
            return inventoryTraceRecordSchema.parse({
              ...existing.body,
              balances: balances.rows.map((row) => ({
                warehouseId: row.warehouse_id,
                quantity: Number(row.quantity),
              })),
            });
          }
          const linkedPurchase = receipt.purchaseId
            ? (
                await c.query<{ body: unknown }>(
                  `SELECT body FROM analiza.purchases
                   WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
                  [actor.organizationId, receipt.purchaseId],
                )
              ).rows[0]
            : null;
          const purchase = linkedPurchase ? purchaseSchema.parse(linkedPurchase.body) : null;
          if (receipt.purchaseId && (!purchase || purchase.status !== 'DRAFT'))
            throw new MongoInputError('La compra no está pendiente de recepción.');
          if (
            purchase &&
            (purchase.catalogItemId !== receipt.itemId ||
              purchase.supplierCatalogItemId !== receipt.supplierCatalogItemId ||
              purchase.warehouseId !== receipt.warehouseId ||
              purchase.reference !== receipt.receiptReference ||
              purchase.quantity !== receipt.quantity ||
              (purchase.serialNumber ?? purchase.lotNumber)?.toUpperCase() !==
                receipt.number.toUpperCase() ||
              (purchase.expirationDate ?? undefined) !== (receipt.expiresOn ?? undefined))
          )
            throw new MongoInputError('La recepción no coincide con el borrador de compra.');
          const item = (
            await c.query<{ category: string }>(
              `SELECT body->>'category' AS category FROM analiza.catalog_items
               WHERE organization_id=$1 AND id=$2 AND body->>'status'='ACTIVE'`,
              [actor.organizationId, receipt.itemId],
            )
          ).rows[0];
          const expectedKind = item?.category === 'EQUIPMENT' ? 'SERIAL' : 'LOT';
          if (
            !item ||
            !['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(item.category) ||
            receipt.kind !== expectedKind
          )
            throw new MongoInputError(
              'Medicamentos e insumos usan lote; los equipos usan un número de serie por unidad.',
            );
          const supplier = await c.query(
            `SELECT id FROM analiza.catalog_items
             WHERE organization_id=$1 AND id=$2 AND body->>'status'='ACTIVE'
               AND body->>'category'='PROVIDERS'`,
            [actor.organizationId, receipt.supplierCatalogItemId],
          );
          if (!supplier.rowCount) throw new MongoInputError('Seleccione un proveedor activo.');
          const warehouse = await c.query(
            `SELECT id FROM analiza.warehouses
             WHERE organization_id=$1 AND id=$2 AND status='ACTIVE'`,
            [actor.organizationId, receipt.warehouseId],
          );
          if (!warehouse.rowCount) throw new MongoInputError('Seleccione una bodega activa.');
          const now = new Date().toISOString();
          const record = inventoryTraceRecordSchema.parse({
            id: receipt.id,
            kind: receipt.kind,
            itemId: receipt.itemId,
            supplierCatalogItemId: receipt.supplierCatalogItemId,
            number: receipt.number.toUpperCase(),
            receivedQuantity: receipt.quantity,
            manufacturedOn: receipt.manufacturedOn,
            expiresOn: receipt.kind === 'LOT' ? receipt.expiresOn : undefined,
            receiptReference: receipt.receiptReference,
            qualityStatus: 'QUARANTINED',
            receivedAt: receipt.receivedAt,
            createdAt: now,
            updatedAt: now,
            balances: [{ warehouseId: receipt.warehouseId, quantity: receipt.quantity }],
          });
          try {
            await c.query(
              `INSERT INTO analiza.inventory_trace_records(
                 organization_id,id,kind,item_id,supplier_catalog_item_id,number_normalized,
                 quality_status,expires_on,received_at,body,created_at,updated_at
               ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)`,
              [
                actor.organizationId,
                record.id,
                record.kind,
                record.itemId,
                record.supplierCatalogItemId,
                record.number.toUpperCase(),
                record.qualityStatus,
                record.expiresOn ?? null,
                record.receivedAt,
                JSON.stringify({ ...record, balances: [] }),
                record.createdAt,
                record.updatedAt,
              ],
            );
            await c.query(
              `INSERT INTO analiza.inventory_trace_balances(
                 organization_id,trace_record_id,warehouse_id,quantity
               ) VALUES($1,$2,$3,$4)`,
              [actor.organizationId, record.id, receipt.warehouseId, receipt.quantity],
            );
            await c.query(
              `INSERT INTO analiza.inventory_trace_events(
                 organization_id,id,trace_record_id,event_type,idempotency_key,body,occurred_at
               ) VALUES($1,$2,$3,'RECEIVED',$4,$5::jsonb,$6)`,
              [
                actor.organizationId,
                receipt.id,
                record.id,
                receipt.idempotencyKey,
                JSON.stringify(receipt),
                receipt.receivedAt,
              ],
            );
          } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
              throw new MongoConflictError();
            throw error;
          }
          if (purchase) {
            await c.query(
              `UPDATE analiza.purchases SET body=$3::jsonb
               WHERE organization_id=$1 AND id=$2`,
              [
                actor.organizationId,
                purchase.id,
                JSON.stringify({
                  ...purchase,
                  status: 'RECEIVED',
                  receivedAt: receipt.receivedAt,
                  traceRecordId: record.id,
                }),
              ],
            );
            await audit(c, actor, 'PURCHASE_RECEIVED', 'purchase', purchase.id);
          }
          await audit(c, actor, 'INVENTORY_TRACE_RECEIVED', 'inventory_trace_records', record.id);
          return record;
        });
      }
      if (command.command === 'inventory.trace.status') {
        authorize(actor, 'inventory:write');
        const { change } = z
          .object({
            command: z.literal('inventory.trace.status'),
            change: inventoryTraceStatusChangeSchema,
          })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          const previous = (
            await c.query<{ body: unknown }>(
              `SELECT body FROM analiza.inventory_trace_events
               WHERE organization_id=$1 AND idempotency_key=$2`,
              [actor.organizationId, change.idempotencyKey],
            )
          ).rows[0];
          if (previous) {
            if (canonical(previous.body) !== canonical(change)) throw new MongoConflictError();
            return { id: change.recordId };
          }
          const row = (
            await c.query<{ body: Record<string, unknown> }>(
              `SELECT body FROM analiza.inventory_trace_records
               WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
              [actor.organizationId, change.recordId],
            )
          ).rows[0];
          if (!row) throw new MongoInputError('El lote o serie no está disponible.');
          const balances = await c.query<{ warehouse_id: string; quantity: number }>(
            `SELECT warehouse_id,quantity FROM analiza.inventory_trace_balances
             WHERE organization_id=$1 AND trace_record_id=$2 ORDER BY warehouse_id FOR UPDATE`,
            [actor.organizationId, change.recordId],
          );
          const current = inventoryTraceRecordSchema.parse({
            ...row.body,
            balances: balances.rows.map((balance) => ({
              warehouseId: balance.warehouse_id,
              quantity: Number(balance.quantity),
            })),
          });
          const allowed: Record<string, string[]> = {
            QUARANTINED: ['AVAILABLE', 'BLOCKED', 'REJECTED'],
            AVAILABLE: ['BLOCKED', 'REJECTED'],
            BLOCKED: ['AVAILABLE', 'REJECTED'],
            REJECTED: [],
          };
          if (!allowed[current.qualityStatus].includes(change.status))
            throw new MongoInputError('La transición de estado no está permitida.');
          const eventDate = change.occurredAt.slice(0, 10);
          if (change.status === 'AVAILABLE' && current.expiresOn && current.expiresOn < eventDate)
            throw new MongoInputError('Un lote vencido no puede liberarse ni distribuirse.');
          const direction =
            current.qualityStatus === 'AVAILABLE' ? -1 : change.status === 'AVAILABLE' ? 1 : 0;
          if (direction)
            for (const [index, balance] of current.balances.entries()) {
              if (!balance.quantity) continue;
              await insertTraceMovement(c, actor, {
                id: `${change.id}:movement:${index}`,
                idempotencyKey: `${change.idempotencyKey}:movement:${index}`,
                itemId: current.itemId,
                warehouseId: balance.warehouseId,
                quantity: balance.quantity,
                delta: direction * balance.quantity,
                createdAt: change.occurredAt,
                reason: change.reason,
                reference: current.receiptReference,
                traceRecordId: current.id,
                traceNumber: current.number,
              });
            }
          const updated = inventoryTraceRecordSchema.parse({
            ...current,
            qualityStatus: change.status,
            updatedAt: change.occurredAt,
          });
          await c.query(
            `UPDATE analiza.inventory_trace_records
             SET quality_status=$3,body=$4::jsonb,updated_at=$5
             WHERE organization_id=$1 AND id=$2`,
            [
              actor.organizationId,
              updated.id,
              updated.qualityStatus,
              JSON.stringify({ ...updated, balances: [] }),
              updated.updatedAt,
            ],
          );
          await c.query(
            `INSERT INTO analiza.inventory_trace_events(
               organization_id,id,trace_record_id,event_type,idempotency_key,body,occurred_at
             ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
            [
              actor.organizationId,
              change.id,
              current.id,
              change.status === 'AVAILABLE' ? 'RELEASED' : change.status,
              change.idempotencyKey,
              JSON.stringify(change),
              change.occurredAt,
            ],
          );
          await audit(
            c,
            actor,
            `INVENTORY_TRACE_${change.status}`,
            'inventory_trace_records',
            current.id,
          );
          return updated;
        });
      }
      if (command.command === 'inventory.trace.issue') {
        authorize(actor, 'inventory:write');
        const { issue } = z
          .object({ command: z.literal('inventory.trace.issue'), issue: inventoryFefoIssueSchema })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          const previous = (
            await c.query<{ body: unknown }>(
              `SELECT body FROM analiza.inventory_trace_events
               WHERE organization_id=$1 AND idempotency_key=$2`,
              [actor.organizationId, issue.idempotencyKey],
            )
          ).rows[0];
          if (previous) {
            if (canonical(previous.body) !== canonical(issue)) throw new MongoConflictError();
            return { id: issue.id };
          }
          const warehouse = await c.query(
            `SELECT id FROM analiza.warehouses
             WHERE organization_id=$1 AND id=$2 AND status='ACTIVE'`,
            [actor.organizationId, issue.warehouseId],
          );
          if (!warehouse.rowCount) throw new MongoInputError('Seleccione una bodega activa.');
          const candidates = await c.query<{
            id: string;
            number_normalized: string;
            quantity: number;
          }>(
            `SELECT record.id,record.number_normalized,balance.quantity
             FROM analiza.inventory_trace_records record
             JOIN analiza.inventory_trace_balances balance
               ON balance.organization_id=record.organization_id
              AND balance.trace_record_id=record.id
             WHERE record.organization_id=$1 AND record.item_id=$2
               AND balance.warehouse_id=$3 AND balance.quantity>0
               AND record.quality_status='AVAILABLE'
               AND (record.expires_on IS NULL OR record.expires_on >= $4::date)
             ORDER BY record.expires_on ASC NULLS LAST,record.received_at,record.id
             FOR UPDATE OF record,balance`,
            [actor.organizationId, issue.itemId, issue.warehouseId, issue.occurredAt.slice(0, 10)],
          );
          const available = candidates.rows.reduce(
            (sum, candidate) => sum + Number(candidate.quantity),
            0,
          );
          if (available < issue.quantity)
            throw new MongoInputError(
              'No hay existencias liberadas y vigentes suficientes para esta salida FEFO.',
            );
          let remaining = issue.quantity;
          const allocations: Array<{ traceRecordId: string; number: string; quantity: number }> =
            [];
          for (const [index, candidate] of candidates.rows.entries()) {
            if (!remaining) break;
            const quantity = Math.min(remaining, Number(candidate.quantity));
            remaining -= quantity;
            await c.query(
              `UPDATE analiza.inventory_trace_balances
               SET quantity=quantity-$4,updated_at=$5
               WHERE organization_id=$1 AND trace_record_id=$2 AND warehouse_id=$3`,
              [actor.organizationId, candidate.id, issue.warehouseId, quantity, issue.occurredAt],
            );
            await insertTraceMovement(c, actor, {
              id: `${issue.id}:movement:${index}`,
              idempotencyKey: `${issue.idempotencyKey}:movement:${index}`,
              itemId: issue.itemId,
              warehouseId: issue.warehouseId,
              quantity,
              delta: -quantity,
              createdAt: issue.occurredAt,
              reason: issue.reason,
              reference: issue.reference,
              traceRecordId: candidate.id,
              traceNumber: candidate.number_normalized,
            });
            await c.query(
              `INSERT INTO analiza.inventory_trace_events(
                 organization_id,id,trace_record_id,event_type,idempotency_key,body,occurred_at
               ) VALUES($1,$2,$3,'ISSUED',$4,$5::jsonb,$6)`,
              [
                actor.organizationId,
                `${issue.id}:allocation:${index}`,
                candidate.id,
                `${issue.idempotencyKey}:allocation:${index}`,
                JSON.stringify({ ...issue, allocatedQuantity: quantity }),
                issue.occurredAt,
              ],
            );
            allocations.push({
              traceRecordId: candidate.id,
              number: candidate.number_normalized,
              quantity,
            });
          }
          await c.query(
            `INSERT INTO analiza.inventory_trace_events(
               organization_id,id,trace_record_id,event_type,idempotency_key,body,occurred_at
             ) VALUES($1,$2,NULL,'ISSUED',$3,$4::jsonb,$5)`,
            [
              actor.organizationId,
              issue.id,
              issue.idempotencyKey,
              JSON.stringify(issue),
              issue.occurredAt,
            ],
          );
          await audit(c, actor, 'INVENTORY_FEFO_ISSUED', 'inventory_trace_events', issue.id);
          return { id: issue.id, allocations };
        });
      }
      if (command.command === 'inventory.transfer') {
        authorize(actor, 'inventory:write');
        const { transfer } = z
          .object({ command: z.literal('inventory.transfer'), transfer: warehouseTransferSchema })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          const lockKeys = [
            `${actor.organizationId}:inventory-transfer:${transfer.idempotencyKey}`,
            `${actor.organizationId}:${transfer.itemId}:${transfer.sourceWarehouseId}`,
            `${actor.organizationId}:${transfer.itemId}:${transfer.destinationWarehouseId}`,
          ].sort();
          for (const key of lockKeys)
            await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
          const previous = (
            await c.query<{ body: unknown }>(
              `SELECT body FROM analiza.inventory_transfers
               WHERE organization_id=$1 AND idempotency_key=$2`,
              [actor.organizationId, transfer.idempotencyKey],
            )
          ).rows[0];
          if (previous) {
            if (canonical(previous.body) !== canonical(transfer)) throw new MongoConflictError();
            return warehouseTransferSchema.parse(previous.body);
          }
          const item = await c.query(
            `SELECT id FROM analiza.catalog_items
             WHERE organization_id=$1 AND id=$2 AND body->>'status'='ACTIVE'
               AND body->>'category'=ANY($3::text[])`,
            [actor.organizationId, transfer.itemId, ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT']],
          );
          if (!item.rowCount)
            throw new MongoInputError('Seleccione un artículo activo del inventario.');
          const warehouseRows = await c.query<{ id: string }>(
            `SELECT id FROM analiza.warehouses
             WHERE organization_id=$1 AND id=ANY($2::text[]) AND status='ACTIVE'`,
            [actor.organizationId, [transfer.sourceWarehouseId, transfer.destinationWarehouseId]],
          );
          if (warehouseRows.rowCount !== 2)
            throw new MongoInputError('Seleccione dos bodegas activas y distintas.');
          const sourceBalance = Number(
            (
              await c.query<{ balance: number }>(
                `SELECT coalesce(sum(delta),0) AS balance
                 FROM analiza.inventory_movements
                 WHERE organization_id=$1 AND item_id=$2 AND warehouse_id=$3`,
                [actor.organizationId, transfer.itemId, transfer.sourceWarehouseId],
              )
            ).rows[0]?.balance ?? 0,
          );
          const traceCandidates = await c.query<{
            id: string;
            number_normalized: string;
            quantity: number;
          }>(
            `SELECT record.id,record.number_normalized,balance.quantity
             FROM analiza.inventory_trace_records record
             JOIN analiza.inventory_trace_balances balance
               ON balance.organization_id=record.organization_id
              AND balance.trace_record_id=record.id
             WHERE record.organization_id=$1 AND record.item_id=$2
               AND balance.warehouse_id=$3 AND balance.quantity>0
               AND record.quality_status='AVAILABLE'
               AND (record.expires_on IS NULL OR record.expires_on >= $4::date)
             ORDER BY record.expires_on ASC NULLS LAST,record.received_at,record.id
             FOR UPDATE OF record,balance`,
            [
              actor.organizationId,
              transfer.itemId,
              transfer.sourceWarehouseId,
              transfer.occurredAt.slice(0, 10),
            ],
          );
          const unavailableTraceBalance = Number(
            (
              await c.query<{ quantity: number }>(
                `SELECT coalesce(sum(balance.quantity),0) AS quantity
                 FROM analiza.inventory_trace_records record
                 JOIN analiza.inventory_trace_balances balance
                   ON balance.organization_id=record.organization_id
                  AND balance.trace_record_id=record.id
                 WHERE record.organization_id=$1 AND record.item_id=$2
                   AND balance.warehouse_id=$3 AND balance.quantity>0
                   AND record.quality_status='AVAILABLE'
                   AND record.expires_on < $4::date`,
                [
                  actor.organizationId,
                  transfer.itemId,
                  transfer.sourceWarehouseId,
                  transfer.occurredAt.slice(0, 10),
                ],
              )
            ).rows[0]?.quantity ?? 0,
          );
          if (sourceBalance - unavailableTraceBalance < transfer.quantity)
            throw new MongoInputError('La bodega de origen no tiene existencias suficientes.');
          await c.query(
            `INSERT INTO analiza.inventory_transfers(
               organization_id,id,item_id,source_warehouse_id,destination_warehouse_id,
               idempotency_key,quantity,body,created_at
             ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
            [
              actor.organizationId,
              transfer.id,
              transfer.itemId,
              transfer.sourceWarehouseId,
              transfer.destinationWarehouseId,
              transfer.idempotencyKey,
              transfer.quantity,
              JSON.stringify(transfer),
              transfer.occurredAt,
            ],
          );
          let remaining = transfer.quantity;
          for (const [index, candidate] of traceCandidates.rows.entries()) {
            if (!remaining) break;
            const quantity = Math.min(remaining, Number(candidate.quantity));
            remaining -= quantity;
            await c.query(
              `UPDATE analiza.inventory_trace_balances
               SET quantity=quantity-$4,updated_at=$5
               WHERE organization_id=$1 AND trace_record_id=$2 AND warehouse_id=$3`,
              [
                actor.organizationId,
                candidate.id,
                transfer.sourceWarehouseId,
                quantity,
                transfer.occurredAt,
              ],
            );
            await c.query(
              `INSERT INTO analiza.inventory_trace_balances(
                 organization_id,trace_record_id,warehouse_id,quantity,updated_at
               ) VALUES($1,$2,$3,$4,$5)
               ON CONFLICT(organization_id,trace_record_id,warehouse_id)
               DO UPDATE SET quantity=analiza.inventory_trace_balances.quantity+EXCLUDED.quantity,
                             updated_at=EXCLUDED.updated_at`,
              [
                actor.organizationId,
                candidate.id,
                transfer.destinationWarehouseId,
                quantity,
                transfer.occurredAt,
              ],
            );
            for (const [warehouseId, direction, delta, counterpart] of [
              [transfer.sourceWarehouseId, 'OUT', -quantity, transfer.destinationWarehouseId],
              [transfer.destinationWarehouseId, 'IN', quantity, transfer.sourceWarehouseId],
            ] as const)
              await insertTraceMovement(c, actor, {
                id: `${transfer.id}:trace:${index}:${direction.toLowerCase()}`,
                idempotencyKey: `${transfer.idempotencyKey}:trace:${index}:${direction.toLowerCase()}`,
                itemId: transfer.itemId,
                warehouseId,
                quantity,
                delta,
                createdAt: transfer.occurredAt,
                reason: transfer.reason,
                reference: transfer.reference,
                traceRecordId: candidate.id,
                traceNumber: candidate.number_normalized,
                kind: 'TRANSFER',
                transferId: transfer.id,
                transferDirection: direction,
                counterpartWarehouseId: counterpart,
              });
            await c.query(
              `INSERT INTO analiza.inventory_trace_events(
                 organization_id,id,trace_record_id,event_type,idempotency_key,body,occurred_at
               ) VALUES($1,$2,$3,'TRANSFERRED',$4,$5::jsonb,$6)`,
              [
                actor.organizationId,
                `${transfer.id}:trace:${index}`,
                candidate.id,
                `${transfer.idempotencyKey}:trace:${index}`,
                JSON.stringify({ ...transfer, traceRecordId: candidate.id, quantity }),
                transfer.occurredAt,
              ],
            );
          }
          if (remaining) {
            const common = {
              itemId: transfer.itemId,
              createdAt: transfer.occurredAt,
              kind: 'TRANSFER' as const,
              quantity: remaining,
              reason: transfer.reason,
              reference: transfer.reference,
              user: actor.userId,
              transferId: transfer.id,
            };
            const outbound: InventoryMovement = inventoryMovementSchema.parse({
              ...common,
              id: `${transfer.id}:out`,
              warehouseId: transfer.sourceWarehouseId,
              transferDirection: 'OUT',
              counterpartWarehouseId: transfer.destinationWarehouseId,
            });
            const inbound: InventoryMovement = inventoryMovementSchema.parse({
              ...common,
              id: `${transfer.id}:in`,
              warehouseId: transfer.destinationWarehouseId,
              transferDirection: 'IN',
              counterpartWarehouseId: transfer.sourceWarehouseId,
            });
            for (const [movement, delta, suffix] of [
              [outbound, -remaining, 'out'],
              [inbound, remaining, 'in'],
            ] as const)
              await c.query(
                `INSERT INTO analiza.inventory_movements(
                   organization_id,id,item_id,warehouse_id,idempotency_key,delta,body,created_at
                 ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
                [
                  actor.organizationId,
                  movement.id,
                  movement.itemId,
                  movement.warehouseId,
                  `${transfer.idempotencyKey}:${suffix}`,
                  delta,
                  JSON.stringify(movement),
                  movement.createdAt,
                ],
              );
          }
          await audit(c, actor, 'INVENTORY_TRANSFER_RECORDED', 'inventory_transfers', transfer.id);
          return transfer;
        });
      }
      if (command.command === 'configuration.save') {
        authorize(actor, 'catalogs:write');
        const { entry } = z
          .object({ command: z.literal('configuration.save'), entry: configurationEntrySchema })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          if (entry.category === 'MEDICATION' && entry.inventoryItemId) {
            const item = await c.query(
              "SELECT id FROM analiza.catalog_items WHERE organization_id=$1 AND id=$2 AND body->>'status'='ACTIVE'",
              [actor.organizationId, entry.inventoryItemId],
            );
            if (!item.rowCount)
              throw new MongoInputError('Seleccione un artículo activo del inventario.');
          }
          await c.query(
            'INSERT INTO analiza.configuration_entries(organization_id,id,body) VALUES($1,$2,$3) ON CONFLICT(organization_id,id) DO UPDATE SET body=EXCLUDED.body',
            [actor.organizationId, entry.id, JSON.stringify(entry)],
          );
          await audit(c, actor, 'CONFIGURATION_SAVED', 'configuration', entry.id);
          return entry;
        });
      }
      if (command.command === 'catalog.save') {
        authorize(actor, 'catalogs:write');
        const { item } = z
          .object({ command: z.literal('catalog.save'), item: catalogItemSchema.strict() })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          const duplicate = await c.query(
            "SELECT id FROM analiza.catalog_items WHERE organization_id=$1 AND upper(body->>'sku')=upper($2) AND id<>$3",
            [actor.organizationId, item.sku, item.id],
          );
          if (duplicate.rowCount) throw new MongoConflictError();
          await c.query(
            'INSERT INTO analiza.catalog_items(organization_id,id,body) VALUES($1,$2,$3) ON CONFLICT(organization_id,id) DO UPDATE SET body=EXCLUDED.body',
            [actor.organizationId, item.id, JSON.stringify(item)],
          );
          await audit(c, actor, 'CATALOG_ITEM_SAVED', 'catalog_items', item.id);
          return item;
        });
      }
      if (command.command === 'purchase.create' || command.command === 'purchase.update') {
        authorize(actor, 'purchases:write');
        const { purchase } = z
          .object({
            command: z.enum(['purchase.create', 'purchase.update']),
            purchase: purchaseSchema.strict(),
          })
          .strict()
          .parse(input);
        if (
          purchase.status !== 'DRAFT' ||
          purchase.receivedAt ||
          purchase.traceRecordId ||
          purchase.cancelledAt ||
          purchase.cancelReason
        )
          throw new MongoInputError('Sólo se puede guardar un borrador sin recepción.');
        return transaction(pool, actor, async (c) => {
          const previous =
            command.command === 'purchase.update'
              ? await c.query<{ body: unknown }>(
                  'SELECT body FROM analiza.purchases WHERE organization_id=$1 AND id=$2 FOR UPDATE',
                  [actor.organizationId, purchase.id],
                )
              : null;
          const oldPurchase = previous?.rows[0]
            ? purchaseSchema.parse(previous.rows[0].body)
            : null;
          if (command.command === 'purchase.update' && oldPurchase?.status !== 'DRAFT')
            throw new MongoConflictError();
          const item = await c.query<{ category: string | null }>(
            "SELECT body->>'category' AS category FROM analiza.catalog_items WHERE organization_id=$1 AND id=$2 AND body->>'status'='ACTIVE'",
            [actor.organizationId, purchase.catalogItemId],
          );
          const category = item.rows[0]?.category;
          if (!item.rowCount || !['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(category ?? ''))
            throw new MongoInputError('Seleccione un medicamento, insumo o equipo activo.');
          const supplier = await c.query(
            "SELECT id FROM analiza.catalog_items WHERE organization_id=$1 AND id=$2 AND body->>'status'='ACTIVE' AND body->>'category'='PROVIDERS'",
            [actor.organizationId, purchase.supplierCatalogItemId],
          );
          if (!supplier.rowCount) throw new MongoInputError('Seleccione un proveedor activo.');
          if (!purchase.warehouseId) throw new MongoInputError('Seleccione una bodega de destino.');
          const warehouse = await c.query(
            `SELECT id FROM analiza.warehouses
             WHERE organization_id=$1 AND id=$2 AND status='ACTIVE'`,
            [actor.organizationId, purchase.warehouseId],
          );
          if (!warehouse.rowCount) throw new MongoInputError('Seleccione una bodega activa.');
          if (
            ['MEDICATIONS', 'SUPPLIES'].includes(category ?? '') &&
            (!purchase.expirationDate || !purchase.lotNumber)
          )
            throw new MongoInputError('Indique fecha de vencimiento y lote.');
          if (category === 'EQUIPMENT' && !purchase.serialNumber)
            throw new MongoInputError('Indique el número de serie del equipo.');
          if (
            !Number.isInteger(purchase.quantity) ||
            !purchase.quantity ||
            purchase.quantity < 1 ||
            (category === 'EQUIPMENT' && purchase.quantity !== 1)
          )
            throw new MongoInputError(
              'La cantidad debe ser un entero positivo; cada equipo usa una serie.',
            );
          const normalizedPurchase = normalizePurchaseTraceability(
            { ...purchase, createdAt: oldPurchase?.createdAt ?? purchase.createdAt },
            category ?? undefined,
          );
          if (command.command === 'purchase.create') {
            await c.query(
              `INSERT INTO analiza.purchases(organization_id,id,warehouse_id,body)
               VALUES($1,$2,$3,$4::jsonb)`,
              [
                actor.organizationId,
                purchase.id,
                purchase.warehouseId,
                JSON.stringify(normalizedPurchase),
              ],
            );
          } else {
            await c.query(
              'UPDATE analiza.purchases SET warehouse_id=$3,body=$4::jsonb WHERE organization_id=$1 AND id=$2',
              [
                actor.organizationId,
                purchase.id,
                purchase.warehouseId,
                JSON.stringify(normalizedPurchase),
              ],
            );
          }
          await audit(
            c,
            actor,
            command.command === 'purchase.create'
              ? 'PURCHASE_DRAFT_CREATED'
              : 'PURCHASE_DRAFT_UPDATED',
            'purchase',
            purchase.id,
          );
          return normalizedPurchase;
        });
      }
      if (command.command === 'purchase.cancel') {
        authorize(actor, 'purchases:write');
        const { purchaseId, reason } = z
          .object({
            command: z.literal('purchase.cancel'),
            purchaseId: z.string().trim().min(1).max(120),
            reason: z.string().trim().min(1).max(1000),
          })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          const previous = await c.query<{ body: unknown }>(
            'SELECT body FROM analiza.purchases WHERE organization_id=$1 AND id=$2 FOR UPDATE',
            [actor.organizationId, purchaseId],
          );
          if (!previous.rows[0]) throw new MongoAccessError();
          const purchase = purchaseSchema.parse(previous.rows[0].body);
          if (purchase.status !== 'DRAFT') throw new MongoConflictError();
          const cancelled = {
            ...purchase,
            status: 'CANCELLED' as const,
            cancelledAt: new Date().toISOString(),
            cancelReason: reason,
          };
          await c.query(
            'UPDATE analiza.purchases SET body=$3::jsonb WHERE organization_id=$1 AND id=$2',
            [actor.organizationId, purchaseId, JSON.stringify(cancelled)],
          );
          await audit(c, actor, 'PURCHASE_DRAFT_CANCELLED', 'purchase', purchaseId);
          return cancelled;
        });
      }
      if (command.command === 'inventory.record') {
        authorize(actor, 'inventory:write');
        const parsed = z
          .object({
            command: z.literal('inventory.record'),
            movement: inventoryMovementSchema.strict(),
            idempotencyKey: z.string().trim().min(1).max(120),
          })
          .strict()
          .parse(input);
        if (parsed.movement.kind === 'TRANSFER')
          throw new MongoInputError(
            'Un traslado necesita bodega de origen y destino. Regístrelo cuando estén definidas ambas.',
          );
        if (parsed.movement.kind === 'ADJUSTMENT' && !parsed.movement.adjustmentDirection)
          throw new MongoInputError('Indique la dirección del ajuste.');
        const warehouseId = parsed.movement.warehouseId ?? 'central';
        const movement = inventoryMovementSchema.parse({
          ...parsed.movement,
          warehouseId,
          user: actor.userId,
        });
        const delta =
          (movement.kind === 'EXIT' ||
          (movement.kind === 'ADJUSTMENT' && movement.adjustmentDirection === 'OUT')
            ? -1
            : 1) * movement.quantity;
        return transaction(pool, actor, async (c) => {
          await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `${actor.organizationId}:${movement.itemId}:${warehouseId}`,
          ]);
          const previous = (
            await c.query<{ id: string; same: boolean }>(
              `SELECT id,body=$3::jsonb AS same
               FROM analiza.inventory_movements
               WHERE organization_id=$1 AND idempotency_key=$2`,
              [actor.organizationId, parsed.idempotencyKey, JSON.stringify(movement)],
            )
          ).rows[0];
          if (previous) {
            if (!previous.same) throw new MongoConflictError();
            return { id: previous.id };
          }
          const item = await c.query(
            `SELECT id FROM analiza.catalog_items
             WHERE organization_id=$1 AND id=$2 AND body->>'status'='ACTIVE'
               AND body->>'category'=ANY($3::text[])`,
            [actor.organizationId, movement.itemId, ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT']],
          );
          if (!item.rowCount)
            throw new MongoInputError('Seleccione un artículo activo del inventario.');
          const warehouse = await c.query(
            `SELECT id FROM analiza.warehouses
             WHERE organization_id=$1 AND id=$2 AND status='ACTIVE'`,
            [actor.organizationId, warehouseId],
          );
          if (!warehouse.rowCount) throw new MongoInputError('Seleccione una bodega activa.');
          const traced = await c.query(
            `SELECT 1 FROM analiza.inventory_trace_records
             WHERE organization_id=$1 AND item_id=$2 LIMIT 1`,
            [actor.organizationId, movement.itemId],
          );
          if (traced.rowCount)
            throw new MongoInputError(
              'Este artículo usa trazabilidad. Registre recepciones o salidas desde Lotes y series.',
            );
          const balance = Number(
            (
              await c.query<{ balance: number }>(
                `SELECT coalesce(sum(delta),0) AS balance
                 FROM analiza.inventory_movements
                 WHERE organization_id=$1 AND item_id=$2 AND warehouse_id=$3`,
                [actor.organizationId, movement.itemId, warehouseId],
              )
            ).rows[0]?.balance ?? 0,
          );
          if (balance + delta < 0)
            throw new MongoInputError(
              'El movimiento dejaría un saldo negativo. Registre primero una entrada auditada.',
            );
          try {
            await c.query(
              `INSERT INTO analiza.inventory_movements(
                 organization_id,id,item_id,warehouse_id,idempotency_key,delta,body,created_at
               ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
              [
                actor.organizationId,
                movement.id,
                movement.itemId,
                warehouseId,
                parsed.idempotencyKey,
                delta,
                JSON.stringify(movement),
                movement.createdAt,
              ],
            );
          } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
              throw new MongoConflictError();
            throw error;
          }
          await audit(c, actor, 'INVENTORY_MOVEMENT_RECORDED', 'inventory_movements', movement.id);
          return { id: movement.id };
        });
      }
      if (command.command === 'payment.apply') {
        authorize(actor, 'payments:write');
        const { payment } = z
          .object({ command: z.literal('payment.apply'), payment: paymentSchema.strict() })
          .strict()
          .parse(input);
        if (payment.status !== 'APPLIED' || payment.voidReason)
          throw new MongoInputError('El alta de pago debe iniciar aplicada.');
        return transaction(pool, actor, async (c) => {
          const quote = (
            await c.query<{ body: Quote; root_quote_id: string }>(
              `SELECT body,root_quote_id FROM analiza.quotes
               WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
              [actor.organizationId, payment.quoteId],
            )
          ).rows[0];
          if (!quote || quote.body.status !== 'SENT' || !quote.body.immutable)
            throw new MongoInputError('Seleccione una cotización enviada e inmutable.');
          await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `${actor.organizationId}:payment:${quote.root_quote_id}`,
          ]);
          const existing = (
            await c.query<{ body: Payment }>(
              'SELECT body FROM analiza.payments WHERE organization_id=$1 AND idempotency_key=$2',
              [actor.organizationId, payment.idempotencyKey],
            )
          ).rows[0];
          if (existing) {
            if (canonical(existing.body) !== canonical(payment)) throw new MongoConflictError();
            return paymentSchema.parse(existing.body);
          }
          const latestQuote = (
            await c.query<{ body: Quote }>(
              `SELECT body FROM analiza.quotes
               WHERE organization_id=$1 AND root_quote_id=$2
                 AND body->>'status'='SENT' AND body->>'immutable'='true'
               ORDER BY quote_version DESC LIMIT 1 FOR UPDATE`,
              [actor.organizationId, quote.root_quote_id],
            )
          ).rows[0];
          if (!latestQuote || latestQuote.body.id !== payment.quoteId)
            throw new MongoInputError('Aplique el pago sobre la última versión enviada.');
          const paidCents = Number(
            (
              await c.query<{ paid: string }>(
                `SELECT coalesce(sum(p.amount_cents),0)::text AS paid
                 FROM analiza.payments p
                 JOIN analiza.quotes q ON q.organization_id=p.organization_id AND q.id=p.quote_id
                 WHERE p.organization_id=$1 AND q.root_quote_id=$2 AND p.status='APPLIED'`,
                [actor.organizationId, quote.root_quote_id],
              )
            ).rows[0]?.paid ?? 0,
          );
          const amountCents = Math.round(payment.amount * 100);
          const responsibilityCents = Math.round(latestQuote.body.patientAmount * 100);
          if (paidCents + amountCents > responsibilityCents)
            throw new MongoInputError('El pago supera el saldo pendiente de la cotización.');
          try {
            await c.query(
              `INSERT INTO analiza.payments(
                 organization_id,id,quote_id,idempotency_key,status,amount_cents,body,created_at
               ) VALUES($1,$2,$3,$4,'APPLIED',$5,$6::jsonb,$7)`,
              [
                actor.organizationId,
                payment.id,
                payment.quoteId,
                payment.idempotencyKey,
                amountCents,
                JSON.stringify(payment),
                payment.createdAt,
              ],
            );
          } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
              throw new MongoConflictError();
            throw error;
          }
          await audit(c, actor, 'PAYMENT_APPLIED', 'payments', payment.id);
          return payment;
        });
      }
      if (command.command === 'payment.void') {
        authorize(actor, 'payments:write');
        const parsed = z
          .object({
            command: z.literal('payment.void'),
            paymentId: z.string().trim().min(1),
            reason: z.string().trim().min(1).max(1000),
          })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          const current = (
            await c.query<{ body: Payment; status: Payment['status'] }>(
              `SELECT body,status FROM analiza.payments
               WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
              [actor.organizationId, parsed.paymentId],
            )
          ).rows[0];
          if (!current) throw new MongoAccessError();
          if (current.status === 'VOIDED') {
            if (current.body.voidReason !== parsed.reason) throw new MongoConflictError();
            return current.body;
          }
          const payment = paymentSchema.parse({
            ...current.body,
            status: 'VOIDED',
            voidReason: parsed.reason,
          });
          await c.query(
            `UPDATE analiza.payments
             SET status='VOIDED',body=$3::jsonb,updated_at=now()
             WHERE organization_id=$1 AND id=$2`,
            [actor.organizationId, parsed.paymentId, JSON.stringify(payment)],
          );
          await audit(c, actor, 'PAYMENT_VOIDED', 'payments', parsed.paymentId);
          return payment;
        });
      }
      if (command.command === 'visit.create') {
        authorize(actor, 'reports:read');
        const { visit: inputVisit } = z
          .object({ command: z.literal('visit.create'), visit: visitInputSchema })
          .strict()
          .parse(input);
        if (
          inputVisit.professionalUserId !== actor.userId &&
          !can(actor.role, 'nurses:manage') &&
          !can(actor.role, 'payments:write')
        )
          throw new MongoAccessError();
        return transaction(pool, actor, async (c) => {
          const previous = (
            await c.query<{ body: Record<string, unknown> }>(
              'SELECT body FROM analiza.home_visits WHERE organization_id=$1 AND idempotency_key=$2',
              [actor.organizationId, inputVisit.idempotencyKey],
            )
          ).rows[0];
          if (previous) {
            const storedInput = { ...previous.body };
            delete storedInput.id;
            delete storedInput.createdBy;
            if (canonical(storedInput) !== canonical(inputVisit)) throw new MongoConflictError();
            return visitSchema.parse(previous.body);
          }
          const professional = (
            await c.query<{ display_name: string; role: string }>(
              `SELECT u.display_name,m.role FROM analiza.memberships m
               JOIN analiza.users u ON u.id=m.user_id
               WHERE m.organization_id=$1 AND m.user_id=$2 AND m.active
                 AND m.role IN ('ADMIN','WEBMASTER','NURSE','NURSE_MANAGER','DOCTOR')`,
              [actor.organizationId, inputVisit.professionalUserId],
            )
          ).rows[0];
          if (!professional) throw new MongoInputError('Seleccione un profesional activo.');
          const patient = await c.query(
            'SELECT id FROM analiza.patients WHERE organization_id=$1 AND id=$2',
            [actor.organizationId, inputVisit.patientId],
          );
          if (!patient.rowCount) throw new MongoInputError('Seleccione un paciente disponible.');
          const profession = professional.role === 'DOCTOR' ? 'DOCTOR' : 'NURSE';
          if (inputVisit.profession !== profession)
            throw new MongoInputError('La profesión no coincide con la cuenta seleccionada.');
          const visit = visitSchema.parse({
            ...inputVisit,
            id: randomUUID(),
            professionalName: professional.display_name,
            createdBy: actor.userId,
          });
          await c.query(
            `INSERT INTO analiza.home_visits(
               organization_id,id,professional_user_id,patient_id,idempotency_key,body,created_at
             ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
            [
              actor.organizationId,
              visit.id,
              visit.professionalUserId,
              visit.patientId,
              visit.idempotencyKey,
              JSON.stringify(visit),
              visit.occurredAt,
            ],
          );
          await audit(c, actor, 'HOME_VISIT_CREATED', 'home_visits', visit.id);
          return visit;
        });
      }
      if (command.command === 'goal.save') {
        if (!can(actor.role, 'nurses:manage') && !can(actor.role, 'payments:write'))
          throw new MongoAccessError();
        const { goal: inputGoal } = z
          .object({ command: z.literal('goal.save'), goal: goalInputSchema })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          const professional = (
            await c.query<{ display_name: string }>(
              `SELECT u.display_name FROM analiza.memberships m
               JOIN analiza.users u ON u.id=m.user_id
               WHERE m.organization_id=$1 AND m.user_id=$2 AND m.active
                 AND m.role IN ('ADMIN','WEBMASTER','NURSE','NURSE_MANAGER','DOCTOR')`,
              [actor.organizationId, inputGoal.professionalUserId],
            )
          ).rows[0];
          if (!professional) throw new MongoInputError('Seleccione un profesional activo.');
          const existing = (
            await c.query<{ id: string }>(
              'SELECT id FROM analiza.visit_goals WHERE organization_id=$1 AND professional_user_id=$2 AND month=$3',
              [actor.organizationId, inputGoal.professionalUserId, inputGoal.month],
            )
          ).rows[0];
          const goal = goalSchema.parse({
            ...inputGoal,
            professionalName: professional.display_name,
            id: existing?.id ?? randomUUID(),
          });
          await c.query(
            `INSERT INTO analiza.visit_goals(
               organization_id,id,professional_user_id,month,body
             ) VALUES($1,$2,$3,$4,$5::jsonb)
             ON CONFLICT(organization_id,professional_user_id,month)
             DO UPDATE SET body=EXCLUDED.body,updated_at=now()`,
            [
              actor.organizationId,
              goal.id,
              goal.professionalUserId,
              goal.month,
              JSON.stringify(goal),
            ],
          );
          await audit(c, actor, 'VISIT_GOAL_SAVED', 'visit_goals', goal.id);
          return goal;
        });
      }
      if (command.command === 'clinical.create') {
        authorize(actor, 'clinical:write');
        const { document } = z
          .object({
            command: z.literal('clinical.create'),
            document: clinicalDocumentSchema.strict(),
          })
          .strict()
          .parse(input);
        if (
          document.status !== 'DRAFT' ||
          document.version !== 1 ||
          document.signedAt ||
          document.correctionOf ||
          document.correctionReason
        )
          throw new MongoInputError('Un documento nuevo debe iniciar como borrador versión 1.');
        return transaction(pool, actor, async (c) => {
          const hospitalization = await c.query(
            `SELECT id FROM analiza.hospitalizations
             WHERE organization_id=$1 AND id=$2 AND patient_id=$3
               AND body->>'status'<>'CLOSED'`,
            [actor.organizationId, document.caseId, document.patientId],
          );
          if (!hospitalization.rowCount)
            throw new MongoInputError(
              'Seleccione una hospitalización activa de esta organización.',
            );
          try {
            await c.query(
              `INSERT INTO analiza.clinical_documents(
                 organization_id,id,case_id,patient_id,root_document_id,
                 document_version,status,body,created_by,created_at
               ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
              [
                actor.organizationId,
                document.id,
                document.caseId,
                document.patientId,
                document.id,
                document.version,
                document.status,
                JSON.stringify(document),
                actor.userId,
                document.createdAt,
              ],
            );
          } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
              throw new MongoConflictError();
            throw error;
          }
          await audit(c, actor, 'CLINICAL_DOCUMENT_CREATED', 'clinical_documents', document.id);
          return { id: document.id };
        });
      }
      if (command.command === 'clinical.sign') {
        authorize(actor, 'clinical:sign');
        const { documentId } = z
          .object({ command: z.literal('clinical.sign'), documentId: z.string().min(1) })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          const current = await c.query<{ status: ClinicalDocument['status'] }>(
            `SELECT status FROM analiza.clinical_documents
             WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
            [actor.organizationId, documentId],
          );
          if (!current.rowCount) throw new MongoAccessError();
          if (current.rows[0]?.status === 'SIGNED') return { id: documentId };
          const signedAt = new Date().toISOString();
          const updated = await c.query(
            `UPDATE analiza.clinical_documents
             SET status='SIGNED',signed_by=$3,signed_at=$4
             WHERE organization_id=$1 AND id=$2 AND status='DRAFT'`,
            [actor.organizationId, documentId, actor.userId, signedAt],
          );
          if (updated.rowCount !== 1) throw new MongoConflictError();
          await audit(c, actor, 'CLINICAL_DOCUMENT_SIGNED', 'clinical_documents', documentId);
          return { id: documentId };
        });
      }
      if (command.command === 'clinical.correct') {
        authorize(actor, 'clinical:sign');
        const parsed = z
          .object({
            command: z.literal('clinical.correct'),
            documentId: z.string().min(1),
            correctionId: z.string().min(1),
            reason: z.string().trim().min(1),
            summary: z.string().trim().min(1),
            author: z.string().trim().min(1),
          })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          const original = (
            await c.query<{
              body: ClinicalDocument;
              root_document_id: string;
            }>(
              `SELECT body,root_document_id FROM analiza.clinical_documents
               WHERE organization_id=$1 AND id=$2 AND status='SIGNED' FOR UPDATE`,
              [actor.organizationId, parsed.documentId],
            )
          ).rows[0];
          if (!original) throw new MongoAccessError();
          const nextVersion = Number(
            (
              await c.query<{ next_version: number }>(
                `SELECT coalesce(max(document_version),0)+1 AS next_version
                 FROM analiza.clinical_documents
                 WHERE organization_id=$1 AND root_document_id=$2`,
                [actor.organizationId, original.root_document_id],
              )
            ).rows[0]?.next_version ?? 2,
          );
          const createdAt = new Date().toISOString();
          const correction = clinicalDocumentSchema.parse({
            ...original.body,
            id: parsed.correctionId,
            summary: parsed.summary,
            author: parsed.author,
            status: 'DRAFT',
            version: nextVersion,
            createdAt,
            signedAt: undefined,
            correctionOf: parsed.documentId,
            correctionReason: parsed.reason,
          });
          try {
            await c.query(
              `INSERT INTO analiza.clinical_documents(
                 organization_id,id,case_id,patient_id,root_document_id,
                 document_version,status,body,created_by,created_at
               ) VALUES($1,$2,$3,$4,$5,$6,'DRAFT',$7::jsonb,$8,$9)`,
              [
                actor.organizationId,
                correction.id,
                correction.caseId,
                correction.patientId,
                original.root_document_id,
                correction.version,
                JSON.stringify(correction),
                actor.userId,
                correction.createdAt,
              ],
            );
          } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
              throw new MongoConflictError();
            throw error;
          }
          await audit(c, actor, 'CLINICAL_DOCUMENT_CORRECTED', 'clinical_documents', correction.id);
          return { id: correction.id };
        });
      }
      if (command.command === 'nurse.create') {
        authorize(actor, 'nurses:manage');
        const data = z
          .object({
            command: z.literal('nurse.create'),
            email: z.email(),
            password: z.string().min(12).max(1024),
            role: z.enum(['ADMIN', 'MANAGER', 'NURSE_MANAGER', 'NURSE']).default('NURSE'),
            resource: nursingResourceSchema.omit({ userId: true }).strict(),
          })
          .strict()
          .parse(input);
        if (['ADMIN', 'MANAGER'].includes(data.role) && !isAdministrator(actor.role))
          throw new MongoAccessError();
        const id = randomUUID(),
          hash = await hashPassword(data.password);
        const resource: NursingResource = { ...data.resource, userId: id };
        try {
          return await transaction(pool, actor, async (c) => {
            await c.query(
              'INSERT INTO analiza.users(id,email_normalized,password_hash,display_name) VALUES($1,$2,$3,$4)',
              [id, data.email.trim().toLowerCase(), hash, resource.displayName],
            );
            await c.query(
              'INSERT INTO analiza.memberships(user_id,organization_id,role) VALUES($1,$2,$3)',
              [id, actor.organizationId, data.role],
            );
            await c.query(
              'INSERT INTO analiza.nursing_resources(organization_id,id,user_id,body) VALUES($1,$2,$3,$4)',
              [actor.organizationId, resource.id, id, JSON.stringify(resource)],
            );
            await audit(c, actor, 'USER_CREATED', 'nursing_resources', resource.id);
            return { id, resource };
          });
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
            throw new MongoInputError('No fue posible crear la cuenta.');
          throw error;
        }
      }
      if (command.command === 'workspace.seed-demo') {
        authorize(actor, 'patients:write');
        authorize(actor, 'cases:write');
        return transaction(pool, actor, async (c) => {
          const account = (
            await c.query(
              `SELECT u.display_name,m.role FROM analiza.users u
               JOIN analiza.memberships m ON m.user_id=u.id
               WHERE u.id=$1 AND m.organization_id=$2 AND m.active`,
              [actor.userId, actor.organizationId],
            )
          ).rows[0];
          if (!account || !['ADMIN', 'WEBMASTER', 'NURSE', 'NURSE_MANAGER'].includes(account.role))
            throw new MongoAccessError();

          const resource: NursingResource = nursingResourceSchema.parse({
            id: `demo-resource-${actor.userId}`,
            userId: actor.userId,
            displayName: `${account.display_name} · recurso de prueba`,
            territory: 'Zona de demostración',
            shift: 'MORNING',
            availability: 'AVAILABLE',
            capacity: 3,
            boardRegistrationNumber: 'DEMO-001',
          });
          const resourceInsert = await c.query(
            `INSERT INTO analiza.nursing_resources(organization_id,id,user_id,body)
             VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING`,
            [actor.organizationId, resource.id, actor.userId, JSON.stringify(resource)],
          );

          const samples: Patient[] = [
            {
              id: 'patient-demo-001',
              fullName: 'Paciente de prueba Aurora',
              documentType: 'OTHER',
              documentId: 'DEMO-001',
              phone: '7000-0001',
              insurer: 'Particular',
              status: 'ACTIVE',
            },
            {
              id: 'patient-demo-002',
              fullName: 'Paciente de prueba Brisa',
              documentType: 'OTHER',
              documentId: 'DEMO-002',
              phone: '7000-0002',
              insurer: 'Aseguradora de demostración',
              status: 'ACTIVE',
            },
            {
              id: 'patient-demo-003',
              fullName: 'Paciente de prueba Celeste',
              documentType: 'OTHER',
              documentId: 'DEMO-003',
              phone: '7000-0003',
              status: 'ACTIVE',
            },
          ].map((patient) => patientSchema.parse(patient));
          let patientsCreated = 0;
          for (const patient of samples) {
            const inserted = await c.query(
              `INSERT INTO analiza.patients(organization_id,id,body,document_key)
               VALUES($1,$2,$3::jsonb,$4) ON CONFLICT DO NOTHING`,
              [
                actor.organizationId,
                patient.id,
                JSON.stringify(patient),
                patient.documentId.replace(/\s/g, '').toUpperCase(),
              ],
            );
            patientsCreated += inserted.rowCount ?? 0;
          }

          const today = new Date().toISOString().slice(0, 10);
          const hospitalization: Hospitalization = hospitalizationSchema.parse({
            id: 'case-demo-001',
            patientId: samples[0].id,
            startDate: today,
            admissionPeriods: [{ admissionDate: today }],
            status: 'ACTIVE',
            accountType: 'PARTICULAR',
            priority: 'MEDIUM',
            diagnosisSummary: 'Caso creado exclusivamente para conocer el flujo del sistema.',
            nextAction: 'Revisar la cotización de prueba.',
            assignedNursingResourceIds: [resource.id],
            assignedNurseUserIds: [actor.userId],
          });
          const hospitalizationInsert = await c.query(
            `INSERT INTO analiza.hospitalizations(organization_id,id,body,patient_id)
             VALUES($1,$2,$3::jsonb,$4) ON CONFLICT DO NOTHING`,
            [
              actor.organizationId,
              hospitalization.id,
              JSON.stringify(hospitalization),
              hospitalization.patientId,
            ],
          );
          await c.query(
            `INSERT INTO analiza.hospitalization_nurses(organization_id,hospitalization_id,resource_id)
             VALUES($1,$2,$3) ON CONFLICT(organization_id,hospitalization_id,resource_id)
             DO UPDATE SET active=true`,
            [actor.organizationId, hospitalization.id, resource.id],
          );

          const tomorrow = new Date();
          tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
          tomorrow.setUTCHours(8, 0, 0, 0);
          const end = new Date(tomorrow);
          end.setUTCHours(14, 0, 0, 0);
          const shift: Shift = shiftSchema.parse({
            id: 'shift-demo-001',
            resourceId: resource.id,
            patientId: samples[0].id,
            startsAt: tomorrow.toISOString(),
            endsAt: end.toISOString(),
            status: 'SCHEDULED',
            note: 'Turno creado con el botón Datos de prueba.',
          });
          const shiftInsert = await c.query(
            `INSERT INTO analiza.shifts(organization_id,id,resource_id,patient_id,starts_at,ends_at,status,body)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT DO NOTHING`,
            [
              actor.organizationId,
              shift.id,
              shift.resourceId,
              shift.patientId,
              shift.startsAt,
              shift.endsAt,
              shift.status,
              JSON.stringify(shift),
            ],
          );

          let quoteCreated = 0;
          if (can(actor.role, 'quotes:write')) {
            const quote: Quote = {
              id: 'quote-demo-001',
              caseId: hospitalization.id,
              patientId: samples[0].id,
              version: 1,
              status: 'DRAFT',
              summary: 'Cotización de prueba para conocer el flujo.',
              comments: 'Los importes son únicamente un ejemplo editable.',
              items: [
                {
                  id: 'quote-item-demo-001',
                  category: 'SERVICES',
                  name: 'Servicio de atención de prueba',
                  quantity: 1,
                  unitPrice: 100,
                  discountAmount: 0,
                },
              ],
              subtotal: 100,
              discountAmount: 0,
              total: 100,
              insurerAmount: 0,
              patientAmount: 100,
              immutable: false,
              createdAt: new Date().toISOString(),
              rootQuoteId: 'quote-demo-001',
              originalQuoteId: 'quote-demo-001',
            };
            const quoteInsert = await c.query(
              `INSERT INTO analiza.quotes(organization_id,id,case_id,patient_id,root_quote_id,quote_version,body)
               VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT DO NOTHING`,
              [
                actor.organizationId,
                quote.id,
                quote.caseId,
                quote.patientId,
                quote.rootQuoteId,
                quote.version,
                JSON.stringify(quote),
              ],
            );
            quoteCreated = quoteInsert.rowCount ?? 0;
          }

          await audit(c, actor, 'DEMO_WORKSPACE_SEEDED', 'workspace', actor.organizationId);
          return {
            patientsCreated,
            resourceCreated: resourceInsert.rowCount ?? 0,
            hospitalizationCreated: hospitalizationInsert.rowCount ?? 0,
            shiftCreated: shiftInsert.rowCount ?? 0,
            quoteCreated,
          };
        });
      }
      throw new MongoInputError('Operación no disponible en esta edición.');
    },
  };
  return {
    loginAnalytics: new PostgresLoginAnalyticsRepository(pool),
    auth: new AuthService(postgresAuthStore(pool)),
    informationImports: new PostgresInformationImportRepository(pool),
    onboarding: new PostgresWorkspaceSetupRepository(pool),
    nurseProfile: new PostgresNurseProfileRepository(pool),
    feedback: new PostgresFeedbackRepository(pool),
    patients,
    doctors,
    hospitalizations,
    quotes,
    shifts,
    operations,
    files: postgresFiles(pool),
    async ready() {
      const result = await pool.query(
        "SELECT current_setting('server_version_num')::int AS version,(SELECT count(*) FROM analiza.schema_migrations WHERE version IN ('001_core.sql','002_workspace_registration.sql','003_nurse_profiles.sql','004_feedback_reports.sql','005_all_memberships_admin.sql','006_single_designated_admin.sql','007_expand_feedback_options.sql','008_quotes.sql','009_information_imports.sql','010_manager_role.sql','011_service_catalogs.sql','012_insurers_and_nurse_files.sql','013_feedback_resolutions_and_purchases.sql','014_clinical_documents.sql','015_inventory_movements.sql','016_payments_visits_goals.sql','017_warehouses_and_transfers.sql','018_inventory_traceability.sql','019_purchase_destination_warehouse.sql','020_login_analytics.sql','021_quotes_without_hospitalization.sql'))::int AS migrations, r.rolsuper OR r.rolbypassrls AS privileged FROM pg_roles r WHERE r.rolname=current_user",
      );
      const row = result.rows[0];
      if (
        !row ||
        row.version < 160000 ||
        row.version >= 200000 ||
        row.migrations !== 21 ||
        row.privileged
      )
        throw new Error('Esquema o identidad PostgreSQL no disponible.');
    },
    async workspace(actor) {
      const [
        p,
        d,
        h,
        s,
        r,
        q,
        clinicalDocuments,
        inventoryMovements,
        catalogs,
        purchases,
        payments,
        audits,
      ] = await Promise.all([
        can(actor.role, 'patients:read') ? patients.listWithVersions(actor) : [],
        can(actor.role, 'settings:write') ? doctors.listWithVersions(actor) : [],
        can(actor.role, 'cases:read') ? hospitalizations.listWithVersions(actor) : [],
        can(actor.role, 'agenda:read') ? shifts.list(actor) : [],
        can(actor.role, 'agenda:read') ? shifts.listResources(actor) : [],
        can(actor.role, 'quotes:read') ? quotes.listWithVersions(actor) : [],
        can(actor.role, 'clinical:read')
          ? transaction(pool, actor, async (c) =>
              (
                await c.query<{
                  body: Record<string, unknown>;
                  status: ClinicalDocument['status'];
                  signed_at: Date | null;
                }>(
                  `SELECT body,status,signed_at
                   FROM analiza.clinical_documents
                   WHERE organization_id=$1
                   ORDER BY created_at DESC,id`,
                  [actor.organizationId],
                )
              ).rows.map((row) => {
                const body: Record<string, unknown> = { ...row.body, status: row.status };
                if (row.signed_at) body.signedAt = row.signed_at.toISOString();
                else delete body.signedAt;
                return clinicalDocumentSchema.parse(body);
              }),
            )
          : [],
        can(actor.role, 'inventory:read')
          ? transaction(pool, actor, async (c) =>
              (
                await c.query(
                  `SELECT body FROM analiza.inventory_movements
                   WHERE organization_id=$1 ORDER BY created_at,id`,
                  [actor.organizationId],
                )
              ).rows.map((row) => inventoryMovementSchema.parse(row.body)),
            )
          : [],
        can(actor.role, 'catalogs:read')
          ? transaction(pool, actor, async (c) =>
              (
                await c.query(
                  'SELECT body FROM analiza.catalog_items WHERE organization_id=$1 ORDER BY id',
                  [actor.organizationId],
                )
              ).rows.map((r) => catalogItemSchema.parse(r.body)),
            )
          : [],
        can(actor.role, 'purchases:read')
          ? transaction(pool, actor, async (c) =>
              (
                await c.query(
                  'SELECT body FROM analiza.purchases WHERE organization_id=$1 ORDER BY created_at DESC,id',
                  [actor.organizationId],
                )
              ).rows.map((row) => purchaseSchema.parse(row.body)),
            )
          : [],
        can(actor.role, 'payments:read')
          ? transaction(pool, actor, async (c) =>
              (
                await c.query(
                  'SELECT body FROM analiza.payments WHERE organization_id=$1 ORDER BY created_at DESC,id',
                  [actor.organizationId],
                )
              ).rows.map((row) => paymentSchema.parse(row.body)),
            )
          : [],
        can(actor.role, 'audit:read')
          ? transaction(pool, actor, async (c) =>
              (
                await c.query(
                  'SELECT id,action,resource_id AS subject,occurred_at FROM analiza.audit_events WHERE organization_id=$1 ORDER BY occurred_at DESC LIMIT 100',
                  [actor.organizationId],
                )
              ).rows.map((r) => ({
                id: r.id,
                action: r.action,
                subject: r.subject,
                at: r.occurred_at.toISOString(),
              })),
            )
          : [],
      ]);
      return {
        ...emptyServerWorkspace(),
        patients: p.map((r) => r.patient),
        doctors: d.map((r) => r.doctor),
        hospitalizations: h.map((r) => r.hospitalization),
        shifts: s,
        nursingResources: r,
        quotes: q.map((row) => row.quote),
        clinicalDocuments,
        inventoryMovements,
        catalogItems: catalogs,
        purchases,
        payments,
        auditEntries: audits,
        patientVersions: Object.fromEntries(p.map((r) => [r.patient.id, r.version])),
        doctorVersions: Object.fromEntries(d.map((r) => [r.doctor.id, r.version])),
        hospitalizationVersions: Object.fromEntries(
          h.map((r) => [r.hospitalization.id, r.version]),
        ),
        quoteVersions: Object.fromEntries(q.map((row) => [row.quote.id, row.version])),
      };
    },
  };
}
