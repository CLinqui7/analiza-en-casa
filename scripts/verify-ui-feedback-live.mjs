import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium, request } from '@playwright/test';

// Use the operator's separate synthetic QA organization. Never print credentials
// or write a real clinical/financial record during this verification.
const baseURL = process.env.ANALIZA_QA_URL;
const accountFile = process.env.ANALIZA_QA_ACCOUNT_FILE;
const organization = process.env.ANALIZA_QA_ORGANIZATION_ID;
assert.ok(baseURL?.startsWith('https://') && accountFile && organization);
const account = JSON.parse(readFileSync(accountFile, 'utf8'));
assert.equal(account.organizationId, organization);
const api = await request.newContext({ baseURL });
const csrf = await (await api.get('/api/auth/csrf')).json();
const login = await api.post('/api/auth/login', {
  headers: { 'x-analiza-csrf': csrf.csrfToken, Origin: baseURL },
  data: { email: account.email, password: account.password },
});
assert.equal(login.status(), 200, 'QA login');
const session = await login.json();
assert.equal(session.userId, account.userId);
const headers = { 'x-analiza-csrf': session.csrfToken, Origin: baseURL };
const url = '/api/quotes/form-draft?key=quote.create.qa-ui-20261029';
const discount = { type: 'CATEGORY_PERCENTAGES', value: 10, categories: { SERVICES: 10 } };
const draft = {
  caseId: '',
  patientId: '',
  patientQuery: '',
  referralQuery: '',
  summary: 'QA interfaz sintética',
  comments: '',
  paymentCondition: '',
  invoiceDate: '2026-10-29',
  invoiceDocumentType: 'INVOICE',
  discountGroup: 'Regular',
  referralLabel: '',
  referralSelections: [],
  items: [],
  insurerAmount: 0,
  revisionReason: '',
  discount,
};
let browser;
let visitor;
const label = `Visitador QA interfaz ${Date.now()}`;
try {
  const save = await api.put(url, { headers, data: draft });
  assert.equal(save.status(), 200, 'selected category draft must persist');
  const saved = await (await api.get(url)).json();
  assert.deepEqual(saved.draft.discount, discount);
  console.log('PASS: PostgreSQL draft saves and reloads a single-category discount');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    storageState: await api.storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/catalogs/medical-visitors`);
  await page.getByRole('heading', { level: 1, name: 'Visitadores médicos' }).waitFor();
  await page.getByRole('button', { name: '+ Agregar visitador' }).click();
  await page.getByLabel('Nombre / descripción').fill(label);
  await page.getByRole('button', { name: 'Guardar visitador' }).click();
  await page.getByText(label, { exact: true }).waitFor();
  await page.reload();
  await page.getByText(label, { exact: true }).waitFor();
  const operations = await (await api.get('/api/operations')).json();
  visitor = operations.configuration.find((entry) => entry.label === label);
  assert.equal(visitor?.category, 'MEDICAL_VISITOR');
  console.log('PASS: visitor creation through browser persists after reload');
  for (const path of [
    '/quotes',
    '/clinical/hospitalizations',
    '/receivables',
    '/catalogs/medical-visitors',
  ]) {
    const response = await page.goto(`${baseURL}${path}`);
    assert.equal(response.status(), 200);
    await page.locator('.main-content').waitFor();
    console.log(`PASS: authenticated ${path}`);
  }
} finally {
  headers['x-analiza-csrf'] = (await (await api.get('/api/auth/csrf')).json()).csrfToken;
  if (!visitor) {
    const state = await api.get('/api/operations');
    if (state.ok())
      visitor = (await state.json()).configuration.find((entry) => entry.label === label);
  }
  if (visitor) {
    const archived = await api.post('/api/operations', {
      headers,
      data: { command: 'configuration.save', entry: { ...visitor, active: false } },
    });
    assert.equal(archived.status(), 200, 'deactivate synthetic visitor');
  }
  assert.equal((await api.delete(url, { headers })).status(), 200, 'remove temporary QA draft');
  await browser?.close();
  await api.dispose();
}
