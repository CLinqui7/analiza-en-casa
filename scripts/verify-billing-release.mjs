// Explicit production smoke: only the operator-provisioned synthetic organization.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request, chromium } from '@playwright/test';
const baseURL = process.env.BILLING_RELEASE_URL,
  accountFile = process.env.BILLING_RELEASE_ACCOUNT_FILE;
const expectedOrg = process.env.BILLING_RELEASE_QA_ORG;
assert.ok(baseURL?.startsWith('https://') && accountFile && expectedOrg);
const account = JSON.parse(fs.readFileSync(accountFile, 'utf8'));
assert.equal(account.organizationId, expectedOrg);
const api = await request.newContext({ baseURL });
const checks = [];
const pass = (name) => {
  checks.push(name);
  console.log('PASS ' + name);
};
let browser;
try {
  assert.equal((await api.get('/api/health')).status(), 200);
  const pre = (await (await api.get('/api/auth/csrf')).json()).csrfToken;
  const login = await api.post('/api/auth/login', {
    headers: { 'x-analiza-csrf': pre },
    data: { email: account.email, password: account.password },
  });
  assert.equal(login.status(), 200);
  const session = await login.json();
  assert.equal(session.userId, account.userId);
  assert.equal(session.role, 'ADMIN');
  const headers = { 'x-analiza-csrf': session.csrfToken };
  const workspace = await (await api.get('/api/workspace')).json();
  const patient = workspace.patients.find(
    (p) => p.id.startsWith('patient-synthetic-qa-') && /QA|sint[eé]tic|prueba/i.test(p.fullName),
  );
  const doctor = workspace.doctors.find(
    (d) => d.id === 'doctor-synthetic-clinical-release' && /sint[eé]tic/i.test(d.fullName),
  );
  assert.ok(patient && doctor, 'Only existing explicitly synthetic fixtures are allowed');
  pass('Public health and authenticated synthetic tenant fixtures');
  async function post(path, data, status = 200) {
    const r = await api.post(path, { headers, data });
    assert.equal(r.status(), status, `${path}: ${await r.text()}`);
    return r.json();
  }
  const id = 'billing-synthetic-release-' + Date.now();
  const first = await post(
    '/api/quotes',
    {
      quote: {
        id,
        patientId: patient.id,
        version: 1,
        status: 'DRAFT',
        summary: 'Verificación sintética de facturación, sin uso comercial',
        createdAt: new Date().toISOString(),
        accountType: 'SEGURO',
        insurer: 'Aseguradora sintética QA',
        insurerAmount: 0,
        items: [
          {
            id: 'fee',
            category: 'FEES',
            name: 'Honorario sintético de prueba',
            doctorId: doctor.id,
            quantity: 2,
            unitPrice: 35,
            discountAmount: 0,
          },
        ],
      },
    },
    201,
  );
  assert.equal(first.total, 70);
  const sent = await post(`/api/quotes/${id}/send`, { expectedVersion: 1 });
  const payment = {
    id: randomUUID(),
    quoteId: id,
    amount: 0.29,
    paymentMethod: 'CHECK',
    reference: 'RES-SINTETICA-RELEASE',
    idempotencyKey: randomUUID(),
    status: 'APPLIED',
    createdAt: new Date().toISOString(),
  };
  await post('/api/operations', { command: 'payment.apply', payment });
  await post('/api/operations', { command: 'payment.apply', payment });
  const invalid = await api.post('/api/operations', {
    headers,
    data: {
      command: 'payment.apply',
      payment: { ...payment, id: randomUUID(), idempotencyKey: randomUUID(), amount: 0.001 },
    },
  });
  assert.equal(invalid.status(), 400);
  const revision = await post(
    '/api/quotes',
    {
      quote: {
        ...sent,
        id: id + '-v2',
        version: 2,
        status: 'DRAFT',
        immutable: false,
        sentAt: undefined,
        createdAt: new Date().toISOString(),
        revisionReason: 'Ampliación sintética para verificar saldo',
        items: sent.items.map((item) => ({ ...item, quantity: 3 })),
      },
    },
    201,
  );
  await post(`/api/quotes/${revision.id}/send`, { expectedVersion: 1 });
  const updated = await (await api.get('/api/workspace')).json();
  assert.equal(updated.payments.filter((p) => p.id === payment.id).length, 1);
  assert.equal(updated.quotes.find((q) => q.id === id).total, 70);
  assert.equal(updated.quotes.find((q) => q.id === revision.id).total, 105);
  pass(
    'Synthetic quote versions, one payment across retries and fractional-cent rejection persist',
  );
  const observed = await post('/api/insurance-observations', {
    quoteId: revision.id,
    status: 'INSURER_REVIEW',
    note: 'Seguimiento sintético de publicación',
    date: new Date().toISOString(),
    idempotencyKey: randomUUID(),
  });
  assert.equal(observed.request.insurer, 'Aseguradora sintética QA');
  pass('Quote insurer persists in administrative follow-up');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    baseURL,
    storageState: await api.storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/quotes/' + id);
  await page
    .locator('dt')
    .filter({ hasText: /^Saldo actual de cuenta$/ })
    .waitFor();
  assert.match(
    await page
      .locator('dt')
      .filter({ hasText: /^Saldo actual de cuenta$/ })
      .locator('+ dd')
      .innerText(),
    /104\.71/,
  );
  assert.match(
    await page
      .locator('dt')
      .filter({ hasText: /^Total$/ })
      .locator('+ dd')
      .innerText(),
    /70\.00/,
  );
  const download = page.waitForEvent('download');
  await page.locator('[data-action-id="QUOTE-PDF-DOWNLOAD"]').click();
  const file = await download;
  assert.match(file.suggestedFilename(), /\.pdf$/);
  if (process.env.BILLING_RELEASE_PDF) await file.saveAs(process.env.BILLING_RELEASE_PDF);
  await page.goto('/doctors');
  await page.locator('main h1').waitFor();
  assert.equal(
    await page.getByText('En Mongo, guarde primero el médico.', { exact: false }).count(),
    0,
  );
  assert.equal((await page.locator('.account-logout-quick').innerText()).trim(), 'Cerrar sesión');
  await page.goto('/insurance');
  await page.locator('.insurance-card').first().waitFor();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    assert.equal(
      await page
        .locator('.insurance-card')
        .evaluateAll((cards) => cards.some((c) => c.scrollWidth > c.clientWidth + 1)),
      false,
    );
  }
  await page.goto('/receivables');
  await page.locator('main h1').waitFor();
  await page.goto('/payments');
  await page.locator('main h1').waitFor();
  assert.equal(errors.length, 0);
  pass(
    'Live quote balance, PDF, doctors notice, logout, insurance responsive and financial routes',
  );
  headers['x-analiza-csrf'] = (await (await api.get('/api/auth/csrf')).json()).csrfToken;
  await post('/api/operations', {
    command: 'payment.void',
    paymentId: payment.id,
    reason: 'Cierre de verificación sintética de publicación',
  });
  const final = await (await api.get('/api/workspace')).json();
  assert.equal(final.payments.find((p) => p.id === payment.id).status, 'VOIDED');
  pass('Synthetic payment reversed with reason; no real transactions changed');
  console.log(
    JSON.stringify({
      status: 'PASS',
      checks,
      syntheticQuoteId: id,
      syntheticRevisionId: revision.id,
    }),
  );
} finally {
  await browser?.close();
  await api.dispose();
}
