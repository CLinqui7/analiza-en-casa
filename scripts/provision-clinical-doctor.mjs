// Explicit operator task: private inputs, audited API, no mail and no credential output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { request, chromium, expect } from '@playwright/test';

const directory = process.env.EXTRAS18_PRIVATE_DIRECTORY;
assert.ok(directory && path.relative(process.cwd(), path.resolve(directory)).startsWith('..'));
const target = JSON.parse(fs.readFileSync(path.join(directory, 'doctor-request.json'), 'utf8'));
assert.equal(target.role, 'DOCTOR');
assert.ok(target.email && target.displayName);
const session = JSON.parse(fs.readFileSync(path.join(directory, 'main-session.json'), 'utf8'));
assert.equal(session.session.role, 'WEBMASTER');
const file = path.join(directory, 'doctor-access.json');
const access = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, 'utf8'))
  : { ...target, password: randomBytes(24).toString('base64url'), created: false };
assert.equal(access.email, target.email);
assert.equal(access.role, 'DOCTOR');
fs.writeFileSync(file, JSON.stringify(access, null, 2), { mode: 0o600 });
const baseURL = 'https://analiza.207.244.227.122.sslip.io';
const admin = await request.newContext({ baseURL, storageState: session.storage });
const doctor = await request.newContext({ baseURL });
let browser;
try {
  if (!access.created) {
    const csrf = (await (await admin.get('/api/auth/csrf')).json()).csrfToken;
    const response = await admin.post('/api/operations', {
      headers: { 'x-analiza-csrf': csrf },
      data: {
        command: 'team.account.create',
        displayName: access.displayName,
        email: access.email,
        password: access.password,
        role: 'DOCTOR',
      },
    });
    assert.equal(response.status(), 200, 'Audited account creation must succeed');
    const created = await response.json();
    assert.equal(created.role, 'DOCTOR');
    Object.assign(access, { created: true, userId: created.id });
    fs.writeFileSync(file, JSON.stringify(access, null, 2), { mode: 0o600 });
  }
  const csrf = (await (await doctor.get('/api/auth/csrf')).json()).csrfToken;
  const response = await doctor.post('/api/auth/login', {
    headers: { 'x-analiza-csrf': csrf },
    data: { email: access.email, password: access.password },
  });
  assert.equal(response.status(), 200);
  const logged = await response.json();
  assert.equal(logged.userId, access.userId);
  assert.equal(logged.role, 'DOCTOR');
  for (const url of ['/api/quotes', '/api/prequotes'])
    assert.equal((await doctor.get(url)).status(), 403);
  const workspace = await (await doctor.get('/api/workspace')).json();
  assert.deepEqual(workspace.quotes, []);
  assert.deepEqual(workspace.payments, []);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    baseURL,
    storageState: await doctor.storageState(),
    viewport: { width: 1440, height: 950 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const url of ['/clinical/hospitalizations', '/agenda', '/clinical', '/clinical/orders']) {
    await page.goto(url);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main[role=alert]')).toHaveCount(0);
    await expect(page.locator('.nav-list a')).toHaveCount(4);
  }
  await page.goto('/quotes');
  await expect(page.locator('main[role=alert]')).toContainText('Acceso restringido');
  assert.deepEqual(errors, []);
  const result = {
    status: 'PASS',
    role: 'DOCTOR',
    userId: access.userId,
    screens: 4,
    financeDenied: true,
    auditedCreation: true,
    credentialsPrinted: false,
  };
  fs.writeFileSync(
    path.join(directory, 'doctor-verification.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await doctor.dispose();
  await admin.dispose();
}
