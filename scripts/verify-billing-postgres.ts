/** Dedicated, synthetic PostgreSQL only. No production connection is accepted. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  patientSchema,
  quoteSchema,
  paymentSchema,
  catalogItemSchema,
} from '../packages/contracts/src/index';
import {
  postgresPool,
  transaction,
  closePostgresPool,
} from '../apps/web/src/server/persistence/postgres-pool';
import { postgresPersistence } from '../apps/web/src/server/persistence/postgres';
import { receivableAccounts, balanceForQuote } from '../apps/web/src/lib/receivables';

assert.equal(process.env.ANALIZA_QA_MODE, '1');
assert.equal(process.env.PGDATABASE, 'analiza_qa');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.notEqual(process.env.PGUSER, 'postgres');
const pool = postgresPool(),
  backend = postgresPersistence();
const actor = { userId: 'qa-admin', organizationId: 'qa-org-a', role: 'ADMIN' as const };
const foreign = { userId: 'qa-foreign', organizationId: 'qa-org-c', role: 'ADMIN' as const };
const nurse = { ...actor, userId: 'qa-nurse', role: 'NURSE' as const };
const run = randomUUID().slice(0, 8),
  patientId = `billing-qa-p-${run}`,
  quoteId = `billing-qa-q-${run}`,
  itemId = `billing-qa-item-${run}`;
const checks: string[] = [];
function pass(name: string) {
  checks.push(name);
  console.log('PASS ' + name);
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
      fullName: 'Paciente sintético facturación ' + run,
      documentType: 'OTHER',
      documentId: 'QA-' + run,
      phone: '0000-0000',
      status: 'ACTIVE',
      referralOrigin: 'FAMILY_FRIENDS',
      insurer: 'Aseguradora anterior QA',
    });
    await c.query(
      'INSERT INTO analiza.patients(organization_id,id,document_key,body) VALUES($1,$2,$3,$4::jsonb)',
      [actor.organizationId, patientId, 'QA-' + run, JSON.stringify(patient)],
    );
    const item = catalogItemSchema.parse({
      id: itemId,
      sku: itemId,
      name: 'Servicio sintético QA',
      category: 'SERVICES',
      status: 'ACTIVE',
      salePriceExcludingTax: 20,
      createdAt: new Date().toISOString(),
    });
    await c.query(
      'INSERT INTO analiza.catalog_items(organization_id,id,body) VALUES($1,$2,$3::jsonb)',
      [actor.organizationId, itemId, JSON.stringify(item)],
    );
  });
  let first = await backend.quotes.create(actor, {
    quote: quoteSchema.parse({
      id: quoteId,
      patientId,
      version: 1,
      status: 'DRAFT',
      accountType: 'PARTICULAR',
      summary: 'Facturación sintética',
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'line',
          category: 'SERVICES',
          name: 'Servicio sintético QA',
          inventoryItemId: itemId,
          quantity: 5,
          unitPrice: 20,
          discountAmount: 0,
        },
      ],
    }),
  });
  assert.equal(first.total, 100);
  for (const key of ['version', 'rootQuoteId', 'originalQuoteId', 'createdAt'] as const)
    await assert.rejects(
      backend.quotes.replace(actor, quoteId, {
        quote: { ...first, [key]: key === 'version' ? 2 : 'altered' },
        expectedVersion: 1,
      }),
    );
  assert.equal((await backend.quotes.get(actor, quoteId))?.version, 1);
  pass('draft version metadata cannot be reassigned');
  first = await backend.quotes.send(actor, quoteId, 1);
  await assert.rejects(
    backend.quotes.replace(actor, quoteId, {
      quote: { ...first, status: 'DRAFT', immutable: false },
      expectedVersion: 2,
    }),
  );
  const payment = paymentSchema.parse({
    id: `billing-qa-payment-${run}`,
    quoteId,
    amount: 40,
    paymentMethod: 'CASH',
    idempotencyKey: `billing-qa-key-${run}`,
    status: 'APPLIED',
    createdAt: new Date().toISOString(),
  });
  const apply = (value: unknown) =>
    backend.operations.execute(actor, { command: 'payment.apply', payment: value });
  await Promise.all([apply(payment), apply(payment)]);
  await assert.rejects(apply({ ...payment, amount: 41 }));
  const paymentRows = await transaction(
    pool,
    actor,
    async (c) =>
      (
        await c.query(
          'SELECT amount_cents FROM analiza.payments WHERE organization_id=$1 AND id=$2',
          [actor.organizationId, payment.id],
        )
      ).rows,
  );
  assert.equal(paymentRows.length, 1);
  assert.equal(Number(paymentRows[0].amount_cents), 4000);
  pass('concurrent replay inserts one payment and conflicting replay is rejected');
  for (const amount of [0.001, 0.014, 0.015, 60.01])
    await assert.rejects(
      apply({ ...payment, id: randomUUID(), idempotencyKey: randomUUID(), amount }),
    );
  await assert.rejects(
    apply({
      ...payment,
      id: randomUUID(),
      idempotencyKey: randomUUID(),
      amount: 1,
      paymentMethod: 'CHECK',
    }),
  );
  await assert.rejects(
    backend.operations.execute(nurse, {
      command: 'payment.apply',
      payment: { ...payment, id: randomUUID(), idempotencyKey: randomUUID(), amount: 1 },
    }),
  );
  await assert.rejects(
    backend.operations.execute(foreign, {
      command: 'payment.apply',
      payment: { ...payment, id: randomUUID(), idempotencyKey: randomUUID(), amount: 1 },
    }),
  );
  assert.equal(await backend.quotes.get(foreign, quoteId), null);
  pass('fractional cents, overpayment, missing reservation, role and tenant boundaries reject');
  let second = await backend.quotes.create(actor, {
    quote: {
      ...first,
      id: quoteId + '-v2',
      version: 2,
      status: 'DRAFT',
      immutable: false,
      sentAt: undefined,
      revisionReason: 'Ampliación sintética',
      createdAt: new Date().toISOString(),
      items: first.items.map((line) => ({ ...line, quantity: 6 })),
    },
  });
  assert.equal(second.total, 120);
  second = await backend.quotes.send(actor, second.id, 1);
  const accounts = receivableAccounts([first, second], [payment]);
  assert.deepEqual(balanceForQuote(second, accounts, [payment]), {
    paid: 40,
    balance: 80,
    version: 2,
  });
  assert.equal((await backend.quotes.get(actor, first.id))?.total, 100);
  await assert.rejects(
    apply({ ...payment, id: randomUUID(), idempotencyKey: randomUUID(), amount: 1 }),
  );
  await apply(payment); // old successful retry must remain valid after a revision
  pass('new sent version replaces charge, preserves prior payment and immutable original');
  const reserved = {
    ...payment,
    id: randomUUID(),
    quoteId: second.id,
    idempotencyKey: randomUUID(),
    amount: 0.29,
    paymentMethod: 'CHECK',
    reference: 'RES-QA',
  };
  await apply(reserved);
  await backend.operations.execute(actor, {
    command: 'payment.void',
    paymentId: reserved.id,
    reason: 'Prueba sintética de reversión',
  });
  await backend.operations.execute(actor, {
    command: 'payment.void',
    paymentId: reserved.id,
    reason: 'Prueba sintética de reversión',
  });
  const auditCounts = await transaction(
    pool,
    actor,
    async (c) =>
      (
        await c.query(
          'SELECT action,count(*)::int AS count FROM analiza.audit_events WHERE organization_id=$1 AND resource_id=$2 GROUP BY action',
          [actor.organizationId, reserved.id],
        )
      ).rows,
  );
  assert.equal(auditCounts.find((r) => r.action === 'PAYMENT_APPLIED')?.count, 1);
  assert.equal(auditCounts.find((r) => r.action === 'PAYMENT_VOIDED')?.count, 1);
  pass('reservation payment and reversal persist once with audit evidence');
  const observation = {
    quoteId,
    status: 'SENT_TO_INSURER',
    note: 'Observación sintética',
    date: new Date().toISOString(),
    idempotencyKey: randomUUID(),
  };
  await assert.rejects(backend.insuranceObservations.recordObservation(actor, observation));
  const insured = await backend.quotes.create(actor, {
    quote: {
      ...first,
      id: quoteId + '-insured',
      rootQuoteId: quoteId + '-insured',
      originalQuoteId: quoteId + '-insured',
      version: 1,
      status: 'DRAFT',
      immutable: false,
      sentAt: undefined,
      accountType: 'SEGURO',
      insurer: 'Aseguradora cotización QA',
    },
  });
  const observed = await backend.insuranceObservations.recordObservation(actor, {
    ...observation,
    quoteId: insured.id,
    idempotencyKey: randomUUID(),
  });
  assert.equal(observed.request.insurer, 'Aseguradora cotización QA');
  const edited = await backend.quotes.replace(actor, insured.id, {
    quote: { ...insured, insurer: 'Otra aseguradora QA', summary: 'Cambio de borrador' },
    expectedVersion: 1,
  });
  assert.equal(edited.summary, 'Cambio de borrador');
  const next = await backend.insuranceObservations.recordObservation(actor, {
    ...observation,
    quoteId: insured.id,
    status: 'INSURER_REVIEW',
    idempotencyKey: randomUUID(),
  });
  assert.equal(next.request.insurer, 'Aseguradora cotización QA');
  pass(
    'insurance uses quote payer, excludes private accounts and preserves existing request snapshot',
  );
  const result = {
    status: 'PASS',
    checks,
    patientId,
    quoteId: second.id,
    originalQuoteId: quoteId,
    insuredQuoteId: insured.id,
    expectedPaid: 40,
    expectedBalance: 80,
  };
  if (process.env.BILLING_QA_RESULT)
    writeFileSync(process.env.BILLING_QA_RESULT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await closePostgresPool();
}
