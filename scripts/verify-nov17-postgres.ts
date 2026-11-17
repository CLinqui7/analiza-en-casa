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
import { latestLogicalQuotes } from '../apps/web/src/lib/quote-workflow';
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
  const files = postgresFiles(pool, () => ({
    putObject: async ({ storageKey, bytes }) => {
      storage.set(storageKey, bytes);
    },
    getObject: async (key) => storage.get(key) ?? null,
  }));
  const fileInput = {
    ownerType: 'patient' as const,
    ownerId: patientId,
    name: 'partida-sintetica.pdf',
    mimeType: 'application/pdf',
    bytes: new Uint8Array([37, 80, 68, 70]),
    dependentId,
    documentKind: 'BIRTH_CERTIFICATE' as const,
  };
  const uploaded = await files.upload(actor, fileInput);
  assert.equal((await files.listForOwner(actor, 'patient', patientId))[0].dependentId, dependentId);
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
          'SELECT count(*)::integer AS count FROM analiza.inventory_movements WHERE organization_id=$1',
          [actor.organizationId],
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
          'SELECT count(*)::integer AS count FROM analiza.inventory_movements WHERE organization_id=$1',
          [actor.organizationId],
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
  await transaction(pool, actor, async (c) => {
    await c.query(
      'INSERT INTO analiza.quote_decisions(organization_id,id,quote_id,actor_user_id,decision) VALUES($1,$2,$3,$4,$5)',
      [actor.organizationId, randomUUID(), third.id, actor.userId, 'APPROVED'],
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
  assert.equal(
    (await prequoteInbox(pool, actor, 1)).quotes.some((q) => q.rootId === first.id),
    false,
  );
  pass('approved family cannot be edited through revision, legacy creation or precotization');
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
