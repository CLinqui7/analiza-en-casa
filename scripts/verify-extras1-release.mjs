// Read-only checks in the operator's synthetic organization. Never writes business records.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, request, expect } from '@playwright/test';

const account = JSON.parse(fs.readFileSync(process.env.EXTRAS1_ACCOUNT_FILE, 'utf8'));
assert.equal(account.organizationId, '157a0046-7ed7-4bd6-85b8-005431466298');
const sha = process.env.EXTRAS1_RELEASE_SHA;
assert.match(sha || '', /^[a-f0-9]{40}$/);
const output = process.env.EXTRAS1_OUTPUT || '.local/extras1-release';
fs.mkdirSync(output, { recursive: true });
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
  assert.equal((await login.json()).userId, account.userId);
  const response = await api.get('/api/prequotes');
  assert.equal(response.status(), 200);
  const inbox = await response.json();
  const scoped = await api.get('/api/prequotes?requestId=extras1-nonexistent-synthetic-request');
  assert.equal(scoped.status(), 200);
  assert.deepEqual((await scoped.json()).entries, []);
  assert.equal((await api.get('/api/prequotes?requestId=')).status(), 400);
  let checkedRequests = 0;
  for (const entry of inbox.entries.slice(0, 2)) {
    const refreshed = await api.get(`/api/prequotes?requestId=${encodeURIComponent(entry.id)}&page=999`);
    assert.equal(refreshed.status(), 200);
    const data = await refreshed.json();
    assert.deepEqual(data.entries.map(item => item.id), [entry.id]);
    assert.ok(data.quotes.every(quote => quote.patientId === entry.patientId));
    checkedRequests++;
  }
  const profile = await api.get('/api/profile');
  assert.equal(profile.status(), 200);
  assert.ok((await profile.json()).displayName?.trim());
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ baseURL, storageState: await api.storageState(), reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], routes = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/quotes', '/clinical/prequotes', '/receivables', '/inventory/suppliers', '/inventory/received-orders']) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForLoadState('networkidle');
    const widths = [];
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path}: overflow at ${width}`);
      if (path.endsWith('/suppliers')) {
        await expect(page.locator('.supplier-card')).toHaveCount(0);
        const table = page.getByRole('table', { name: 'Proveedores', exact: true });
        if (await table.count()) await expect(table.getByRole('columnheader', { name: 'Contacto', exact: true })).toBeAttached();
      }
      widths.push(width);
    }
    routes.push({ path, widths });
  }
  assert.deepEqual(errors, []);
  assert.equal((await api.get('/api/health')).status(), 200);
  const result = { status: 'PASS', sha, syntheticOnly: true, businessWrites: false, routes, errors, checkedRequests,
    scope: 'Public read-only API and responsive checks. Owner recovery, supplier CRUD and assignment writes certified in isolated PostgreSQL/browser QA.' };
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await api.dispose();
}
