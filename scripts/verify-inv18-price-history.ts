/** Targeted history regression using only the isolated QA application role. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { quoteSchema, type CatalogItem } from '../packages/contracts/src/index';
import { createQuoteRevision } from '../packages/domain/src/index';
import { postgresPersistence } from '../apps/web/src/server/persistence/postgres';
import { closePostgresPool, postgresPool } from '../apps/web/src/server/persistence/postgres-pool';
import { PostgresSupplyRequestRepository } from '../apps/web/src/server/persistence/postgres-supply-requests';
import { assignSupplyRequest } from '../apps/web/src/server/persistence/postgres-quote-fulfillment';

assert.equal(process.env.PGDATABASE, 'analiza_qa');
assert.equal(process.env.ANALIZA_QA_MODE, '1');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.notEqual(process.env.PGUSER, 'postgres');
const { patientId } = JSON.parse(readFileSync(process.env.NOV17_QA_RESULT!, 'utf8'));
const actor = { userId: 'qa-admin', organizationId: 'qa-org-a', role: 'ADMIN' as const };
const pool = postgresPool(),
  backend = postgresPersistence(),
  requests = new PostgresSupplyRequestRepository(pool);
const now = new Date().toISOString();
const item: CatalogItem = {
  id: randomUUID(),
  sku: randomUUID(),
  name: 'Insumo de prueba histórica',
  category: 'SUPPLIES',
  createdAt: now,
  status: 'ACTIVE',
};
const free: CatalogItem = {
  ...item,
  id: randomUUID(),
  sku: randomUUID(),
  salePriceExcludingTax: 0,
};
async function catalog(product: CatalogItem) {
  return backend.operations.execute(actor, { command: 'catalog.save', item: product });
}
async function pending(quoteId: string, catalogId: string, version: number, confirmed = false) {
  const req = await requests.create(actor, {
    idempotencyKey: randomUUID(),
    patientId,
    catalogItemId: catalogId,
    quantity: 2,
    priority: 'LOW',
    note: '',
  });
  return assignSupplyRequest(pool, actor, {
    idempotencyKey: randomUUID(),
    requestId: req.id,
    quoteId,
    expectedRecordVersion: version,
    expectedUnitPrice: 0,
    priceSource: confirmed ? 'CATALOG' : 'PENDING',
  });
}
async function draft() {
  return backend.quotes.create(actor, {
    quote: quoteSchema.parse({
      id: randomUUID(),
      version: 1,
      patientId,
      status: 'DRAFT',
      summary: 'Prueba aislada de precios',
      createdAt: now,
    }),
  });
}
try {
  await catalog(item);
  await catalog(free);
  const initial = await draft();
  await pending(initial.id, item.id, 1);
  const pureDraft = await draft();
  await pending(pureDraft.id, item.id, 1);
  const pricedZero = await draft();
  await pending(pricedZero.id, free.id, 1, true);
  const sent = await backend.quotes.send(actor, initial.id, 2);
  const open = await backend.quotes.create(actor, {
    quote: {
      ...createQuoteRevision(sent, randomUUID(), 'Trabajo en curso'),
      summary: 'Edición en curso',
    },
  });
  await catalog({ ...item, salePriceExcludingTax: 4.5 });
  await catalog({ ...free, salePriceExcludingTax: 9 });
  await catalog({ ...item, salePriceExcludingTax: 12 });
  const all = (await backend.quotes.listWithVersions(actor)).map((r) => r.quote);
  const issued = all
    .filter((q) => q.rootQuoteId === sent.id && q.status === 'SENT')
    .sort((a, b) => a.version - b.version);
  assert.deepEqual(issued[0], sent);
  assert.equal(issued.length, 2);
  assert.equal(issued[1].version, 2);
  assert.equal(issued[1].total, 9);
  const working = all.find((q) => q.id === open.id)!;
  assert.equal(working.version, 3);
  assert.equal(working.total, 9);
  assert.equal(working.status, 'DRAFT');
  assert.equal(working.summary, 'Edición en curso');
  assert.equal(all.find((q) => q.id === pureDraft.id)?.total, 9);
  assert.equal(all.find((q) => q.id === pricedZero.id)?.total, 0);
  assert.equal(all.filter((q) => q.rootQuoteId === pureDraft.id).length, 1);
  console.log(
    'PASS draft-only repricing, concurrent draft and receivable history, intentional zero, later catalogue increases leave confirmed prices intact',
  );
} finally {
  await closePostgresPool();
}
