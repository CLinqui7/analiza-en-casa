/** Explicit, resumable financial verification in the operator's synthetic organization only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { request, chromium, expect } from '@playwright/test';
import {
  patientSchema,
  catalogItemSchema,
  quoteSchema,
  paymentSchema,
} from '../packages/contracts/src/index';
import { receivableAccounts } from '../apps/web/src/lib/receivables';

const directory = process.env.EXTRAS18_PRIVATE_DIRECTORY!;
assert.ok(directory && path.relative(process.cwd(), path.resolve(directory)).startsWith('..'));
const account = JSON.parse(fs.readFileSync('C:/Temp/analiza-contabo-private/account.json', 'utf8'));
const organization = '157a0046-7ed7-4bd6-85b8-005431466298',
  user = '3f8cce55-a27b-4b44-92be-e4689613adec';
assert.equal(account.organizationId, organization);
assert.equal(account.userId, user);
// Confirm active membership before using a public session, whose response intentionally omits org ID.
const guard = `set -eu
docker exec -i analiza-contabo-staging-database-1 sh -c 'export PGPASSWORD=$(cat /run/secrets/postgres_password); exec psql -U analiza_migrator -d analiza_live_20261014 -v ON_ERROR_STOP=1 -At' <<'SQL'
BEGIN READ ONLY;
SELECT count(*)=1 AND bool_and(organization_id='${organization}' AND active AND role IN ('ADMIN','WEBMASTER')) FROM analiza.memberships WHERE user_id='${user}';
COMMIT;
SQL
`;
const guardResult = execFileSync(
  'ssh',
  [
    '-T',
    '-i',
    'C:/Temp/analiza-contabo-private/operator.key',
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=yes',
    'root@207.244.227.122',
    'bash',
  ],
  { input: guard, encoding: 'utf8', windowsHide: true },
);
assert.ok(
  guardResult.split(/\r?\n/).includes('t'),
  'Synthetic account must belong exclusively to the approved QA organization',
);
fs.mkdirSync(directory, { recursive: true });
const stateFile = path.join(directory, 'public-financial-state.json');
const state = fs.existsSync(stateFile)
  ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  : {
      run: randomUUID(),
      requestKey: randomUUID(),
      assignmentKey: randomUUID(),
      paymentKey: randomUUID(),
    };
fs.writeFileSync(stateFile, JSON.stringify(state));
const id = 'extras18-qa-' + state.run,
  patientId = id + '-patient',
  quoteId = id + '-quote',
  itemId = id + '-item';
const baseURL = 'https://analiza.207.244.227.122.sslip.io';
const api = await request.newContext({ baseURL });
let browser;
try {
  const csrf = (await (await api.get('/api/auth/csrf')).json()).csrfToken;
  const login = await api.post('/api/auth/login', {
    headers: { 'x-analiza-csrf': csrf },
    data: { email: account.email, password: account.password },
  });
  assert.equal(login.status(), 200);
  const session = await login.json();
  assert.equal(session.userId, user);
  const headers = { 'x-analiza-csrf': session.csrfToken };
  async function get(url: string) {
    const r = await api.get(url);
    assert.equal(r.status(), 200, `GET ${url}`);
    return r.json();
  }
  async function post(url: string, data: unknown) {
    const r = await api.post(url, { headers, data });
    assert.ok(r.ok(), `POST ${url}: ${r.status()} ${await r.text()}`);
    return r.json();
  }
  const initial = await get('/api/workspace');
  if (!initial.patients.some((p: { id: string }) => p.id === patientId))
    await post('/api/patients', {
      patient: patientSchema.parse({
        id: patientId,
        fullName: 'Paciente ficticio QA extras18 ' + state.run.slice(0, 8),
        documentType: 'OTHER',
        documentId: 'QA-' + state.run,
        phone: '0000-0000',
        status: 'ACTIVE',
        referralOrigin: 'FAMILY_FRIENDS',
      }),
    });
  if (!initial.catalogItems.some((i: { id: string }) => i.id === itemId))
    await post('/api/operations', {
      command: 'catalog.save',
      item: catalogItemSchema.parse({
        id: itemId,
        sku: id,
        category: 'SUPPLIES',
        name: 'Insumo ficticio QA extras18',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      }),
    });
  let original = initial.quotes.find((q: { id: string }) => q.id === quoteId);
  const serviceId = id + '-service';
  if (!initial.catalogItems.some((item: { id: string }) => item.id === serviceId))
    await post('/api/operations', {
      command: 'catalog.save',
      item: catalogItemSchema.parse({
        id: serviceId,
        sku: serviceId,
        category: 'SERVICES',
        name: 'Servicio ficticio QA',
        status: 'ACTIVE',
        salePriceExcludingTax: 20,
        createdAt: new Date().toISOString(),
      }),
    });
  if (!original)
    original = await post('/api/quotes', {
      quote: quoteSchema.parse({
        id: quoteId,
        patientId,
        version: 1,
        status: 'DRAFT',
        immutable: false,
        summary: 'Prueba sintética de conciliación extras18',
        careSetting: 'HOME_OUTPATIENT',
        createdAt: new Date().toISOString(),
        items: [
          {
            id: 'initial',
            name: 'Servicio ficticio QA',
            category: 'SERVICES',
            inventoryItemId: serviceId,
            quantity: 1,
            unitPrice: 20,
            discountAmount: 0,
          },
        ],
        discount: {
          type: 'CATEGORY_PERCENTAGES',
          value: 10,
          categories: { SERVICES: 10, SUPPLIES: 10 },
        },
        insurerAmount: 3,
      }),
    });
  if (original.status === 'DRAFT')
    original = await post(`/api/quotes/${quoteId}/send`, { expectedVersion: 1 });
  assert.equal(original.total, 18);
  assert.equal(original.patientAmount, 15);
  const payment = paymentSchema.parse({
    id: id + '-payment',
    quoteId,
    amount: 5,
    paymentMethod: 'CASH',
    idempotencyKey: state.paymentKey,
    status: 'APPLIED',
    createdAt: state.paymentAt ?? new Date().toISOString(),
  });
  state.paymentAt = payment.createdAt;
  fs.writeFileSync(stateFile, JSON.stringify(state));
  await post('/api/operations', { command: 'payment.apply', payment });
  const requestRecord = await post('/api/supply-requests', {
    idempotencyKey: state.requestKey,
    patientId,
    catalogItemId: itemId,
    quantity: 3,
    priority: 'LOW',
    note: 'Prueba sintética QA extras18; no corresponde a atención real.',
  });
  const input = {
    requestId: requestRecord.id,
    quoteId,
    expectedRecordVersion: 2,
    expectedUnitPrice: 7.25,
    priceSource: 'MANUAL',
    idempotencyKey: state.assignmentKey,
  };
  const assigned = await Promise.all([
    post('/api/prequotes', input),
    post('/api/prequotes', input),
  ]);
  assert.equal(assigned[0].quoteId, assigned[1].quoteId);
  const workspace = await get('/api/workspace');
  const related = workspace.quotes.filter((q: { patientId: string }) => q.patientId === patientId);
  assert.equal(related.length, 2);
  assert.deepEqual(
    related.find((q: { id: string }) => q.id === quoteId),
    original,
  );
  const accounts = receivableAccounts(related, workspace.payments);
  assert.equal(accounts.length, 1);
  const balance = accounts[0];
  assert.equal(balance.quote.total, 37.57);
  assert.equal(balance.responsibility, 34.57);
  assert.equal(balance.paid, 5);
  assert.equal(balance.balance, 29.57);
  assert.equal(balance.quote.items.length, 2);
  assert.equal(balance.quote.items.filter((item) => item.inventoryItemId === itemId).length, 1);
  const code = 'COT-' + quoteId.replaceAll('-', '').slice(-8).toUpperCase();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    baseURL,
    storageState: await api.storageState(),
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/receivables');
  const accountTable = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Estado de cuentas', exact: true }),
  });
  const row = accountTable.getByRole('row').filter({ hasText: code });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('29.57');
  await page.reload();
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('29.57');
  await page.screenshot({
    path: path.join(directory, 'public-receivable.png'),
    animations: 'disabled',
  });
  assert.deepEqual(errors, []);
  const result = {
    status: 'PASS',
    syntheticOnly: true,
    organization,
    quoteId,
    requestId: requestRecord.id,
    latestQuoteId: balance.quote.id,
    oldTotal: 18,
    newTotal: 37.57,
    insurerAmount: 3,
    patientAmount: 34.57,
    paid: 5,
    balance: 29.57,
    accounts: 1,
    versions: 2,
    addedLines: 1,
    concurrentReplay: true,
    browserReload: true,
    errors,
  };
  fs.writeFileSync(
    path.join(directory, 'public-financial-result.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await api.dispose();
}
