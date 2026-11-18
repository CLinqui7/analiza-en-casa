/** Synthetic-only integration: the deployed application role, RLS, concurrent commands and real SQL. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  patientSchema,
  quoteSchema,
  catalogItemSchema,
  paymentSchema,
} from '../packages/contracts/src/index';
import { createQuoteRevision } from '../packages/domain/src/index';
import {
  postgresPool,
  transaction,
  closePostgresPool,
} from '../apps/web/src/server/persistence/postgres-pool';
import { postgresPersistence } from '../apps/web/src/server/persistence/postgres';
import { postgresFiles } from '../apps/web/src/server/persistence/postgres-files';
import { PostgresSupplyRequestRepository } from '../apps/web/src/server/persistence/postgres-supply-requests';
import {
  assignSupplyRequest,
  prequoteInbox,
  receivedOrders,
  deliverReceivedOrder,
} from '../apps/web/src/server/persistence/postgres-quote-fulfillment';
import { latestLogicalQuotes, quoteWorkflowStatus } from '../apps/web/src/lib/quote-workflow';
import { caseQuotes } from '../apps/web/src/lib/clinical-queries';
import { receivableAccounts } from '../apps/web/src/lib/receivables';

assert.equal(process.env.ANALIZA_QA_MODE, '1');
assert.equal(process.env.PGDATABASE, 'analiza_qa');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.notEqual(process.env.PGUSER, 'postgres');
const pool = postgresPool(),
  backend = postgresPersistence();
const actor = { userId: 'qa-admin', organizationId: 'qa-org-a', role: 'ADMIN' as const };
const nurse = { ...actor, userId: 'qa-nurse', role: 'NURSE' as const };
const foreign = { userId: 'qa-foreign', organizationId: 'qa-org-c', role: 'ADMIN' as const };
const run = randomUUID().slice(0, 8),
  now = new Date().toISOString();
const patientId = `nov17-p-${run}`,
  itemId = `nov17-item-${run}`,
  doctorId = `nov17-doctor-${run}`;
const checks: string[] = [];
const pass = (name: string) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
const requestRepo = new PostgresSupplyRequestRepository(pool);
async function storedQuote(id: string) {
  return (await backend.quotes.get(actor, id))!;
}
try {
  const role = (
    await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')
  ).rows[0];
  assert.equal(role.rolsuper, false);
  assert.equal(role.rolbypassrls, false);
  const dependentId = randomUUID();
  const patient = patientSchema.parse({
    id: patientId,
    fullName: `Paciente sintético Nov17 ${run}`,
    documentType: 'OTHER',
    documentId: `NOV17-${run}`,
    referralOrigin: 'FAMILY_FRIENDS',
    dependents: [
      {
        id: dependentId,
        firstNames: 'Hija',
        lastNames: 'Sintética',
        gender: 'F',
        birthDate: '2020-02-29',
      },
    ],
  });
  await backend.patients.create(actor, { patient });
  assert.equal((await backend.patients.get(actor, patientId))?.dependents?.[0].id, dependentId);
  const storage = new Map<string, Uint8Array>();
  const filePatientId = `${patientId}-files`;
  await backend.patients.create(actor, {
    patient: { ...patient, id: filePatientId, documentId: `NOV17-FILES-${run}` },
  });
  const files = postgresFiles(pool, () => ({
    putObject: async ({ storageKey, bytes }) => {
      storage.set(storageKey, bytes);
    },
    getObject: async (key) => storage.get(key) ?? null,
  }));
  const fileInput = {
    ownerType: 'patient' as const,
    ownerId: filePatientId,
    name: 'partida-sintetica.pdf',
    mimeType: 'application/pdf',
    bytes: new Uint8Array([37, 80, 68, 70]),
    dependentId,
    documentKind: 'BIRTH_CERTIFICATE' as const,
  };
  const uploaded = await files.upload(actor, fileInput);
  assert.equal(
    (await files.listForOwner(actor, 'patient', filePatientId))[0].dependentId,
    dependentId,
  );
  assert.deepEqual((await files.download(actor, uploaded.id))?.bytes, fileInput.bytes);
  assert.equal(await files.download(foreign, uploaded.id), null);
  await assert.rejects(files.upload(actor, { ...fileInput, dependentId: randomUUID() }));
  await assert.rejects(files.upload(foreign, fileInput));
  pass('dependent persistence, private document association, bytes and cross-tenant denial');
  await backend.doctors.create(actor, {
    doctor: {
      id: doctorId,
      fullName: `Médico sintético Nov17 ${run}`,
      specialty: 'Especialidad sintética',
      landlinePhone: '0000-0000',
      referralCategory: 'NEW',
      attachments: [],
    },
  });
  const item = catalogItemSchema.parse({
    id: itemId,
    sku: `N17-${run}`,
    name: `Insumo sintético Nov17 ${run}`,
    category: 'SUPPLIES',
    status: 'ACTIVE',
    createdAt: now,
    salePriceExcludingTax: 10,
  });
  await transaction(pool, actor, async (c) => {
    await c.query(
      'INSERT INTO analiza.catalog_items(organization_id,id,body) VALUES($1,$2,$3::jsonb)',
      [actor.organizationId, item.id, JSON.stringify(item)],
    );
  });
  const qid = `nov17-q-${run}`;
  const draft = await backend.quotes.create(actor, {
    quote: quoteSchema.parse({
      id: qid,
      patientId,
      status: 'DRAFT',
      immutable: false,
      version: 1,
      summary: 'Cotización sintética Nov17',
      careSetting: 'HOSPITALIZATION',
      primaryDoctorId: doctorId,
      admissionDate: '2026-11-17',
      createdAt: now,
      items: [
        {
          id: `line-${run}`,
          name: item.name,
          category: 'SUPPLIES',
          inventoryItemId: itemId,
          quantity: 2,
          unitPrice: 10,
          discountAmount: 0,
        },
      ],
      discount: { type: 'CATEGORY_PERCENTAGES', value: 10, categories: { SUPPLIES: 10 } },
    }),
  });
  const first = await backend.quotes.send(actor, draft.id, 1);
  const payment = paymentSchema.parse({
    id: randomUUID(),
    quoteId: first.id,
    amount: 5,
    paymentMethod: 'CASH',
    idempotencyKey: randomUUID(),
    status: 'APPLIED',
    createdAt: now,
  });
  await backend.operations.execute(actor, { command: 'payment.apply', payment });
  const request = await requestRepo.create(nurse, {
    idempotencyKey: randomUUID(),
    patientId,
    catalogItemId: itemId,
    quantity: 3,
    priority: 'MEDIUM',
    note: 'Solicitud sintética de integración',
  });
  const assignment = {
    idempotencyKey: randomUUID(),
    requestId: request.id,
    quoteId: first.id,
    expectedRecordVersion: 2,
    expectedUnitPrice: 10,
  };
  const [assigned, replay] = await Promise.all([
    assignSupplyRequest(pool, actor, assignment),
    assignSupplyRequest(pool, actor, assignment),
  ]);
  assert.equal(assigned.quoteId, replay.quoteId);
  const second = await storedQuote(assigned.quoteId);
  assert.equal(second.total, 45);
  assert.equal(second.status, 'SENT');
  assert.deepEqual(await storedQuote(first.id), first);
  assert.equal(second.items.filter((line) => line.id === `supply-request-${request.id}`).length, 1);
  const accounts = receivableAccounts([first, second], [payment]);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].balance, 40);
  assert.equal(latestLogicalQuotes([first, second]).length, 1);
  assert.equal(
    (await requestRepo.list(nurse)).find((entry) => entry.id === request.id)?.status,
    'ASSIGNED',
  );
  pass(
    'concurrent request assignment creates one line/revision, keeps snapshot, discount and prior payment',
  );
  await assert.rejects(assignSupplyRequest(pool, foreign, assignment));
  await assert.rejects(assignSupplyRequest(pool, nurse, assignment));
  await assert.rejects(prequoteInbox(pool, nurse, 1));
  const otherPatientId = `nov17-other-${run}`;
  await backend.patients.create(actor, {
    patient: { ...patient, id: otherPatientId, documentId: `NOV17-OTHER-${run}`, dependents: [] },
  });
  const otherRequest = await requestRepo.create(nurse, {
    idempotencyKey: randomUUID(),
    patientId: otherPatientId,
    catalogItemId: itemId,
    quantity: 1,
    priority: 'LOW',
    note: '',
  });
  const scoped = await prequoteInbox(pool, actor, 999, request.id);
  assert.equal(scoped.total, 1);
  assert.deepEqual(scoped.entries.map((entry) => entry.id), [request.id]);
  assert.ok(scoped.quotes.some((quote) => quote.id === second.id));
  assert.ok(scoped.quotes.every((quote) => quote.patientId === patientId));
  assert.deepEqual((await prequoteInbox(pool, actor, 1, otherRequest.id)).quotes, []);
  const foreignScope = await prequoteInbox(pool, foreign, 1, request.id);
  assert.deepEqual(foreignScope.entries, []);
  assert.deepEqual(foreignScope.quotes, []);
  assert.equal(foreignScope.total, 0);
  await assert.rejects(prequoteInbox(pool, nurse, 1, request.id));
  pass('request-specific quote refresh ignores inbox pagination and isolates patient, organization and role');
  await assert.rejects(
    assignSupplyRequest(pool, actor, {
      ...assignment,
      requestId: otherRequest.id,
      quoteId: second.id,
      expectedRecordVersion: 1,
      idempotencyKey: randomUUID(),
    }),
  );
  const nextRequest = await requestRepo.create(nurse, {
    idempotencyKey: randomUUID(),
    patientId,
    catalogItemId: itemId,
    quantity: 1,
    priority: 'LOW',
    note: '',
  });
  await assert.rejects(
    assignSupplyRequest(pool, actor, {
      ...assignment,
      requestId: nextRequest.id,
      quoteId: second.id,
      expectedRecordVersion: 1,
      expectedUnitPrice: 9,
      idempotencyKey: randomUUID(),
    }),
  );
  await transaction(pool, actor, async (c) => {
    await c.query(
      "UPDATE analiza.catalog_items SET body=body-'salePriceExcludingTax' WHERE organization_id=$1 AND id=$2",
      [actor.organizationId, itemId],
    );
  });
  await assert.rejects(
    assignSupplyRequest(pool, actor, {
      ...assignment,
      requestId: nextRequest.id,
      quoteId: second.id,
      expectedRecordVersion: 1,
      idempotencyKey: randomUUID(),
    }),
  );
  await transaction(pool, actor, async (c) => {
    await c.query(
      'UPDATE analiza.catalog_items SET body=$3::jsonb WHERE organization_id=$1 AND id=$2',
      [actor.organizationId, itemId, JSON.stringify(item)],
    );
  });
  pass(
    'assignment rejects missing/changed price, wrong patient, wrong tenant and unauthorized nurse',
  );
  const stockBefore = await transaction(
    pool,
    actor,
    async (c) =>
      (
        await c.query(
          'SELECT count(*)::integer AS count FROM analiza.inventory_movements WHERE organization_id=$1 AND item_id=$2',
          [actor.organizationId, itemId],
        )
      ).rows[0].count,
  );
  const delivery = {
    idempotencyKey: randomUUID(),
    quoteId: second.id,
    lineId: second.items[0].id,
    nursingResourceId: 'qa-resource',
    quantity: 2,
  };
  const outcomes = await Promise.allSettled([
    deliverReceivedOrder(pool, actor, delivery),
    deliverReceivedOrder(pool, actor, { ...delivery, idempotencyKey: randomUUID() }),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  if (outcomes[0].status === 'fulfilled')
    assert.equal((await deliverReceivedOrder(pool, actor, delivery)).alreadyDelivered, true);
  await assert.rejects(deliverReceivedOrder(pool, foreign, delivery));
  await assert.rejects(deliverReceivedOrder(pool, nurse, delivery));
  await assert.rejects(
    deliverReceivedOrder(pool, actor, {
      ...delivery,
      idempotencyKey: randomUUID(),
      lineId: second.items[1].id,
      nursingResourceId: 'foreign-nurse',
    }),
  );
  const stockAfter = await transaction(
    pool,
    actor,
    async (c) =>
      (
        await c.query(
          'SELECT count(*)::integer AS count FROM analiza.inventory_movements WHERE organization_id=$1 AND item_id=$2',
          [actor.organizationId, itemId],
        )
      ).rows[0].count,
  );
  assert.equal(stockAfter, stockBefore);
  const orders = await receivedOrders(pool, actor, 1);
  const deliveredLine = orders.entries.find(
    (entry) => entry.quoteId === second.id && entry.lineId === delivery.lineId,
  )!;
  assert.equal(deliveredLine.delivered, 2);
  assert.equal(deliveredLine.deliveries.length, 1);
  pass(
    'delivery is bounded, concurrent-safe, tenant/role scoped, nurse validated and leaves stock unchanged',
  );
  const revision = createQuoteRevision(second, randomUUID(), 'Edición sintética de integración');
  await assert.rejects(
    backend.quotes.reviseSent!(actor, second.id, {
      quote: { ...revision, items: revision.items.slice(1) },
    }),
  );
  const third = await backend.quotes.reviseSent!(actor, second.id, {
    quote: {
      ...revision,
      items: revision.items.map((line, index) => (index === 1 ? { ...line, quantity: 4 } : line)),
    },
  });
  assert.equal(third.total, 54);
  assert.equal(third.status, 'SENT');
  assert.equal(third.rootQuoteId, first.id);
  assert.equal(receivableAccounts([first, second, third], [payment])[0].balance, 49);
  assert.deepEqual(await storedQuote(second.id), second);
  await assert.rejects(backend.quotes.reviseSent!(actor, second.id, { quote: revision }));
  assert.equal(
    (await receivedOrders(pool, actor, 1)).entries.find(
      (entry) => entry.quoteId === third.id && entry.lineId === delivery.lineId,
    )?.delivered,
    2,
  );
  pass(
    'sent edit keeps one logical quote/account, prior snapshots and deliveries; stale/removed delivered lines reject',
  );
  const approvalId = randomUUID();
  const admission = await backend.hospitalizations.create(actor, {
    hospitalization: {
      id: `nov17-admission-${run}`,
      patientId,
      startDate: '2026-11-17',
      status: 'ACTIVE',
      accountType: 'PARTICULAR',
      priority: 'MEDIUM',
      linkedQuoteIds: [third.id],
      primaryDoctorId: doctorId,
    },
  });
  await transaction(pool, actor, async (c) => {
    await c.query(
      'INSERT INTO analiza.quote_decisions(organization_id,id,quote_id,actor_user_id,decision) VALUES($1,$2,$3,$4,$5)',
      [actor.organizationId, approvalId, third.id, actor.userId, 'APPROVED'],
    );
  });
  await assert.rejects(
    backend.quotes.reviseSent!(actor, third.id, {
      quote: createQuoteRevision(third, randomUUID(), 'Intento cerrado'),
    }),
  );
  await assert.rejects(
    backend.quotes.create(actor, {
      quote: createQuoteRevision(third, randomUUID(), 'Intento cerrado'),
    }),
  );
  await assert.rejects(
    assignSupplyRequest(pool, actor, {
      ...assignment,
      quoteId: third.id,
      requestId: nextRequest.id,
      expectedRecordVersion: 1,
      idempotencyKey: randomUUID(),
    }),
  );
  const approvedChoice = (await prequoteInbox(pool, actor, 1)).quotes.find(
    (q) => q.rootId === first.id,
  )!;
  assert.equal(approvedChoice.status, 'APPROVED');
  assert.equal(approvedChoice.approvalDecisionId, approvalId);
  pass('approved family blocks general edits and requires explicit extension confirmation');
  const extensionRequest = await requestRepo.create(nurse, {
    idempotencyKey: randomUUID(),
    patientId,
    catalogItemId: itemId,
    quantity: 1,
    priority: 'LOW',
    note: '',
  });
  const extension = {
    ...assignment,
    idempotencyKey: randomUUID(),
    quoteId: third.id,
    requestId: extensionRequest.id,
    expectedRecordVersion: approvedChoice.recordVersion,
    approvedExtension: {
      decisionId: approvalId,
      reason: 'Insumos adicionales solicitados por enfermería QA',
    },
  };
  await assert.rejects(
    assignSupplyRequest(pool, actor, {
      ...extension,
      approvedExtension: { ...extension.approvedExtension, reason: ' ' },
    }),
  );
  await assert.rejects(
    assignSupplyRequest(pool, actor, {
      ...extension,
      approvedExtension: { ...extension.approvedExtension, decisionId: randomUUID() },
    }),
  );
  await assert.rejects(assignSupplyRequest(pool, foreign, extension));
  await assert.rejects(assignSupplyRequest(pool, nurse, extension));
  const decisionBefore = await transaction(
    pool,
    actor,
    async (c) =>
      (
        await c.query('SELECT * FROM analiza.quote_decisions WHERE organization_id=$1 AND id=$2', [
          actor.organizationId,
          approvalId,
        ])
      ).rows,
  );
  const extended = await Promise.all([
    assignSupplyRequest(pool, actor, extension),
    assignSupplyRequest(pool, actor, extension),
  ]);
  assert.equal(extended[0].quoteId, extended[1].quoteId);
  const fourth = await storedQuote(extended[0].quoteId);
  assert.equal(fourth.total, 63);
  assert.equal(fourth.caseId, admission.id);
  assert.equal(fourth.version, third.version + 1);
  assert.equal(fourth.status, 'SENT');
  assert.equal(fourth.immutable, true);
  assert.deepEqual(fourth.items.slice(0, -1), third.items);
  assert.deepEqual(await storedQuote(third.id), third);
  assert.deepEqual(await backend.hospitalizations.get(actor, admission.id), admission);
  assert.deepEqual(
    await transaction(
      pool,
      actor,
      async (c) =>
        (
          await c.query(
            'SELECT * FROM analiza.quote_decisions WHERE organization_id=$1 AND id=$2',
            [actor.organizationId, approvalId],
          )
        ).rows,
    ),
    decisionBefore,
  );
  assert.equal(receivableAccounts([first, second, third, fourth], [payment])[0].balance, 58);
  assert.equal(latestLogicalQuotes([first, second, third, fourth]).length, 1);
  assert.equal(
    quoteWorkflowStatus(
      fourth,
      [first, second, third, fourth],
      [{ id: approvalId, quoteId: third.id, decision: 'APPROVED', reason: null, createdAt: now }],
    ),
    'APPROVED',
  );
  assert.equal(caseQuotes([first, second, third, fourth], admission)[0].id, fourth.id);
  await transaction(pool, actor, async (c) => {
    const clinical = await c.query(
      'SELECT id FROM analiza.quotes WHERE organization_id=$1 AND patient_id=$2 AND (case_id=$3 OR id=ANY($4::text[]))',
      [actor.organizationId, patientId, admission.id, admission.linkedQuoteIds],
    );
    assert.ok(clinical.rows.some((row) => row.id === fourth.id));
    assert.equal(
      (
        await c.query(
          "SELECT count(*)::integer AS count FROM analiza.audit_events WHERE organization_id=$1 AND resource_id=$2 AND action='QUOTE_APPROVED_SUPPLIES_EXTENDED'",
          [actor.organizationId, fourth.id],
        )
      ).rows[0].count,
      1,
    );
    assert.equal(
      (
        await c.query(
          'SELECT count(*)::integer AS count FROM analiza.inventory_movements WHERE organization_id=$1 AND item_id=$2',
          [actor.organizationId, itemId],
        )
      ).rows[0].count,
      stockBefore,
    );
  });
  assert.equal(
    (await receivedOrders(pool, actor, 1)).entries.find(
      (entry) => entry.quoteId === fourth.id && entry.lineId === delivery.lineId,
    )?.delivered,
    2,
  );
  await assert.rejects(
    backend.quotes.reviseSent!(actor, fourth.id, {
      quote: createQuoteRevision(fourth, randomUUID(), 'Edición prohibida'),
    }),
  );
  await assert.rejects(
    assignSupplyRequest(pool, actor, {
      ...extension,
      approvedExtension: {
        ...extension.approvedExtension,
        reason: 'Otro motivo no es el mismo reintento',
      },
    }),
  );
  await assert.rejects(
    assignSupplyRequest(pool, actor, {
      ...extension,
      requestId: nextRequest.id,
      idempotencyKey: randomUUID(),
    }),
  );
  pass(
    'approved extension is atomic/idempotent, keeps approval, admission, snapshots, payments, delivered quantities and stock',
  );
  const rejected = await backend.quotes.create(actor, {
    quote: { ...draft, id: `nov17-rejected-${run}`, rootQuoteId: `nov17-rejected-${run}` },
  });
  await transaction(pool, actor, async (c) => {
    await c.query(
      'INSERT INTO analiza.quote_decisions(organization_id,id,quote_id,actor_user_id,decision,reason) VALUES($1,$2,$3,$4,$5,$6)',
      [actor.organizationId, randomUUID(), rejected.id, actor.userId, 'NOT_APPROVED', 'Rechazo QA'],
    );
  });
  await assert.rejects(
    assignSupplyRequest(pool, actor, {
      ...extension,
      quoteId: rejected.id,
      requestId: nextRequest.id,
      idempotencyKey: randomUUID(),
      expectedRecordVersion: 1,
    }),
  );
  assert.equal(
    (await prequoteInbox(pool, actor, 1)).quotes.some((q) => q.id === rejected.id),
    false,
  );
  assert.deepEqual(await storedQuote(rejected.id), rejected);
  pass('rejected quotes remain excluded and cannot use the approved extension exception');
  const removableDraft = await backend.quotes.create(actor, {
    quote: { ...draft, id: `nov17-remove-${run}`, rootQuoteId: `nov17-remove-${run}` },
  });
  await assignSupplyRequest(pool, actor, {
    ...assignment,
    requestId: nextRequest.id,
    quoteId: removableDraft.id,
    expectedRecordVersion: 1,
    idempotencyKey: randomUUID(),
  });
  const assignedDraft = await storedQuote(removableDraft.id);
  await backend.quotes.replace(actor, removableDraft.id, {
    quote: {
      ...assignedDraft,
      items: assignedDraft.items.filter((line) => line.id !== `supply-request-${nextRequest.id}`),
    },
    expectedVersion: 2,
  });
  const removed = (await prequoteInbox(pool, actor, 1)).entries.find(
    (entry) => entry.id === nextRequest.id,
  )!;
  assert.equal(removed.assignmentPresent, false);
  assert.equal(removed.currentQuoteId, removableDraft.id);
  assert.equal(
    (await requestRepo.list(nurse)).find((entry) => entry.id === nextRequest.id)?.status,
    'REMOVED',
  );
  const emptyPage = await receivedOrders(pool, actor, 999);
  assert.equal(emptyPage.entries.length, 0);
  assert.ok(emptyPage.total > 0);
  pass(
    'removed unfulfilled assignment is explicit in both inboxes; empty pagination retains total',
  );
  const result = {
    status: 'PASS',
    checks,
    patientId,
    doctorId,
    itemId,
    quoteId: third.id,
    originalQuoteId: first.id,
  };
  if (process.env.NOV17_QA_RESULT)
    writeFileSync(process.env.NOV17_QA_RESULT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await closePostgresPool();
}
