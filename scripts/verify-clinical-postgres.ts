/** Synthetic QA only. Run against a dedicated PostgreSQL instance through loopback. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  clinicalScales,
  clinicalRecordInputSchema,
  quoteSchema,
  hospitalizationSchema,
  patientSchema,
  catalogItemSchema,
  inventoryTraceRecordSchema,
  inventoryMovementSchema,
  medicationApplicationKey,
  type ClinicalPayload,
} from '../packages/contracts/src/index';
import {
  postgresPool,
  transaction,
  closePostgresPool,
} from '../apps/web/src/server/persistence/postgres-pool';
import { postgresPersistence } from '../apps/web/src/server/persistence/postgres';
import {
  saveClinicalRecord,
  listClinicalRecords,
  medicationReturns,
} from '../apps/web/src/server/persistence/postgres-clinical-records';

assert.equal(process.env.ANALIZA_QA_MODE, '1');
assert.equal(process.env.PGDATABASE, 'analiza_qa');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.notEqual(process.env.PGUSER, 'postgres');
const pool = postgresPool();
const actor = { userId: 'qa-nurse', organizationId: 'qa-org-a', role: 'NURSE' as const };
const foreign = { userId: 'qa-foreign', organizationId: 'qa-org-c', role: 'ADMIN' as const };
const backend = postgresPersistence();
const run = randomUUID().slice(0, 8),
  patientId = `clinical-qa-p-${run}`,
  caseId = `clinical-qa-c-${run}`,
  quoteId = `clinical-qa-q-${run}`,
  itemId = `clinical-qa-i-${run}`,
  warehouseId = `clinical-qa-w-${run}`;
const date = '2026-11-03';
const evidence: string[] = [];
const check = (name: string) => {
  evidence.push(name);
  console.log(`PASS ${name}`);
};
async function save(payload: ClinicalPayload, extra = {}) {
  const record = clinicalRecordInputSchema.parse({
    id: randomUUID(),
    patientId,
    caseId,
    date,
    payload,
    ...extra,
  });
  return saveClinicalRecord(pool, actor, { command: 'clinical.record', record });
}
async function balance() {
  return transaction(pool, actor, async (c) =>
    Number(
      (
        await c.query(
          'SELECT coalesce(sum(delta),0) AS n FROM analiza.inventory_movements WHERE organization_id=$1 AND item_id=$2',
          [actor.organizationId, itemId],
        )
      ).rows[0].n,
    ),
  );
}
try {
  const identity = await pool.query(
    'SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user',
  );
  assert.equal(identity.rows[0].rolsuper, false);
  assert.equal(identity.rows[0].rolbypassrls, false);
  await transaction(pool, actor, async (c) => {
    const patient = patientSchema.parse({
      id: patientId,
      fullName: `Paciente sintético clínica ${run}`,
      documentType: 'OTHER',
      documentId: `QA-${run}`,
      phone: '0000-0000',
      status: 'ACTIVE',
      referralOrigin: 'FAMILY_FRIENDS',
    });
    await c.query(
      'INSERT INTO analiza.patients(organization_id,id,document_key,body) VALUES($1,$2,$3,$4::jsonb)',
      [actor.organizationId, patientId, `QA-${run}`, JSON.stringify(patient)],
    );
    const hospitalization = hospitalizationSchema.parse({
      id: caseId,
      patientId,
      startDate: date,
      status: 'ACTIVE',
      accountType: 'PARTICULAR',
      priority: 'MEDIUM',
    });
    await c.query(
      'INSERT INTO analiza.hospitalizations(organization_id,id,patient_id,body) VALUES($1,$2,$3,$4::jsonb)',
      [actor.organizationId, caseId, patientId, JSON.stringify(hospitalization)],
    );
    const quote = quoteSchema.parse({
      id: quoteId,
      caseId,
      patientId,
      version: 1,
      status: 'SENT',
      immutable: true,
      summary: 'Cotización sintética QA',
      createdAt: `${date}T08:00:00Z`,
      items: [
        {
          id: 'medicine',
          category: 'MEDICATIONS',
          name: 'Medicamento sintético QA',
          inventoryItemId: itemId,
          quantity: 3,
          unitPrice: 1,
          discountAmount: 0,
        },
        {
          id: 'lab',
          category: 'STUDIES',
          name: 'Laboratorio sintético QA',
          quantity: 1,
          unitPrice: 0,
          discountAmount: 0,
        },
      ],
      subtotal: 3,
      total: 3,
      patientAmount: 3,
    });
    await c.query(
      'INSERT INTO analiza.quotes(organization_id,id,case_id,patient_id,root_quote_id,quote_version,body) VALUES($1,$2,$3,$4,$2,1,$5::jsonb)',
      [actor.organizationId, quoteId, caseId, patientId, JSON.stringify(quote)],
    );
    await c.query(
      'INSERT INTO analiza.catalog_items(organization_id,id,body) VALUES($1,$2,$3::jsonb)',
      [
        actor.organizationId,
        itemId,
        JSON.stringify(
          catalogItemSchema.parse({
            id: itemId,
            sku: itemId,
            name: 'Medicamento sintético QA',
            category: 'MEDICATIONS',
            status: 'ACTIVE',
            createdAt: `${date}T08:00:00Z`,
          }),
        ),
      ],
    );
    await c.query(
      'INSERT INTO analiza.warehouses(organization_id,id,code_normalized,status,body) VALUES($1,$2,upper($2),$3,$4::jsonb)',
      [
        actor.organizationId,
        warehouseId,
        'ACTIVE',
        JSON.stringify({
          id: warehouseId,
          code: warehouseId,
          name: 'Bodega sintética QA',
          status: 'ACTIVE',
          createdAt: `${date}T08:00:00Z`,
          updatedAt: `${date}T08:00:00Z`,
        }),
      ],
    );
    const movement = inventoryMovementSchema.parse({
      id: `entry-${run}`,
      itemId,
      warehouseId,
      kind: 'ENTRY',
      quantity: 3,
      createdAt: `${date}T08:00:00Z`,
      reason: 'Entrada sintética QA',
      user: actor.userId,
    });
    await c.query(
      'INSERT INTO analiza.inventory_movements(organization_id,id,item_id,warehouse_id,idempotency_key,delta,body) VALUES($1,$2,$3,$4,$2,3,$5::jsonb)',
      [actor.organizationId, movement.id, itemId, warehouseId, JSON.stringify(movement)],
    );
  });
  check('isolated synthetic fixtures and restricted PostgreSQL identity');
  for (const kind of ['INDICATION', 'EVOLUTION', 'HISTORY', 'BACKGROUND'] as const)
    await save({ kind, summary: `Observación sintética ${kind}` });
  for (const plan of ['DIET', 'NURSING', 'LABORATORY'] as const) {
    const result = await save({ kind: 'CARE_PLAN', plan, summary: 'Plan manual sintético' });
    if (plan === 'LABORATORY') assert.deepEqual(result.laboratories, ['Laboratorio sintético QA']);
  }
  await save({
    kind: 'FLUID_BALANCE',
    diagnosis: 'QA',
    weight: '70 kg',
    rows: Array.from({ length: 6 }, (_, i) => ({
      time: String(i),
      values: [10, 0, 0, 0, 5, 0, 0, 0, 0],
    })),
    endogenous: 0,
    insensible: 0,
    hours: 24,
    notes: '',
  });
  await save({
    kind: 'VITALS',
    rows: [
      {
        time: '08:00',
        heartRate: '80',
        respiratoryRate: '18',
        oxygen: '98',
        temperature: '37',
        pressure: '120/80',
        hgt: '100',
      },
    ],
  });
  await backend.operations.execute(actor, { command: 'clinical.jvpe.save', jvpe: '12345' });
  const note = await save({
    kind: 'NURSING_NOTE',
    rows: [{ time: '08:00', note: 'Nota sintética QA' }],
  });
  assert.equal(note.jvpe, '12345');
  await assert.rejects(
    saveClinicalRecord(pool, actor, {
      command: 'clinical.record',
      record: { id: randomUUID(), patientId, caseId, date, payload: note.payload, jvpe: 'FORGED' },
    }),
  );
  check('medical, nursing, balance, laboratory and server-resolved JVPE persistence');
  const multiPlan = await save({
    kind: 'CARE_PLAN',
    plans: ['DIET', 'NURSING'],
    summary: 'Plan combinado sintético',
  });
  assert.deepEqual(multiPlan.payload.kind === 'CARE_PLAN' && multiPlan.payload.plans, [
    'DIET',
    'NURSING',
    'LABORATORY',
  ]);
  assert.deepEqual(multiPlan.laboratories, ['Laboratorio sintético QA']);
  await saveClinicalRecord(pool, actor, {
    command: 'clinical.record',
    record: {
      id: multiPlan.id,
      patientId,
      caseId,
      date,
      payload: {
        kind: 'CARE_PLAN',
        plans: ['DIET', 'NURSING'],
        summary: 'Plan combinado sintético',
      },
    },
  });
  check('multiple care types include quoted labs server-side and preserve idempotent retry');
  for (const definition of clinicalScales) {
    const values = Object.fromEntries(
      definition.items.map((item) => [
        item.id,
        Math.min(...item.options.map((option) => option.score)),
      ]),
    );
    const result = await save({
      kind: 'SCALE',
      scaleId: definition.id,
      values,
      notes: 'Evaluación sintética',
    });
    assert.equal(result.scaleDefinition?.version, definition.version);
    assert.equal(
      result.score,
      definition.aggregation === 'PROFILE'
        ? null
        : Object.values(values).reduce((a, b) => a + b, 0),
    );
  }
  check('all ten scale definitions and persisted arithmetic');
  for (const role of ['NURSE', 'DOCTOR', 'FINANCE', 'INVENTORY', 'AUDITOR'] as const) {
    const staff = { ...actor, role, userId: `qa-${role.toLowerCase()}` };
    const entry = {
      id: `discount-${role}-${run}`,
      category: 'DISCOUNT_PROFILE',
      label: `Perfil sintético ${role}`,
      active: true,
      categoryRates: { SERVICES: 12, MEDICATIONS: 5 },
      notes: 'Datos sintéticos, no aplicar a pacientes reales.',
    };
    await backend.operations.execute(staff, { command: 'configuration.save', entry });
    const restored = (await backend.operations.list(staff)).configuration.find(
      (item) => item.id === entry.id,
    );
    assert.deepEqual(restored?.categoryRates, entry.categoryRates);
    await assert.rejects(
      backend.operations.execute(staff, {
        command: 'configuration.save',
        entry: { ...entry, category: 'DIAGNOSIS' },
      }),
    );
  }
  const definition = structuredClone(clinicalScales[0]);
  definition.version = `qa-version-${run}`;
  definition.items[0].options[0].label = 'Respuesta sintética QA';
  const scaleEntry = {
    id: 'scale-EVA',
    category: 'SCALE',
    label: 'EVA',
    active: true,
    scaleDefinition: definition,
  };
  await backend.operations.execute(actor, { command: 'configuration.save', entry: scaleEntry });
  const assessment = await save({
    kind: 'SCALE',
    scaleId: 'EVA',
    definitionVersion: definition.version,
    values: { Dolor: 0 },
    notes: '',
  });
  const changedDefinition = structuredClone(definition);
  changedDefinition.items[0].options[0].label = 'Nueva respuesta sintética';
  await assert.rejects(
    backend.operations.execute(actor, {
      command: 'configuration.save',
      entry: { ...scaleEntry, scaleDefinition: changedDefinition },
    }),
    /versión/,
  );
  changedDefinition.version += '-2';
  await backend.operations.execute(actor, {
    command: 'configuration.save',
    entry: { ...scaleEntry, scaleDefinition: changedDefinition },
  });
  await assert.rejects(
    save({
      kind: 'SCALE',
      scaleId: 'EVA',
      definitionVersion: definition.version,
      values: { Dolor: 0 },
      notes: '',
    }),
  );
  assert.equal(assessment.scaleDefinition?.items[0].options[0].label, 'Respuesta sintética QA');
  await backend.operations.execute(actor, {
    command: 'configuration.save',
    entry: { ...scaleEntry, scaleDefinition: clinicalScales[0] },
  });
  check(
    'all staff persist discount configuration; scale versions reject stale forms and preserve snapshots',
  );
  const card = await save({
    kind: 'MEDICATION_CARD',
    chronic: 'Crónico sintético externo',
    instructions: 'Indicación manual QA',
    stock: [
      {
        quoteItemId: `${quoteId}:medicine`,
        inventoryItemId: itemId,
        warehouseId,
        unitsPerApplication: 1,
      },
    ],
  });
  assert.equal(card.medications?.length, 2);
  const administration = (
    medicationId: string,
    applied: boolean,
    reason = '',
  ): ClinicalPayload => ({
    kind: 'ADMINISTRATION',
    cardId: card.id,
    time: '08:00',
    dose: 'Dosis manual QA',
    presentation: 'Tableta',
    route: 'Oral',
    items: [{ medicationId, applied, reason }],
  });
  await save(administration(`${quoteId}:medicine`, false, 'No administrado durante prueba'));
  await save(administration('chronic:0', true));
  assert.equal(await balance(), 3);
  check('not-applied and chronic medicines leave inventory untouched');
  const duplicateId = randomUUID();
  const duplicateCommand = {
    command: 'clinical.record',
    record: {
      id: duplicateId,
      patientId,
      caseId,
      date,
      payload: administration(`${quoteId}:medicine`, true),
    },
  };
  const duplicate = await Promise.all([
    saveClinicalRecord(pool, actor, duplicateCommand),
    saveClinicalRecord(pool, actor, duplicateCommand),
  ]);
  assert.equal(duplicate[0].id, duplicate[1].id);
  assert.equal(await balance(), 2);
  await Promise.all([
    save(administration(`${quoteId}:medicine`, true)),
    save(administration(`${quoteId}:medicine`, true)),
  ]);
  assert.equal(await balance(), 0);
  await assert.rejects(
    save(administration(`${quoteId}:medicine`, true)),
    /Existencias insuficientes/,
  );
  check('concurrent retries consume once; concurrent applications cannot overdraw stock');
  const traceIds: string[] = [];
  await transaction(pool, actor, async (c) => {
    for (const [suffix, expiry, quality] of [
      ['early', '2026-11-04', 'AVAILABLE'],
      ['late', '2026-12-01', 'AVAILABLE'],
      ['expired', '2026-10-01', 'AVAILABLE'],
      ['quarantined', '2026-11-10', 'QUARANTINED'],
    ]) {
      const traceId = `trace-${suffix}-${run}`;
      traceIds.push(traceId);
      const trace = inventoryTraceRecordSchema.parse({
        id: traceId,
        itemId,
        supplierCatalogItemId: itemId,
        kind: 'LOT',
        number: traceId.toUpperCase(),
        qualityStatus: quality,
        expiresOn: expiry,
        receivedAt: `${date}T08:00:00Z`,
        receivedQuantity: 1,
        receiptReference: `QA-${run}`,
        createdAt: `${date}T08:00:00Z`,
        updatedAt: `${date}T08:00:00Z`,
        balances: [{ warehouseId, quantity: 1 }],
      });
      await c.query(
        'INSERT INTO analiza.inventory_trace_records(organization_id,id,kind,item_id,supplier_catalog_item_id,number_normalized,quality_status,expires_on,received_at,body) VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,$9::jsonb)',
        [
          actor.organizationId,
          traceId,
          'LOT',
          itemId,
          trace.number,
          quality,
          expiry,
          trace.receivedAt,
          JSON.stringify(trace),
        ],
      );
      await c.query(
        'INSERT INTO analiza.inventory_trace_balances(organization_id,trace_record_id,warehouse_id,quantity) VALUES($1,$2,$3,1)',
        [actor.organizationId, traceId, warehouseId],
      );
      const movement = inventoryMovementSchema.parse({
        id: `entry-${traceId}`,
        itemId,
        warehouseId,
        kind: 'ENTRY',
        quantity: 1,
        createdAt: trace.receivedAt,
        traceRecordId: traceId,
        traceNumber: trace.number,
        reason: 'Entrada sintética de lote',
        user: actor.userId,
      });
      await c.query(
        'INSERT INTO analiza.inventory_movements(organization_id,id,item_id,warehouse_id,idempotency_key,delta,body,trace_record_id) VALUES($1,$2,$3,$4,$2,1,$5::jsonb,$6)',
        [actor.organizationId, movement.id, itemId, warehouseId, JSON.stringify(movement), traceId],
      );
    }
  });
  const firstLot = await save(administration(`${quoteId}:medicine`, true));
  await transaction(pool, actor, async (c) => {
    const movement = await c.query(
      'SELECT trace_record_id FROM analiza.inventory_movements WHERE organization_id=$1 AND id=$2',
      [actor.organizationId, firstLot.stockMovementIds?.[0]],
    );
    assert.equal(movement.rows[0].trace_record_id, traceIds[0]);
  });
  await save(administration(`${quoteId}:medicine`, true));
  await assert.rejects(save(administration(`${quoteId}:medicine`, true)), /vigentes suficientes/);
  assert.equal(await balance(), 2);
  check(
    'FEFO consumes released valid lots first and leaves expired or quarantined stock untouched',
  );
  const correctedAdministration = await save(
    {
      ...firstLot.payload,
      ...(firstLot.payload.kind === 'ADMINISTRATION' ? { dose: 'Texto corregido sintético' } : {}),
    } as ClinicalPayload,
    { correctionOf: firstLot.id, correctionReason: 'Aclaración QA' },
  );
  assert.equal(await balance(), 2);
  assert.deepEqual(correctedAdministration.stockMovementIds, firstLot.stockMovementIds);
  const reversalId = randomUUID();
  const reversalCommand = {
    command: 'clinical.record',
    record: {
      id: reversalId,
      patientId,
      caseId,
      date,
      correctionOf: correctedAdministration.id,
      correctionReason: 'Aplicación registrada por error QA',
      payload: administration(`${quoteId}:medicine`, false, 'Corrección sintética'),
    },
  };
  const reversals = await Promise.all([
    saveClinicalRecord(pool, actor, reversalCommand),
    saveClinicalRecord(pool, actor, reversalCommand),
  ]);
  assert.equal(reversals[0].id, reversals[1].id);
  assert.equal(await balance(), 3);
  await assert.rejects(
    save(administration(`${quoteId}:medicine`, false, 'Intento obsoleto'), {
      correctionOf: correctedAdministration.id,
      correctionReason: 'QA',
    }),
  );
  const reapplied = await save(administration(`${quoteId}:medicine`, true), {
    correctionOf: reversalId,
    correctionReason: 'Rectificación sintética',
  });
  assert.equal(await balance(), 2);
  assert.equal(reapplied.version, 4);
  await transaction(pool, actor, async (c) => {
    const lot = await c.query(
      'SELECT quantity FROM analiza.inventory_trace_balances WHERE organization_id=$1 AND trace_record_id=$2 AND warehouse_id=$3',
      [actor.organizationId, traceIds[0], warehouseId],
    );
    assert.equal(Number(lot.rows[0].quantity), 0);
  });
  const bareCard = await save({
    kind: 'MEDICATION_CARD',
    chronic: '',
    instructions: '',
    stock: [],
  });
  const noStockPayload = {
    ...administration(`${quoteId}:medicine`, true),
    cardId: bareCard.id,
  } as Extract<ClinicalPayload, { kind: 'ADMINISTRATION' }>;
  await assert.rejects(save(noStockPayload), /Configure el origen/);
  await assert.rejects(
    save({
      ...noStockPayload,
      stock: [
        {
          quoteItemId: `${quoteId}:medicine`,
          inventoryItemId: 'foreign-item',
          warehouseId,
          unitsPerApplication: 1,
        },
      ],
    }),
    /artículo/,
  );
  const unapplied = await save({
    ...noStockPayload,
    items: [{ medicationId: `${quoteId}:medicine`, applied: false, reason: 'QA' }],
  });
  // Restore stock via a correction, then use the new administration-level assignment.
  const released = await save(administration(`${quoteId}:medicine`, false, 'QA'), {
    correctionOf: reapplied.id,
    correctionReason: 'Liberación sintética',
  });
  await save({
    ...noStockPayload,
    stock: [
      {
        quoteItemId: `${quoteId}:medicine`,
        inventoryItemId: itemId,
        warehouseId,
        unitsPerApplication: 1,
      },
    ],
  });
  assert.equal(await balance(), 2);
  check(
    'administration corrections preserve history, avoid repeated consumption, reconcile lots once, reject stale edits and support assignment outside card',
  );
  const updated = await save(
    { kind: 'NURSING_NOTE', rows: [{ time: '08:00', note: 'Corrección sintética' }] },
    { correctionOf: note.id, correctionReason: 'Corrección de texto QA' },
  );
  assert.equal(updated.version, 2);
  await assert.rejects(
    save(
      { kind: 'NURSING_NOTE', rows: [{ time: '08:00', note: 'Intento obsoleto' }] },
      { correctionOf: note.id, correctionReason: 'QA' },
    ),
  );
  await assert.rejects(
    transaction(pool, actor, (c) =>
      c.query('UPDATE analiza.clinical_records SET body=body WHERE organization_id=$1 AND id=$2', [
        actor.organizationId,
        note.id,
      ]),
    ),
  );
  check('append-only corrections preserve originals and reject stale updates');
  await assert.rejects(
    saveClinicalRecord(pool, foreign, {
      command: 'clinical.record',
      record: {
        id: randomUUID(),
        patientId,
        caseId,
        date,
        payload: { kind: 'INDICATION', summary: 'Foreign attempt' },
      },
    }),
  );
  const foreignRecords = await transaction(pool, foreign, (c) => listClinicalRecords(c, foreign));
  assert.equal(
    foreignRecords.some((record) => record.patientId === patientId),
    false,
  );
  assert.equal(
    (await pool.query('SELECT count(*)::int AS n FROM analiza.clinical_records')).rows[0].n,
    0,
  );
  check('cross-organization write and read isolation plus fail-closed RLS');
  const persisted = await transaction(pool, actor, (c) => listClinicalRecords(c, actor));
  const records = persisted.filter((record) => record.patientId === patientId);
  assert.equal(medicationReturns(records).length, 3);
  const finance = await backend.operations.list({
    ...actor,
    userId: 'qa-finance',
    role: 'FINANCE',
  });
  assert.equal(finance.clinicalRecords.length, 0);
  assert.ok(finance.medicationReturns.some((item) => item.patientId === patientId));
  await transaction(pool, actor, async (c) => {
    const quote = await c.query(
      'SELECT body FROM analiza.quotes WHERE organization_id=$1 AND id=$2',
      [actor.organizationId, quoteId],
    );
    assert.equal(quote.rows[0].body.total, 3);
  });
  check('receivable returns without clinical disclosure or sent-quote mutation');
  await transaction(pool, actor, async (c) => {
    const rows = await c.query(
      'SELECT body FROM analiza.inventory_movements WHERE organization_id=$1 AND item_id=$2',
      [actor.organizationId, itemId],
    );
    for (const row of rows.rows) inventoryMovementSchema.parse(row.body);
  });
  check('all generated inventory movements remain readable through the strict contract');
  const rule = {
    id: `stock-rule-${run}`,
    category: 'MEDICATION_STOCK',
    label: 'Medicamento sintético QA',
    active: true,
    inventoryItemId: itemId,
    warehouseId,
    unitsPerApplication: 2,
  };
  await assert.rejects(
    backend.operations.execute(foreign, { command: 'configuration.save', entry: rule }),
    /organización/,
  );
  await backend.operations.execute(actor, { command: 'configuration.save', entry: rule });
  await assert.rejects(
    backend.operations.execute(actor, {
      command: 'configuration.save',
      entry: { ...rule, id: `duplicate-${run}` },
    }),
    /ya tiene configuración/,
  );
  await assert.rejects(
    backend.operations.execute(actor, {
      command: 'configuration.save',
      entry: { ...rule, warehouseId: 'foreign-warehouse' },
    }),
    /organización/,
  );
  await transaction(pool, actor, async (c) => {
    const movement = inventoryMovementSchema.parse({
      id: `schedule-entry-${run}`,
      itemId,
      warehouseId,
      kind: 'ENTRY',
      quantity: 20,
      createdAt: `${date}T09:00:00Z`,
      reason: 'Entrada sintética para horarios',
      user: actor.userId,
      traceRecordId: traceIds[1],
      traceNumber: traceIds[1].toUpperCase(),
    });
    await c.query(
      'UPDATE analiza.inventory_trace_balances SET quantity=quantity+20 WHERE organization_id=$1 AND trace_record_id=$2 AND warehouse_id=$3',
      [actor.organizationId, traceIds[1], warehouseId],
    );
    await c.query(
      'INSERT INTO analiza.inventory_movements(organization_id,id,item_id,warehouse_id,idempotency_key,delta,body,trace_record_id) VALUES($1,$2,$3,$4,$2,20,$5::jsonb,$6)',
      [
        actor.organizationId,
        movement.id,
        itemId,
        warehouseId,
        JSON.stringify(movement),
        traceIds[1],
      ],
    );
  });
  const scheduledCard = await save({
    kind: 'MEDICATION_CARD',
    chronic: '',
    instructions: '',
    stock: [],
    schedule: [
      {
        medicationId: `${quoteId}:medicine`,
        times: ['08:00', '16:00', '22:00'],
        dilution: 'Dilución capturada por usuario QA',
      },
    ],
  });
  assert.equal(scheduledCard.medications?.[0].inventoryItemId, itemId);
  assert.deepEqual(scheduledCard.medications?.[0].applicationTimes, ['08:00', '16:00', '22:00']);
  const slots = ['08:00', '16:00', '22:00'].map((scheduledTime, i) => ({
    medicationId: `${quoteId}:medicine`,
    scheduledTime,
    applied: i < 2,
    reason: i < 2 ? '' : 'Omisión sintética',
  }));
  const scheduledPayload = { ...noStockPayload, cardId: scheduledCard.id, items: slots };
  const beforeSlots = await balance();
  const scheduledId = randomUUID();
  const scheduledCommand = {
    command: 'clinical.record',
    record: { id: scheduledId, patientId, caseId, date, payload: scheduledPayload },
  };
  const applications = await Promise.all([
    saveClinicalRecord(pool, actor, scheduledCommand),
    saveClinicalRecord(pool, actor, scheduledCommand),
  ]);
  assert.equal(applications[0].id, applications[1].id);
  assert.equal(await balance(), beforeSlots - 4);
  assert.equal(new Set(applications[0].stockMovementIds).size, 2);
  assert.equal(
    applications[0].payload.kind === 'ADMINISTRATION' &&
      applications[0].payload.stock?.[0].unitsPerApplication,
    2,
  );
  await assert.rejects(save(scheduledPayload), /ya están registrados/);
  await assert.rejects(
    save({ ...scheduledPayload, items: [{ ...slots[0], scheduledTime: '09:00' }] }),
    /hora de aplicación/,
  );
  await assert.rejects(
    save({
      ...scheduledPayload,
      items: [{ medicationId: slots[0].medicationId, applied: true, reason: '' }],
    }),
    /hora de aplicación/,
  );
  await backend.operations.execute(actor, {
    command: 'configuration.save',
    entry: { ...rule, unitsPerApplication: 3 },
  });
  const correctedSlots = await save(
    {
      ...scheduledPayload,
      items: slots.map((slot, i) =>
        i === 0 ? { ...slot, applied: false, reason: 'Corrección de primera hora' } : slot,
      ),
    },
    { correctionOf: scheduledId, correctionReason: 'Corrección sintética por horario' },
  );
  assert.equal(await balance(), beforeSlots - 2);
  assert.deepEqual(
    correctedSlots.stockByApplication?.[medicationApplicationKey(slots[1])],
    applications[0].stockByApplication?.[medicationApplicationKey(slots[1])],
  );
  assert.equal(medicationReturns([applications[0], correctedSlots]).length, 2);
  const nextDate = '2026-11-04';
  const concurrentSlots = await Promise.allSettled([
    save({ ...scheduledPayload, items: [slots[0]] }, { date: nextDate }),
    save({ ...scheduledPayload, items: [slots[0]] }, { date: nextDate }),
  ]);
  assert.equal(concurrentSlots.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await balance(), beforeSlots - 5);
  await backend.operations.execute(actor, {
    command: 'configuration.save',
    entry: { ...rule, unitsPerApplication: 100 },
  });
  const beforeRejected = await balance();
  await assert.rejects(
    save({ ...scheduledPayload, items: [slots[1]] }, { date: nextDate }),
    /vigentes suficientes/,
  );
  assert.equal(await balance(), beforeRejected);
  await backend.operations.execute(actor, {
    command: 'configuration.save',
    entry: { ...rule, unitsPerApplication: 2 },
  });
  check(
    'scheduled applications resolve configured stock, deduplicate retries and concurrent slots, preserve per-slot corrections and reject invalid hours or insufficient stock',
  );
  check(
    'medication stock configuration enforces organization, unique medicine and immutable consumed rule snapshots',
  );
  console.log(
    JSON.stringify({
      status: 'PASS',
      checks: evidence,
      records: records.length,
      syntheticPatientId: patientId,
      syntheticCaseId: caseId,
    }),
  );
} finally {
  await closePostgresPool();
}
