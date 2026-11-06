// Explicit, synthetic-only smoke verification after a Git-first VPS release.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { request, chromium } from '@playwright/test';

const baseURL = process.env.CLINICAL_RELEASE_URL;
const accountFile = process.env.CLINICAL_RELEASE_ACCOUNT_FILE;
const expectedOrg = process.env.CLINICAL_RELEASE_QA_ORG;
if (!baseURL?.startsWith('https://') || !accountFile || !expectedOrg)
  throw Error('Provide HTTPS URL, private QA account file and expected synthetic organization.');
const account = JSON.parse(fs.readFileSync(accountFile, 'utf8'));
assert.equal(account.organizationId, expectedOrg, 'Wrong synthetic organization');
const api = await request.newContext({ baseURL });
const checks = [];
const pass = (name) => {
  checks.push(name);
  console.log('PASS ' + name);
};
let browser;
try {
  assert.equal((await api.get('/api/health')).status(), 200);
  pass('Public readiness');
  const csrf = (await (await api.get('/api/auth/csrf')).json()).csrfToken;
  const login = await api.post('/api/auth/login', {
    headers: { 'x-analiza-csrf': csrf },
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
  assert.ok(
    patient,
    'An operator-provisioned synthetic patient is required; never choose a real patient.',
  );
  const doctor = {
    id: 'doctor-synthetic-clinical-release',
    fullName: 'Profesional sintético QA',
    specialty: 'Validación de software',
    referralCategory: 'NEW',
    landlinePhone: '00000000',
    attachments: [],
  };
  if (!workspace.doctors.some((d) => d.id === doctor.id)) {
    const result = await api.post('/api/doctors', { headers, data: { doctor } });
    assert.equal(result.status(), 201, 'Synthetic doctor fixture');
  }
  const hospitalization = {
    id: 'case-synthetic-clinical-release',
    patientId: patient.id,
    startDate: '2026-11-04',
    status: 'ACTIVE',
    accountType: 'QA sintético',
    primaryDoctorId: doctor.id,
    diagnosisSummary: 'Validación de software; sin uso clínico',
  };
  if (!workspace.hospitalizations.some((h) => h.id === hospitalization.id)) {
    const result = await api.post('/api/hospitalizations', { headers, data: { hospitalization } });
    assert.equal(result.status(), 201, 'Synthetic case fixture');
  }
  pass('Authenticated synthetic account and fixture boundaries');
  const record = {
    id: 'clinical-release-' + Date.now(),
    patientId: patient.id,
    caseId: hospitalization.id,
    date: '2026-11-04',
    payload: {
      kind: 'INDICATION',
      summary: 'Prueba sintética de publicación; no corresponde a una atención real.',
    },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await api.post('/api/operations', {
      headers,
      data: { command: 'clinical.record', record },
    });
    assert.equal(response.status(), 200, 'Clinical persistence response');
    assert.equal((await response.json()).id, record.id);
  }
  const snapshot = await (await api.get('/api/operations')).json();
  assert.equal(snapshot.clinicalRecords.filter((r) => r.id === record.id).length, 1);
  pass('PostgreSQL clinical persistence and idempotent retry');
  const entry = {
    id: 'discount-synthetic-clinical-release',
    category: 'DISCOUNT_PROFILE',
    label: 'Perfil sintético de publicación',
    active: true,
    categoryRates: { MEDICATIONS: 7 },
  };
  const saved = await api.post('/api/operations', {
    headers,
    data: { command: 'configuration.save', entry },
  });
  assert.equal(saved.status(), 200);
  const configuration = (await (await api.get('/api/operations')).json()).configuration;
  assert.equal(configuration.find((c) => c.id === entry.id).categoryRates.MEDICATIONS, 7);
  pass('User-entered category configuration persists');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ baseURL, storageState: await api.storageState() });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const path of [
    '/clinical/orders',
    '/clinical',
    '/clinical/reports',
    '/clinical/document-versions',
    '/clinical/medication-cards',
    '/clinical/balance',
    '/clinical/care-plans',
    '/clinical/administrations',
    '/catalogs/clinical',
    '/catalogs/discounts',
    '/reports/returns',
    '/receivables',
  ]) {
    const response = await page.goto(path);
    assert.equal(response.status(), 200, path);
    await page.locator('main h1').first().waitFor();
    assert.ok(!page.url().includes('/login'), path);
  }
  await page.goto('/clinical?patient=' + encodeURIComponent(patient.id));
  await page
    .getByRole('navigation', { name: 'Secciones del expediente' })
    .getByRole('button', { name: /Acciones médicas/ })
    .click();
  await page.getByText(record.payload.summary, { exact: true }).first().waitFor();
  await page.reload();
  await page
    .getByRole('navigation', { name: 'Secciones del expediente' })
    .getByRole('button', { name: /Acciones médicas/ })
    .click();
  await page.getByText(record.payload.summary, { exact: true }).first().waitFor();
  assert.deepEqual(errors, []);
  pass('Twelve authenticated routes and clinical reload without browser errors');
  console.log(JSON.stringify({ status: 'PASS', checks, syntheticRecordId: record.id }));
} finally {
  await browser?.close();
  await api.dispose();
}
