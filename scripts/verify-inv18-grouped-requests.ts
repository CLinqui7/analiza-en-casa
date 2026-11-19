import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { patientSchema, quoteSchema, paymentSchema } from '../packages/contracts/src/index';
import {
  postgresPool,
  transaction,
  closePostgresPool,
} from '../apps/web/src/server/persistence/postgres-pool';
import { postgresPersistence } from '../apps/web/src/server/persistence/postgres';
import { PostgresSupplyRequestRepository } from '../apps/web/src/server/persistence/postgres-supply-requests';
import {
  prequoteInbox,
  assignSupplyRequest,
} from '../apps/web/src/server/persistence/postgres-quote-fulfillment';
import { requestQuoteCategories } from '../apps/web/src/lib/supply-requests';
import { receivableAccounts } from '../apps/web/src/lib/receivables';

assert.equal(process.env.ANALIZA_QA_MODE, '1');
assert.equal(process.env.PGDATABASE, 'analiza_qa');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.notEqual(process.env.PGUSER, 'postgres');
const pool = postgresPool(),
  backend = postgresPersistence(),
  requests = new PostgresSupplyRequestRepository(pool);
const actor = { userId: 'qa-admin', organizationId: 'qa-org-a', role: 'ADMIN' as const };
const nurse = { ...actor, userId: 'qa-nurse', role: 'NURSE' as const };
const foreign = { ...actor, userId: 'qa-foreign', organizationId: 'qa-org-c' };
const run = randomUUID(),
  patientId = 'qa-group-p-' + run,
  doctorId = 'qa-group-d-' + run,
  quoteId = 'qa-group-q-' + run;
const now = new Date().toISOString(),
  decisionId = randomUUID();
const catalog = Object.keys(requestQuoteCategories).map((category, index) => ({
  id: run + category,
  sku: 'QA-' + run + '-' + index,
  name: 'Concepto sintético ' + category,
  category,
  status: 'ACTIVE',
  createdAt: now,
  salePriceExcludingTax: index + 1,
}));
try {
  await backend.patients.create(actor, {
    patient: patientSchema.parse({
      id: patientId,
      fullName: 'Paciente sintético ' + run,
      documentType: 'OTHER',
      documentId: 'QAG-' + run,
      referralOrigin: 'FAMILY_FRIENDS',
    }),
  });
  await backend.doctors.create(actor, {
    doctor: {
      id: doctorId,
      fullName: 'Médico sintético ' + run,
      specialty: 'Especialidad sintética',
      landlinePhone: '0000-0000',
      referralCategory: 'NEW',
      attachments: [],
    },
  });
  await transaction(pool, actor, async (c) => {
    for (const item of catalog)
      await c.query(
        'INSERT INTO analiza.catalog_items(organization_id,id,body) VALUES($1,$2,$3::jsonb)',
        [actor.organizationId, item.id, JSON.stringify(item)],
      );
  });
  const original = await backend.quotes.create(actor, {
    quote: quoteSchema.parse({
      id: quoteId,
      patientId,
      version: 1,
      status: 'DRAFT',
      immutable: false,
      primaryDoctorId: doctorId,
      createdAt: now,
      summary: 'Cotización sintética',
      items: [
        {
          id: 'original',
          category: 'MEDICATIONS',
          inventoryItemId: catalog[0].id,
          name: catalog[0].name,
          unitPrice: 1,
          quantity: 10,
        },
      ],
    }),
  });
  const sent = await backend.quotes.send(actor, original.id, 1);
  const payment = paymentSchema.parse({
    id: randomUUID(),
    quoteId: sent.id,
    amount: 3,
    paymentMethod: 'CASH',
    idempotencyKey: randomUUID(),
    status: 'APPLIED',
    createdAt: now,
  });
  await backend.operations.execute(actor, { command: 'payment.apply', payment });
  await transaction(pool, actor, (c) =>
    c.query(
      "INSERT INTO analiza.quote_decisions(organization_id,id,quote_id,actor_user_id,decision) VALUES ($1,$2,$3,$4,'APPROVED')",
      [actor.organizationId, decisionId, sent.id, actor.userId],
    ),
  );
  const command = {
    idempotencyKey: randomUUID(),
    patientId,
    priority: 'HIGH',
    note: 'Logística sintética',
    products: [
      ...catalog.slice(0, 4).map((item) => ({ catalogItemId: item.id, quantity: 2 })),
      { feeService: 'Visita', quantity: 1, feeAmount: 25 },
    ],
  };
  await assert.rejects(
    requests.create(nurse, {
      ...command,
      products: [...command.products, { catalogItemId: 'no-existe', quantity: 1 }],
    }),
  );
  const [a, b] = await Promise.all([
    requests.create(nurse, command),
    requests.create(nurse, command),
  ]);
  assert.equal(a.id, b.id);
  assert.equal(a.products?.length, 5);
  await assert.rejects(requests.create(nurse, { ...command, products: command.products.slice(1) }));
  const inbox = await prequoteInbox(pool, actor, 1, a.id);
  assert.equal(inbox.entries.length, 1);
  assert.equal(inbox.entries[0].products?.length, 5);
  assert.equal(inbox.quotes[0].status, 'APPROVED');
  const assignment = {
    requestId: a.id,
    quoteId: sent.id,
    expectedRecordVersion: inbox.quotes[0].recordVersion,
    idempotencyKey: randomUUID(),
    expectedUnitPrice: 1,
    priceSource: 'CATALOG',
    expectedProducts: inbox.entries[0].products!.map(({ id, unitPrice }) => ({ id, unitPrice })),
    additions: [
      ...catalog.slice(4).map((item) => ({
        product: { catalogItemId: item.id, quantity: 1 },
        expectedPrice: item.salePriceExcludingTax,
      })),
      { product: { feeService: 'Seguimiento', feeAmount: 15, quantity: 1 }, expectedPrice: 15 },
    ],
    approvedExtension: { decisionId, reason: 'Ampliación de servicios y suministros sintéticos' },
  };
  await assert.rejects(assignSupplyRequest(pool, nurse, assignment));
  await assert.rejects(assignSupplyRequest(pool, foreign, assignment));
  await assert.rejects(
    assignSupplyRequest(pool, actor, {
      ...assignment,
      additions: [{ product: { catalogItemId: catalog[0].id, quantity: 1 }, expectedPrice: 1 }],
    }),
  );
  await assert.rejects(
    assignSupplyRequest(pool, actor, {
      ...assignment,
      additions: [{ product: { catalogItemId: catalog[4].id, quantity: 1 }, expectedPrice: 99 }],
    }),
  );
  assert.equal((await prequoteInbox(pool, actor, 1, a.id)).entries[0].products?.length, 5);
  const [saved, retry] = await Promise.all([
    assignSupplyRequest(pool, actor, assignment),
    assignSupplyRequest(pool, actor, assignment),
  ]);
  assert.equal(saved.quoteId, retry.quoteId);
  assert.notEqual(saved.alreadyAssigned, retry.alreadyAssigned);
  assert.equal((await requests.create(nurse, command)).products?.length, 5);
  await assert.rejects(assignSupplyRequest(pool, actor, { ...assignment, additions: [] }));
  const newest = (await backend.quotes.get(actor, saved.quoteId))!;
  assert.equal(newest.version, sent.version + 1);
  assert.equal(newest.rootQuoteId, sent.rootQuoteId);
  assert.deepEqual(await backend.quotes.get(actor, sent.id), sent);
  const lines = newest.items.slice(1);
  assert.equal(lines.length, 9);
  assert.deepEqual(
    new Set(lines.map((line) => line.category)),
    new Set([...Object.values(requestQuoteCategories), 'FEES']),
  );
  assert.equal(new Set(lines.map((line) => line.id)).size, 9);
  assert.ok(lines.every((line) => line.id.startsWith('supply-request-')));
  assert.ok(
    lines
      .filter((line) => line.category === 'FEES')
      .every((line) => line.doctorId === doctorId && !line.inventoryItemId),
  );
  assert.equal(newest.total, 88); // 10 original + 2*(1+2+3+4) + 5+6+7 + 25+15.
  const ledger = await transaction(pool, actor, async (client) => {
    const versions = await client.query(
      'SELECT body FROM analiza.quotes WHERE organization_id=$1 AND root_quote_id=$2 ORDER BY quote_version',
      [actor.organizationId, sent.id],
    );
    const payments = await client.query(
      'SELECT p.body FROM analiza.payments p JOIN analiza.quotes q ON q.organization_id=p.organization_id AND q.id=p.quote_id WHERE q.organization_id=$1 AND q.root_quote_id=$2',
      [actor.organizationId, sent.id],
    );
    return {
      versions: versions.rows.map((row) => quoteSchema.parse(row.body)),
      payments: payments.rows.map((row) => paymentSchema.parse(row.body)),
    };
  });
  assert.deepEqual(ledger.versions, [sent, newest]);
  assert.deepEqual(ledger.payments, [payment]);
  const accounts = receivableAccounts(ledger.versions, ledger.payments);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].balance, 85);
  const after = (await prequoteInbox(pool, actor, 1, a.id)).entries[0];
  assert.equal(after.products?.length, 9);
  assert.equal(after.assignmentPresent, true);
  assert.equal((await requests.list(nurse)).filter((row) => row.patientId === patientId).length, 1);
  const stock = await transaction(pool, actor, (c) =>
    c.query(
      'SELECT count(*)::int n FROM analiza.inventory_movements WHERE organization_id=$1 AND item_id=ANY($2::text[])',
      [actor.organizationId, catalog.map((item) => item.id)],
    ),
  );
  assert.equal(stock.rows[0].n, 0);
  if (process.env.NOV17_QA_RESULT)
    writeFileSync(
      join(dirname(process.env.NOV17_QA_RESULT), 'inv18-groups.json'),
      JSON.stringify({
        run,
        patientId,
        quoteId: newest.id,
        medicationSku: catalog[0].sku,
        serviceSku: catalog[3].sku,
      }),
    );
  console.log(
    'PASS eight categories, both entry points, one grouped request, all-or-nothing validation, concurrent replay, preserved approval/snapshot/payment, single receivable, no stock movement',
  );
} finally {
  await closePostgresPool();
}
