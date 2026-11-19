// Read-only release checks, restricted to the operator's synthetic organization.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, request, expect } from '@playwright/test';
const account = JSON.parse(fs.readFileSync(process.env.EXTENSION_RELEASE_ACCOUNT_FILE, 'utf8'));
assert.equal(account.organizationId, '157a0046-7ed7-4bd6-85b8-005431466298');
const baseURL = 'https://analiza.207.244.227.122.sslip.io';
const output = process.env.EXTENSION_RELEASE_OUTPUT || '.local/approved-extension-release';
const sha = process.env.EXTENSION_RELEASE_SHA;
assert.match(sha || '', /^[a-f0-9]{40}$/);
fs.mkdirSync(output, { recursive: true });
const api = await request.newContext({ baseURL });
let browser;
try {
  const csrf = (await (await api.get('/api/auth/csrf')).json()).csrfToken;
  const login = await api.post('/api/auth/login', {
    headers: { 'x-analiza-csrf': csrf }, data: { email: account.email, password: account.password },
  });
  assert.equal(login.status(), 200);
  assert.equal((await login.json()).userId, account.userId);
  const response = await api.get('/api/prequotes');
  assert.equal(response.status(), 200);
  const inbox = await response.json();
  for (const quote of inbox.quotes) {
    assert.ok(['DRAFT', 'SENT', 'APPROVED'].includes(quote.status));
    assert.ok(Object.hasOwn(quote, 'approvalDecisionId'), 'Updated projection must include approval identity');
    assert.equal(Boolean(quote.approvalDecisionId), quote.status === 'APPROVED');
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ baseURL, storageState: await api.storageState(), reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], routes = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/clinical/prequotes', '/quotes', '/receivables', '/clinical/hospitalizations', '/inventory/received-orders']) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForLoadState('networkidle');
    const widths = [];
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `${path}: overflow at ${width}`);
      widths.push(width);
    }
    routes.push({ path, widths });
  }
  assert.deepEqual(errors, []);
  assert.equal((await api.get('/api/health')).status(), 200);
  const result = { status: 'PASS', sha, syntheticOnly: true, businessWrites: false,
    routes, errors, inboxQuotesChecked: inbox.quotes.length,
    approvedChoices: inbox.quotes.filter(q => q.status === 'APPROVED').length,
    scope: 'Public read-only API/render checks; full approved extension writes verified in isolated PostgreSQL/browser QA.' };
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { await browser?.close(); await api.dispose(); }
