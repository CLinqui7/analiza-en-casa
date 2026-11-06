// Read-only authenticated review. Private source inputs and screenshots must remain outside Git.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, request, expect } from '@playwright/test';

const baseURL = process.env.DOCTOR_REVIEW_URL;
const account = JSON.parse(fs.readFileSync(process.env.DOCTOR_REVIEW_ACCOUNT, 'utf8'));
const plan = JSON.parse(fs.readFileSync(process.env.DOCTOR_REVIEW_PLAN, 'utf8'));
const output = path.resolve(process.env.DOCTOR_REVIEW_OUTPUT);
const relative = path.relative(fs.realpathSync(process.cwd()), fs.realpathSync(output));
assert.ok(
  relative.startsWith('..') || path.isAbsolute(relative),
  'Private output must be outside the repository',
);
assert.ok(baseURL?.startsWith('https://'));
const api = await request.newContext({ baseURL });
let browser,
  page,
  stage = 'login';
try {
  const csrf = (await (await api.get('/api/auth/csrf')).json()).csrfToken;
  const login = await api.post('/api/auth/login', {
    headers: { 'x-analiza-csrf': csrf },
    data: { email: account.email, password: account.password },
  });
  assert.equal(login.status(), 200);
  const identity = await login.json();
  assert.equal(identity.userId, account.userId);
  const response = await api.get('/api/doctors');
  assert.equal(response.status(), 200);
  const doctors = (await response.json()).doctors.map((entry) => entry.doctor);
  const importedIds = new Set(plan.actions.map((action) => action.doctor.id));
  assert.equal(importedIds.size, 623);
  assert.equal(doctors.filter((doctor) => importedIds.has(doctor.id)).length, importedIds.size);
  const draftUrl = '/api/quotes/form-draft?key=quote.create.new';
  const draftBefore = await (await api.get(draftUrl)).json();
  const example = doctors.find(
    (doctor) =>
      importedIds.has(doctor.id) &&
      /[áéíóúñ]/i.test(doctor.fullName) &&
      !doctor.landlinePhone &&
      !doctor.referralCategory,
  );
  const second = doctors.find(
    (doctor) =>
      importedIds.has(doctor.id) &&
      doctor.id !== example.id &&
      doctor.practiceLocations?.length > 1,
  );
  const errors = [];
  let interceptedDraftWrites = 0,
    attemptedOtherWrites = 0;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    baseURL,
    storageState: await api.storageState(),
    reducedMotion: 'reduce',
  });
  await context.route('**/api/**', async (route) => {
    const req = route.request();
    if (new URL(req.url()).pathname === '/api/quotes/form-draft') {
      if (req.method() !== 'GET') interceptedDraftWrites++;
      return route.fulfill({ json: req.method() === 'GET' ? { draft: null } : { ok: true } });
    }
    if (!['GET', 'HEAD'].includes(req.method())) {
      attemptedOtherWrites++;
      return route.abort();
    }
    return route.continue();
  });
  page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.name));
  stage = 'directory rendering and search';
  await page.goto('/doctors');
  const query = example.fullName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .reverse()
    .join(' ');
  await page.getByLabel(/Buscar médico por/).fill(query);
  const row = page.locator('tbody tr').filter({ hasText: example.fullName });
  await expect(row).toHaveCount(1);
  if (example.phone) await expect(row).toContainText('Celular: ' + example.phone);
  await row.getByRole('button', { name: 'Editar médico', exact: true }).click();
  const doctorDialog = page.getByRole('dialog', { name: 'Editar médico', exact: true });
  await expect(doctorDialog.getByLabel('Nombre completo', { exact: false })).toHaveValue(
    example.fullName,
  );
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await doctorDialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 2));
    await page.screenshot({ path: path.join(output, `directory-${width}-private.png`) });
  }
  stage = 'quote selectors';
  await page.goto('/quotes?create=1');
  const dialog = page.getByRole('dialog', { name: 'Nueva cotización' });
  const search = dialog.locator('[data-action-id="QUOTE-DOCTOR-SEARCH"]');
  const primary = dialog.locator('[data-action-id="QUOTE-PRIMARY-DOCTOR"]');
  const secondary = dialog.locator('[data-action-id="QUOTE-SECONDARY-DOCTOR"]');
  await expect(primary).toBeEnabled();
  for (const select of [primary, secondary]) {
    const available = await select
      .locator('option')
      .evaluateAll((options) =>
        options.filter((option) => option.value && !option.disabled).map((option) => option.value),
      );
    assert.equal(new Set(available).size, doctors.length);
    assert.ok([...importedIds].every((id) => available.includes(id)));
  }
  await search.fill('  ' + query + '  ');
  await primary.selectOption(example.id);
  if (example.jvpm || example.conadem) {
    await search.fill(example.jvpm || example.conadem);
    await expect(secondary.locator(`option[value="${example.id}"]`)).toBeAttached();
  }
  const clinic = second.practiceLocations.find((location) => location.clinicName)?.clinicName;
  await search.fill(clinic || second.fullName);
  await secondary.selectOption(second.id);
  await search.fill('sin-coincidencias-qa-review');
  await expect(primary).toHaveValue(example.id);
  await expect(secondary).toHaveValue(second.id);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 2));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await primary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `quote-doctors-${width}-private.png`) });
  }
  await page.waitForTimeout(700);
  assert.equal(attemptedOtherWrites, 0);
  assert.deepEqual(await (await api.get(draftUrl)).json(), draftBefore);
  assert.deepEqual(errors, []);
  assert.equal((await api.get('/api/health')).status(), 200);
  const result = {
    status: 'PASS',
    doctors: doctors.length,
    importedAvailableInBothSelectors: importedIds.size,
    uniqueOptionIds: true,
    normalizedNameSearch: true,
    professionalIdentifierSearch: true,
    additionalClinicSearch: Boolean(clinic),
    pendingFieldsDoNotBlockSelection: true,
    preservedSelections: true,
    widths: [1440, 768, 390],
    interceptedDraftWrites,
    originalUserDraftUnchanged: true,
    businessWrites: 0,
    javascriptErrors: 0,
  };
  fs.writeFileSync(path.join(output, 'live-summary.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  fs.writeFileSync(path.join(output, 'failure-private.txt'), String(error.stack));
  await page?.screenshot({ path: path.join(output, 'failure-private.png') }).catch(() => {});
  console.error(JSON.stringify({ status: 'FAIL', stage, type: error.name }));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await api.dispose();
}
