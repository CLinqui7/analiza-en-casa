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
  assert.deepEqual(
    scoped.entries.map((entry) => entry.id),
    [request.id],
  );
  assert.ok(scoped.quotes.some((quote) => quote.id === second.id));
  assert.ok(scoped.quotes.every((quote) => quote.patientId === patientId));
  assert.deepEqual((await prequoteInbox(pool, actor, 1, otherRequest.id)).quotes, []);
  const foreignScope = await prequoteInbox(pool, foreign, 1, request.id);
  assert.deepEqual(foreignScope.entries, []);
  assert.deepEqual(foreignScope.quotes, []);
  assert.equal(foreignScope.total, 0);
  await assert.rejects(prequoteInbox(pool, nurse, 1, request.id));
  pass(
    'request-specific quote refresh ignores inbox pagination and isolates patient, organization and role',
  );
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
  // Nov18: actor-owned responsibility survives forged payloads and revisions.
  const ownerId = `nov18-owner-${run}`;
  const owned = await backend.quotes.create(actor, {
    quote: {
      ...draft,
      id: ownerId,
      rootQuoteId: ownerId,
      originalQuoteId: ownerId,
      manager: 'Nombre ajeno falsificado',
    },
  });
  assert.equal(owned.manager, 'Usuario ficticio ADMIN');
  const ownerEdited = await backend.quotes.replace(actor, ownerId, {
    quote: { ...owned, manager: 'Otro responsable' },
    expectedVersion: 1,
  });
  assert.equal(ownerEdited.manager, owned.manager);
  const ownerSent = await backend.quotes.send(actor, ownerId, 2);
  const ownerRevision = await backend.quotes.reviseSent(actor, ownerId, {
    quote: {
      ...createQuoteRevision(ownerSent, randomUUID(), 'Revisión sintética', now),
      manager: 'Responsable sustituido',
    },
  });
  assert.equal(ownerRevision.manager, owned.manager);
  pass('quote creator resolved on server; forged owner ignored on create, edit and sent revision');

  // Missing catalogue price is supplied explicitly for this request, never invented or saved globally.
  await transaction(pool, actor, async (c) => {
    await c.query(
      "UPDATE analiza.catalog_items SET body=body-'salePriceExcludingTax' WHERE organization_id=$1 AND id=$2",
      [actor.organizationId, itemId],
    );
  });
  const pricedRequest = await requestRepo.create(nurse, {
    idempotencyKey: randomUUID(),
    patientId,
    catalogItemId: itemId,
    quantity: 3,
    priority: 'LOW',
    note: 'Precio confirmado QA',
  });
  const manual = {
    idempotencyKey: randomUUID(),
    requestId: pricedRequest.id,
    quoteId: ownerRevision.id,
    expectedRecordVersion: 1,
    expectedUnitPrice: 0,
    priceSource: 'PENDING',
  };
  await assert.rejects(assignSupplyRequest(pool, actor, { ...manual, priceSource: undefined }));
  await assert.rejects(assignSupplyRequest(pool, nurse, manual));
  await assert.rejects(assignSupplyRequest(pool, foreign, manual));
  await assert.rejects(assignSupplyRequest(pool, actor, { ...manual, expectedUnitPrice: -1 }));
  await assert.rejects(assignSupplyRequest(pool, actor, { ...manual, priceSource: 'MANUAL' }));
  await assert.rejects(assignSupplyRequest(pool, actor, { ...manual, expectedUnitPrice: 7.25 }));
  const [manualResult, zeroReplay] = await Promise.all([
    assignSupplyRequest(pool, actor, manual),
    assignSupplyRequest(pool, actor, manual),
  ]);
  assert.equal(manualResult.quoteId, zeroReplay.quoteId);
  assert.equal((await assignSupplyRequest(pool, actor, manual)).alreadyAssigned, true);
  const manualQuote = await storedQuote(manualResult.quoteId);
  assert.equal(manualQuote.items.at(-1)?.unitPrice, 0);
  assert.equal(manualQuote.items.at(-1)?.quantity, 3);
  assert.equal(manualQuote.total, ownerRevision.total);
  assert.deepEqual(await storedQuote(ownerRevision.id), ownerRevision);
  const manualAudit = await transaction(pool, actor, async (c) => {
    const price = (
      await c.query('SELECT body FROM analiza.catalog_items WHERE organization_id=$1 AND id=$2', [
        actor.organizationId,
        itemId,
      ])
    ).rows[0].body.salePriceExcludingTax;
    assert.equal(price, undefined);
    return (
      await c.query(
        "SELECT count(*)::int AS count FROM analiza.audit_events WHERE organization_id=$1 AND resource_id=$2 AND action='SUPPLY_REQUEST_PRICE_PENDING'",
        [actor.organizationId, pricedRequest.id],
      )
    ).rows[0].count;
  });
  assert.equal(manualAudit, 1);
  await transaction(pool, actor, async (c) => {
    await c.query(
      'UPDATE analiza.catalog_items SET body=$3::jsonb WHERE organization_id=$1 AND id=$2',
      [actor.organizationId, itemId, JSON.stringify(item)],
    );
  });
  // Registering a sale price later does not silently rewrite an issued snapshot,
  // nor charge a request twice when the operator repeats the original action.
  assert.equal((await assignSupplyRequest(pool, actor, manual)).alreadyAssigned, true);
  assert.deepEqual(await storedQuote(manualResult.quoteId), manualQuote);
  const inboxAfterPrice = await prequoteInbox(pool, actor, 1, pricedRequest.id);
  assert.equal(inboxAfterPrice.entries[0].assignedUnitPrice, 0);
  assert.equal(inboxAfterPrice.entries[0].unitPrice, item.salePriceExcludingTax);
  pass(
    'authorized missing price at zero adds quantity once, audits pending price and preserves snapshots after catalogue update',
  );

  // Search applies before pagination, treats wildcard characters literally and stays tenant scoped.
  const searchPatient = `${patientId}-search`;
  await backend.patients.create(actor, {
    patient: {
      ...patient,
      id: searchPatient,
      fullName: `Ángela Búsqueda ${run}`,
      documentId: '99123456-7',
      dependents: [],
    },
  });
  const searchQuoteId = `nov18-search-${run}`;
  await backend.quotes.create(actor, {
    quote: {
      ...draft,
      id: searchQuoteId,
      rootQuoteId: searchQuoteId,
      originalQuoteId: searchQuoteId,
      patientId: searchPatient,
      items: Array.from({ length: 51 }, (_, index) => ({
        ...draft.items[0],
        id: `search-line-${index}`,
      })),
    },
  });
  for (const query of ['ANGELA BUSQUEDA', '99123456-7', '991234567']) {
    const results = await receivedOrders(pool, actor, 1, query);
    assert.equal(results.total, 51);
    assert.equal(results.entries.length, 50);
    assert.ok(results.entries.every((entry) => entry.rootId === searchQuoteId));
    const lastPage = await receivedOrders(pool, actor, 2, query);
    assert.equal(lastPage.entries.length, 1);
    assert.equal(lastPage.total, 51);
    assert.equal((await receivedOrders(pool, foreign, 1, query)).total, 0);
  }
  assert.equal((await receivedOrders(pool, actor, 1, '%')).total, 0);
  assert.equal((await receivedOrders(pool, actor, 1, 'sin coincidencias QA')).total, 0);
  pass(
    'patient search by accents/case/document punctuation across pages, literal wildcards and tenant isolation',
  );
  const unpricedItemId = `nov18-unpriced-${run}`;
  await transaction(pool, actor, async (c) => {
    const unpricedItem = {
      ...item,
      id: unpricedItemId,
      sku: `NOV18-NOPRICE-${run}`,
      name: 'Insumo sin precio sintético Nov18',
      salePriceExcludingTax: undefined,
    };
    await c.query(
      'INSERT INTO analiza.catalog_items(organization_id,id,body) VALUES($1,$2,$3::jsonb)',
      [actor.organizationId, unpricedItemId, JSON.stringify(unpricedItem)],
    );
  });
  const result = {
    status: 'PASS',
    checks,
    patientId,
    doctorId,
    itemId,
    quoteId: third.id,
    originalQuoteId: first.id,
    unpricedItemId,
    searchPatient,
    searchQuoteId,
  };
  if (process.env.NOV17_QA_RESULT)
    writeFileSync(process.env.NOV17_QA_RESULT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await closePostgresPool();
}
