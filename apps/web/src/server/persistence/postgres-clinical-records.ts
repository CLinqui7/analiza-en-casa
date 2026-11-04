import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  clinicalRecordInputSchema,
  carePlanTypes,
  currentClinicalRecords,
  clinicalScales,
  scaleDefinitionSchema,
  scoreScale,
  type ClinicalRecord,
  type MedicationSnapshot,
  type Quote,
  type ConfigurationEntry,
} from '@analiza/contracts';
import { can } from '@/lib/permissions';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  type ServerActor,
} from '../validation/patients';
import { transaction } from './postgres-pool';

export async function listClinicalRecords(
  c: PoolClient,
  actor: ServerActor,
): Promise<ClinicalRecord[]> {
  if (!can(actor.role, 'clinical:read') && !can(actor.role, 'payments:read')) return [];
  return (
    await c.query<{ body: ClinicalRecord }>(
      'SELECT body FROM analiza.clinical_records WHERE organization_id=$1 ORDER BY created_at DESC,id',
      [actor.organizationId],
    )
  ).rows.map((row) => row.body);
}
async function audit(c: PoolClient, actor: ServerActor, action: string, id: string) {
  await c.query(
    'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
    [actor.organizationId, randomUUID(), actor.userId, action, 'clinical_record', id],
  );
}
export function latestCaseQuotes(quotes: Quote[]) {
  const roots = new Map<string, Quote>();
  for (const quote of quotes) {
    const root = quote.rootQuoteId ?? quote.originalQuoteId ?? quote.id;
    const previous = roots.get(root);
    if (!previous || quote.version > previous.version) roots.set(root, quote);
  }
  return [...roots.values()];
}
export function quoteMedications(quotes: Quote[]): MedicationSnapshot[] {
  return latestCaseQuotes(quotes).flatMap((quote) =>
    quote.items
      .filter((item) => item.category === 'MEDICATIONS')
      .map((item) => ({
        id: `${quote.id}:${item.id}`,
        name: item.name,
        chronic: false,
        quoteId: quote.id,
        quoteItemId: item.id,
      })),
  );
}

async function deductStock(
  c: PoolClient,
  actor: ServerActor,
  record: ClinicalRecord,
  stock: { inventoryItemId: string; warehouseId: string; unitsPerApplication: number },
  medicationId: string,
) {
  const itemId = stock.inventoryItemId;
  const warehouseId = stock.warehouseId;
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `${actor.organizationId}:${itemId}:${warehouseId}`,
  ]);
  const valid = await c.query(
    `SELECT 1 FROM analiza.catalog_items i JOIN analiza.warehouses w ON w.organization_id=i.organization_id WHERE i.organization_id=$1 AND i.id=$2 AND i.body->>'category'='MEDICATIONS' AND i.body->>'status'='ACTIVE' AND w.id=$3 AND w.status='ACTIVE'`,
    [actor.organizationId, itemId, warehouseId],
  );
  if (!valid.rowCount)
    throw new MongoInputError('Actualice el artículo y la bodega en la tarjeta de medicamentos.');
  const traced = await c.query(
    'SELECT 1 FROM analiza.inventory_trace_records WHERE organization_id=$1 AND item_id=$2 LIMIT 1',
    [actor.organizationId, itemId],
  );
  const allocations: { id: string | null; number: string | undefined; quantity: number }[] = [];
  if (traced.rowCount) {
    const candidates = await c.query<{ id: string; number_normalized: string; quantity: number }>(
      `SELECT r.id,r.number_normalized,b.quantity FROM analiza.inventory_trace_records r JOIN analiza.inventory_trace_balances b ON b.organization_id=r.organization_id AND b.trace_record_id=r.id WHERE r.organization_id=$1 AND r.item_id=$2 AND b.warehouse_id=$3 AND b.quantity>0 AND r.quality_status='AVAILABLE' AND (r.expires_on IS NULL OR r.expires_on >= $4::date) ORDER BY r.expires_on ASC NULLS LAST,r.received_at,r.id FOR UPDATE OF r,b`,
      [actor.organizationId, itemId, warehouseId, record.date],
    );
    let remaining = stock.unitsPerApplication;
    for (const row of candidates.rows) {
      if (!remaining) break;
      const quantity = Math.min(remaining, Number(row.quantity));
      allocations.push({ id: row.id, number: row.number_normalized, quantity });
      remaining -= quantity;
    }
    if (remaining)
      throw new MongoInputError(
        'No hay existencias liberadas y vigentes suficientes. Registre la entrada o corrija la asignación en la tarjeta.',
      );
  } else {
    const balance = await c.query<{ balance: string }>(
      'SELECT coalesce(sum(delta),0) AS balance FROM analiza.inventory_movements WHERE organization_id=$1 AND item_id=$2 AND warehouse_id=$3',
      [actor.organizationId, itemId, warehouseId],
    );
    if (Number(balance.rows[0]?.balance) < stock.unitsPerApplication)
      throw new MongoInputError(
        'Existencias insuficientes. Registre la entrada o corrija la asignación en la tarjeta.',
      );
    allocations.push({ id: null, number: undefined, quantity: stock.unitsPerApplication });
  }
  for (const [index, allocation] of allocations.entries()) {
    const movementId = createHash('sha256')
      .update(`${record.id}:${medicationId}:${index}`)
      .digest('hex');
    const movement = {
      id: movementId,
      itemId,
      warehouseId,
      quantity: allocation.quantity,
      createdAt: record.createdAt,
      user: actor.userId,
      kind: 'EXIT',
      reason: 'Administración registrada',
      reference: record.id,
      ...(allocation.id ? { traceRecordId: allocation.id, traceNumber: allocation.number } : {}),
    };
    if (allocation.id) {
      await c.query(
        'UPDATE analiza.inventory_trace_balances SET quantity=quantity-$4,updated_at=$5 WHERE organization_id=$1 AND trace_record_id=$2 AND warehouse_id=$3',
        [actor.organizationId, allocation.id, warehouseId, allocation.quantity, record.createdAt],
      );
      await c.query(
        `INSERT INTO analiza.inventory_trace_events(organization_id,id,trace_record_id,event_type,idempotency_key,body,occurred_at) VALUES($1,$2,$3,'ISSUED',$2,$4::jsonb,$5)`,
        [
          actor.organizationId,
          movementId,
          allocation.id,
          JSON.stringify(movement),
          record.createdAt,
        ],
      );
    }
    await c.query(
      'INSERT INTO analiza.inventory_movements(organization_id,id,item_id,warehouse_id,idempotency_key,delta,body,created_at,trace_record_id) VALUES($1,$2,$3,$4,$2,$5,$6::jsonb,$7,$8)',
      [
        actor.organizationId,
        movementId,
        itemId,
        warehouseId,
        -allocation.quantity,
        JSON.stringify(movement),
        record.createdAt,
        allocation.id,
      ],
    );
    record.stockMovementIds!.push(movementId);
    (record.stockByMedication![medicationId] ??= []).push(movementId);
  }
}

// Corrections append compensating movements; the original clinical and stock evidence stays intact.
async function reverseConsumption(
  c: PoolClient,
  actor: ServerActor,
  record: ClinicalRecord,
  movementIds: string[],
) {
  for (const sourceId of movementIds) {
    const result = await c.query<{
      item_id: string;
      warehouse_id: string;
      delta: number;
      trace_record_id: string | null;
      trace_number: string | null;
    }>(
      "SELECT item_id,warehouse_id,delta,trace_record_id,body->>'traceNumber' AS trace_number FROM analiza.inventory_movements WHERE organization_id=$1 AND id=$2 AND delta<0",
      [actor.organizationId, sourceId],
    );
    const source = result.rows[0];
    if (!source) throw new MongoInputError('No se pudo conciliar el consumo original.');
    const id = createHash('sha256').update(`${record.id}:reverse:${sourceId}`).digest('hex');
    const quantity = -Number(source.delta);
    const body = {
      id,
      itemId: source.item_id,
      warehouseId: source.warehouse_id,
      quantity,
      kind: 'ENTRY',
      reason: record.correctionReason,
      reference: record.id,
      reversalOf: sourceId,
      user: actor.userId,
      createdAt: record.createdAt,
      ...(source.trace_record_id
        ? { traceRecordId: source.trace_record_id, traceNumber: source.trace_number }
        : {}),
    };
    if (source.trace_record_id) {
      await c.query(
        'UPDATE analiza.inventory_trace_balances SET quantity=quantity+$4,updated_at=$5 WHERE organization_id=$1 AND trace_record_id=$2 AND warehouse_id=$3',
        [
          actor.organizationId,
          source.trace_record_id,
          source.warehouse_id,
          quantity,
          record.createdAt,
        ],
      );
      await c.query(
        "INSERT INTO analiza.inventory_trace_events(organization_id,id,trace_record_id,event_type,idempotency_key,body,occurred_at) VALUES($1,$2,$3,'RECEIVED',$2,$4::jsonb,$5)",
        [actor.organizationId, id, source.trace_record_id, JSON.stringify(body), record.createdAt],
      );
    }
    await c.query(
      'INSERT INTO analiza.inventory_movements(organization_id,id,item_id,warehouse_id,idempotency_key,delta,body,created_at,trace_record_id) VALUES($1,$2,$3,$4,$2,$5,$6::jsonb,$7,$8)',
      [
        actor.organizationId,
        id,
        source.item_id,
        source.warehouse_id,
        quantity,
        JSON.stringify(body),
        record.createdAt,
        source.trace_record_id,
      ],
    );
  }
}

function medicationMovementIds(record: ClinicalRecord, medicationId: string) {
  if (record.stockByMedication) return record.stockByMedication[medicationId] ?? [];
  // Backward compatibility with records saved before per-medication movement indexing.
  return (record.stockMovementIds ?? []).filter((id) =>
    Array.from({ length: record.stockMovementIds?.length ?? 0 }, (_, i) =>
      createHash('sha256').update(`${record.id}:${medicationId}:${i}`).digest('hex'),
    ).includes(id),
  );
}

export async function saveClinicalRecord(pool: Pool, actor: ServerActor, input: unknown) {
  if (!can(actor.role, 'clinical:write')) throw new MongoAccessError();
  const parsed = z
    .object({ command: z.literal('clinical.record'), record: clinicalRecordInputSchema })
    .strict()
    .safeParse(input);
  if (!parsed.success)
    throw new MongoInputError(parsed.error.issues[0]?.message ?? 'Revise el formulario.');
  const submitted = parsed.data.record;
  return transaction(pool, actor, async (c) => {
    // Serialize retries and correction races; stock locks additionally coordinate other inventory flows.
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `${actor.organizationId}:clinical:${submitted.caseId}`,
    ]);
    const previous = await c.query<{ body: ClinicalRecord; same: boolean }>(
      'SELECT body,request_body=$3::jsonb AS same FROM analiza.clinical_records WHERE organization_id=$1 AND id=$2',
      [actor.organizationId, submitted.id, JSON.stringify(submitted)],
    );
    if (previous.rows[0]) {
      if (!previous.rows[0].same || previous.rows[0].body.createdBy !== actor.userId)
        throw new MongoConflictError();
      return previous.rows[0].body;
    }
    const hospitalization = await c.query(
      'SELECT body FROM analiza.hospitalizations WHERE organization_id=$1 AND id=$2 AND patient_id=$3',
      [actor.organizationId, submitted.caseId, submitted.patientId],
    );
    if (!hospitalization.rowCount)
      throw new MongoInputError('Seleccione una hospitalización del paciente.');
    const account = await c.query<{ display_name: string }>(
      'SELECT display_name FROM analiza.users WHERE id=$1',
      [actor.userId],
    );
    const record: ClinicalRecord = {
      ...submitted,
      createdAt: new Date().toISOString(),
      createdBy: actor.userId,
      author: account.rows[0]?.display_name ?? actor.userId,
      version: 1,
      rootId: submitted.id,
    };
    let corrected: ClinicalRecord | undefined;
    if (submitted.correctionOf) {
      const original = await c.query<{ body: ClinicalRecord }>(
        'SELECT body FROM analiza.clinical_records WHERE organization_id=$1 AND id=$2 AND case_id=$3',
        [actor.organizationId, submitted.correctionOf, submitted.caseId],
      );
      const old = original.rows[0]?.body;
      if (
        !old ||
        old.payload.kind !== submitted.payload.kind ||
        old.patientId !== submitted.patientId
      )
        throw new MongoInputError('El registro a corregir no está disponible.');
      const later = await c.query(
        'SELECT 1 FROM analiza.clinical_records WHERE organization_id=$1 AND root_id=$2 AND version>$3',
        [actor.organizationId, old.rootId, old.version],
      );
      if (later.rowCount) throw new MongoConflictError();
      record.version = old.version + 1;
      record.rootId = old.rootId;
      corrected = old;
    }
    const quoteRows = await c.query<{ body: Quote }>(
      `SELECT body FROM analiza.quotes WHERE organization_id=$1 AND patient_id=$2 AND (case_id=$3 OR id=ANY($4::text[]))`,
      [
        actor.organizationId,
        submitted.patientId,
        submitted.caseId,
        hospitalization.rows[0].body.linkedQuoteIds ?? [],
      ],
    );
    const quotes = latestCaseQuotes(quoteRows.rows.map((row) => row.body));
    const payload = submitted.payload;
    if (payload.kind === 'MEDICATION_CARD') {
      record.medications = [
        ...quoteMedications(quotes),
        ...payload.chronic
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((name, i) => ({ id: `chronic:${i}`, name, chronic: true })),
      ];
      if (new Set(payload.stock.map((item) => item.quoteItemId)).size !== payload.stock.length)
        throw new MongoInputError('No repita la asignación de un medicamento.');
      for (const entry of payload.stock) {
        if (!record.medications.some((medication) => medication.id === entry.quoteItemId))
          throw new MongoInputError(
            'La asignación debe corresponder a un medicamento de esta hospitalización.',
          );
        const valid = await c.query(
          `SELECT 1 FROM analiza.catalog_items i JOIN analiza.warehouses w ON w.organization_id=i.organization_id WHERE i.organization_id=$1 AND i.id=$2 AND i.body->>'category'='MEDICATIONS' AND w.id=$3 AND w.status='ACTIVE'`,
          [actor.organizationId, entry.inventoryItemId, entry.warehouseId],
        );
        if (!valid.rowCount)
          throw new MongoInputError('Seleccione un artículo y una bodega disponibles.');
      }
    }
    if (payload.kind === 'CARE_PLAN') {
      const labs = quotes.flatMap((quote) =>
        quote.items.filter((item) => item.category === 'STUDIES').map((item) => item.name),
      );
      const plans = [...carePlanTypes(payload)];
      if (labs.length && !plans.includes('LABORATORY')) plans.push('LABORATORY');
      record.payload = { kind: 'CARE_PLAN', plans, summary: payload.summary };
      if (plans.includes('LABORATORY')) record.laboratories = labs;
    }
    if (payload.kind === 'NURSING_NOTE') {
      const nurse = await c.query<{ body: { jvpe?: string; boardRegistrationNumber?: string } }>(
        'SELECT body FROM analiza.nursing_resources WHERE organization_id=$1 AND user_id=$2 ORDER BY id LIMIT 1',
        [actor.organizationId, actor.userId],
      );
      record.jvpe = nurse.rows[0]?.body.jvpe ?? nurse.rows[0]?.body.boardRegistrationNumber ?? '';
    }
    if (payload.kind === 'SCALE') {
      const configured = await c.query<{ body: ConfigurationEntry }>(
        `SELECT body FROM analiza.configuration_entries WHERE organization_id=$1 AND body->>'category'='SCALE' AND body->'scaleDefinition'->>'id'=$2 AND (body->>'active')::boolean ORDER BY id`,
        [actor.organizationId, payload.scaleId],
      );
      record.scaleDefinition = scaleDefinitionSchema.parse(
        configured.rows[0]?.body.scaleDefinition ??
          clinicalScales.find((scale) => scale.id === payload.scaleId),
      );
      if (payload.definitionVersion && payload.definitionVersion !== record.scaleDefinition.version)
        throw new MongoConflictError();
      try {
        record.score = scoreScale(record.scaleDefinition, payload.values);
      } catch (error) {
        throw new MongoInputError((error as Error).message);
      }
    }
    if (payload.kind === 'ADMINISTRATION') {
      const rows = await c.query<{ body: ClinicalRecord }>(
        `SELECT body FROM analiza.clinical_records WHERE organization_id=$1 AND id=$2 AND case_id=$3 AND kind='MEDICATION_CARD'`,
        [actor.organizationId, payload.cardId, record.caseId],
      );
      const card = rows.rows[0]?.body;
      if (!card || card.payload.kind !== 'MEDICATION_CARD')
        throw new MongoInputError(
          'Guarde primero la tarjeta de medicamentos de esta hospitalización.',
        );
      const replaced = await c.query(
        'SELECT 1 FROM analiza.clinical_records WHERE organization_id=$1 AND root_id=$2 AND version>$3',
        [actor.organizationId, card.rootId, card.version],
      );
      const previousPayload =
        corrected?.payload.kind === 'ADMINISTRATION' ? corrected.payload : undefined;
      if (previousPayload && previousPayload.cardId !== payload.cardId)
        throw new MongoInputError('La corrección debe conservar la tarjeta original.');
      if (replaced.rowCount && !previousPayload) throw new MongoConflictError();
      if (new Set(payload.items.map((item) => item.medicationId)).size !== payload.items.length)
        throw new MongoInputError('No repita medicamentos en la misma administración.');
      record.medications = [];
      record.stockMovementIds = [];
      record.stockByMedication = {};
      const assignment = (medicationId: string) =>
        payload.stock?.find((entry) => entry.quoteItemId === medicationId) ??
        (card.payload.kind === 'MEDICATION_CARD'
          ? card.payload.stock.find((entry) => entry.quoteItemId === medicationId)
          : undefined);
      if (
        new Set(payload.stock?.map((entry) => entry.quoteItemId)).size !==
        (payload.stock?.length ?? 0)
      )
        throw new MongoInputError('No repita asignaciones de inventario.');
      for (const entry of payload.stock ?? [])
        if (
          !payload.items.some((item) => item.medicationId === entry.quoteItemId && item.applied) ||
          !card.medications?.some((m) => m.id === entry.quoteItemId && !m.chronic)
        )
          throw new MongoInputError('La asignación no corresponde a un medicamento aplicado.');
      const oldAssignment = (medicationId: string) =>
        previousPayload?.stock?.find((entry) => entry.quoteItemId === medicationId) ??
        (card.payload.kind === 'MEDICATION_CARD'
          ? card.payload.stock.find((entry) => entry.quoteItemId === medicationId)
          : undefined);
      const lockKeys = new Set(
        [
          ...payload.items.map((item) => assignment(item.medicationId)),
          ...(previousPayload?.items.map((item) => oldAssignment(item.medicationId)) ?? []),
        ]
          .filter((s) => !!s)
          .map((s) => `${actor.organizationId}:${s.inventoryItemId}:${s.warehouseId}`),
      );
      for (const key of [...lockKeys].sort())
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
      if (corrected && previousPayload)
        for (const old of previousPayload.items.filter((item) => item.applied)) {
          if (!payload.items.some((item) => item.medicationId === old.medicationId && item.applied))
            await reverseConsumption(
              c,
              actor,
              record,
              medicationMovementIds(corrected, old.medicationId),
            );
        }
      // Different cards can map different medication IDs to the same stock.
      // Lock order must follow inventory identity, not the card's line order.
      const stockKey = (medicationId: string) => {
        const stock =
          card.payload.kind === 'MEDICATION_CARD'
            ? card.payload.stock.find((entry) => entry.quoteItemId === medicationId)
            : undefined;
        return stock ? `${stock.inventoryItemId}\u0000${stock.warehouseId}` : medicationId;
      };
      for (const item of [...payload.items].sort((a, b) =>
        stockKey(a.medicationId).localeCompare(stockKey(b.medicationId)),
      )) {
        const medication = card.medications?.find((med) => med.id === item.medicationId);
        if (!medication)
          throw new MongoInputError('El medicamento no pertenece a la tarjeta seleccionada.');
        record.medications.push(medication);
        if (item.applied && !medication.chronic) {
          const stock = assignment(medication.id);
          if (!stock)
            throw new MongoInputError('Complete la salida de inventario del medicamento aplicado.');
          if (
            corrected &&
            previousPayload?.items.some((old) => old.medicationId === medication.id && old.applied)
          ) {
            const prior = oldAssignment(medication.id);
            if (
              !prior ||
              prior.inventoryItemId !== stock.inventoryItemId ||
              prior.warehouseId !== stock.warehouseId ||
              prior.unitsPerApplication !== stock.unitsPerApplication
            )
              throw new MongoInputError(
                'La corrección conserva el origen y unidades del consumo ya registrado.',
              );
            const ids = medicationMovementIds(corrected, medication.id);
            record.stockByMedication[medication.id] = ids;
            record.stockMovementIds.push(...ids);
          } else await deductStock(c, actor, record, stock, medication.id);
        }
      }
    }
    await c.query(
      'INSERT INTO analiza.clinical_records(organization_id,id,patient_id,case_id,root_id,version,kind,request_body,body,created_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)',
      [
        actor.organizationId,
        record.id,
        record.patientId,
        record.caseId,
        record.rootId,
        record.version,
        payload.kind,
        JSON.stringify(submitted),
        JSON.stringify(record),
        actor.userId,
        record.createdAt,
      ],
    );
    await audit(
      c,
      actor,
      submitted.correctionOf ? 'CLINICAL_RECORD_CORRECTED' : 'CLINICAL_RECORD_CREATED',
      record.id,
    );
    return record;
  });
}

export function medicationReturns(records: ClinicalRecord[]) {
  return currentClinicalRecords(records).flatMap((record) =>
    record.payload.kind === 'ADMINISTRATION'
      ? record.payload.items
          .filter((item) => !item.applied)
          .flatMap((item) => {
            const medication = record.medications?.find((med) => med.id === item.medicationId);
            return medication && !medication.chronic
              ? [
                  {
                    id: `${record.id}:${item.medicationId}`,
                    date: record.date,
                    patientId: record.patientId,
                    caseId: record.caseId,
                    quoteId: medication.quoteId!,
                    medication: medication.name,
                    reason: item.reason,
                  },
                ]
              : [];
          })
      : [],
  );
}
