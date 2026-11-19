// Public verification in the previously authorized synthetic organization only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium, expect, request } from '@playwright/test';

const account = JSON.parse(fs.readFileSync(process.env.PART1_RELEASE_ACCOUNT_FILE, 'utf8'));
assert.equal(account.organizationId, '157a0046-7ed7-4bd6-85b8-005431466298');
const sha = process.env.PART1_RELEASE_SHA;
assert.match(sha ?? '', /^[a-f0-9]{40}$/);
const baseURL = 'https://analiza.207.244.227.122.sslip.io';
const api = await request.newContext({ baseURL });
const output = process.env.PART1_RELEASE_OUTPUT || '.local/part1-release';
fs.mkdirSync(output, { recursive: true });
const checks = [];
let browser;
try {
  const initialCsrf = (await (await api.get('/api/auth/csrf')).json()).csrfToken;
  const login = await api.post('/api/auth/login', {
    headers: { 'x-analiza-csrf': initialCsrf },
    data: { email: account.email, password: account.password },
  });
  assert.equal(login.status(), 200, 'Synthetic sign-in');
  assert.equal((await login.json()).userId, account.userId);
  const csrf = (await (await api.get('/api/auth/csrf')).json()).csrfToken;
  const headers = { 'x-analiza-csrf': csrf };
  const workspaceResponse = await api.get('/api/workspace');
  assert.equal(workspaceResponse.status(), 200);
  const workspace = await workspaceResponse.json();
  const patientId = 'patient-synthetic-nov17-' + sha.slice(0, 8);
  let patient = workspace.patients.find((item) => item.id === patientId);
  if (!patient) {
    const created = await api.post('/api/patients', {
      headers,
      data: {
        patient: {
          id: patientId,
          fullName: 'Paciente sintético QA dependientes Nov17',
          documentType: 'OTHER',
          documentId: 'QA-DEPENDENTS-' + sha.slice(0, 8),
          referralOrigin: 'FAMILY_FRIENDS',
          dependents: [
            {
              id: randomUUID(),
              firstNames: 'Dependiente',
              lastNames: 'Sintético QA',
              gender: 'F',
              birthDate: '2020-01-01',
            },
          ],
        },
      },
    });
    assert.equal(created.status(), 201, 'Synthetic dependent persistence');
    patient = await created.json();
  }
  assert.equal(patient.dependents.length, 1);
  const dependentId = patient.dependents[0].id;
  const bytes = Buffer.from('%PDF-1.4\nSynthetic release verification only\n%%EOF');
  const listed = await api.get(`/api/files?ownerType=patient&ownerId=${patientId}`);
  assert.equal(listed.status(), 200);
  const files = await listed.json();
  for (const documentKind of ['BIRTH_CERTIFICATE', 'CONSENT']) {
    let metadata = files.find(
      (file) => file.dependentId === dependentId && file.documentKind === documentKind,
    );
    if (!metadata) {
      const uploaded = await api.post('/api/files', {
        headers,
        multipart: {
          ownerType: 'patient',
          ownerId: patientId,
          dependentId,
          documentKind,
          file: { name: `QA-${documentKind}.pdf`, mimeType: 'application/pdf', buffer: bytes },
        },
      });
      assert.equal(uploaded.status(), 201, 'Private upload in deployed storage');
      metadata = await uploaded.json();
    }
    const downloaded = await api.get('/api/files/' + metadata.id);
    assert.equal(downloaded.status(), 200);
    assert.deepEqual(await downloaded.body(), bytes);
  }
  checks.push('Synthetic dependent and both private documents persist and download exact bytes');
  for (const path of [
    '/api/prequotes',
    '/api/received-orders',
    '/api/quote-decisions',
    '/api/hospitalizations',
  ]) {
    const response = await api.get(path);
    assert.equal(response.status(), 200, path);
    await response.json();
  }
  checks.push(
    'New inboxes, quote decisions and admissions respond through public authenticated APIs',
  );
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    baseURL,
    storageState: await api.storageState(),
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of [
    '/patients/' + patientId,
    '/quotes',
    '/clinical/hospitalizations',
    '/clinical/prequotes',
    '/inventory/received-orders',
    '/inventory/suppliers',
    '/receivables',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        path + ' responsive',
      );
    }
    await page.screenshot({
      path: `${output}/${path.replaceAll('/', '_')}.png`,
      animations: 'disabled',
    });
  }
  checks.push('Seven affected public pages render at desktop, tablet and mobile widths');
  await page.goto('/quotes?create=1');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Responsable administrativo')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  await page.goto('/clinical/hospitalizations');
  await expect(page.locator('[data-action-id="CLINICAL-CARE-SETTING-FILTER"] option')).toHaveCount(
    4,
  );
  await page.goto('/catalogs');
  await expect(page.getByRole('button', { name: 'Proveedores', exact: true })).toHaveCount(0);
  assert.deepEqual(errors, []);
  checks.push(
    'Owner default, four admission filters, supplier relocation and no JavaScript errors',
  );
  assert.equal((await api.get('/api/health')).status(), 200);
  const result = {
    status: 'PASS',
    sha,
    checks,
    syntheticOnly: true,
    patientId,
    productionFinancialWrites: false,
  };
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await api.dispose();
}
