/** Explicit operator check. Real Atlas + HTTP + independent browser sessions; synthetic data only. */
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, request, type APIRequestContext } from '@playwright/test';
import { mongoDatabase, closeMongoClient } from './mongodb';
import { hashPassword } from './mongo-auth';

const base = process.env.ANALIZA_VERIFY_URL;
assert.ok(
  base && process.env.MONGODB_URI,
  'Load private operator configuration and an explicit verification URL.',
);
const run = `core-${randomUUID().slice(0, 8)}`;
const organizationId = `${run}-qa-org`;
const email = `${run}-admin@example.test`;
const password = randomBytes(32).toString('base64url');
const qaUserIds: string[] = [];
const output = `.local/core-verification/${run}`;
const passed: string[] = [];
const clients: APIRequestContext[] = [];
const bypass = process.env.ANALIZA_PREVIEW_BYPASS;
const headers: Record<string, string> = bypass ? { 'x-vercel-protection-bypass': bypass } : {};
const database = await mongoDatabase();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir(output, { recursive: true });
async function login(userEmail: string) {
  const context = await request.newContext({ baseURL: base, extraHTTPHeaders: headers });
  clients.push(context);
  const csrfResponse = await context.get('/api/auth/csrf');
  assert.equal(csrfResponse.status(), 200, 'CSRF bootstrap');
  const csrf = (await csrfResponse.json()).csrfToken;
  const result = await context.post('/api/auth/login', {
    headers: { 'x-analiza-csrf': csrf },
    data: { email: userEmail, password },
  });
  assert.equal(result.status(), 200, 'Server authentication');
  return { context, csrf: (await result.json()).csrfToken as string };
}
type Client = Awaited<ReturnType<typeof login>>;
async function mutate(client: Client, url: string, data: unknown, status = 200, method = 'POST') {
  const response = await client.context.fetch(url, {
    method,
    headers: { 'x-analiza-csrf': client.csrf },
    data,
  });
  assert.equal(response.status(), status, `${method} ${url}`);
  return response.json();
}
try {
  const anonymous = await request.newContext({ baseURL: base, extraHTTPHeaders: headers });
  clients.push(anonymous);
  assert.equal((await anonymous.get('/api/health')).status(), 200, 'Atlas readiness');
  for (const path of [
    '/api/patients',
    '/api/hospitalizations',
    '/api/doctors',
    '/api/shifts',
    '/api/operations',
    '/api/workspace',
  ]) {
    assert.equal((await anonymous.get(path)).status(), 401, `${path} rejects anonymous access`);
  }
  for (const path of ['/api/quotes', '/api/portal-status', '/api/insurance-observations']) {
    assert.equal((await anonymous.get(path)).status(), 404, `${path} is not in core`);
  }
  passed.push('Atlas readiness, anonymous API rejection and hidden endpoint gates');
  const adminId = `${run}-admin`;
  qaUserIds.push(adminId);
  await database.collection('users').insertOne({
    id: adminId,
    emailNormalized: email,
    displayName: 'QA Core administrador',
    passwordHash: await hashPassword(password),
  });
  await database
    .collection('memberships')
    .insertOne({ userId: adminId, organizationId, role: 'ADMIN', active: true });
  const foreignId = `${run}-foreign`;
  qaUserIds.push(foreignId);
  await database.collection('users').insertOne({
    id: foreignId,
    emailNormalized: `${foreignId}@example.test`,
    displayName: 'QA otra organización',
    passwordHash: await hashPassword(password),
  });
  await database.collection('memberships').insertOne({
    userId: foreignId,
    organizationId: `${run}-other-org`,
    role: 'ADMIN',
    active: true,
  });
  const admin = await login(email);
  const foreign = await login(`${foreignId}@example.test`);
  const nurseEmail = `${run}-nurse@example.test`;
  const resource = {
    id: `${run}-resource`,
    displayName: 'Enfermera QA Core',
    territory: 'Zona QA',
    shift: 'MORNING',
    availability: 'AVAILABLE',
    capacity: 1,
    boardRegistrationNumber: `QA-${run}`,
  };
  const nurseAccount = await mutate(admin, '/api/operations', {
    command: 'nurse.create',
    email: nurseEmail,
    password,
    resource,
  });
  qaUserIds.push(nurseAccount.id);
  const nurse = await login(nurseEmail);
  passed.push('Create a real nurse account through authenticated API');

  const contextA = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: headers,
  });
  const page = await contextA.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${base}/login`);
  await page.locator('[data-action-id="AUTH-LOGIN-EMAIL"]').fill(nurseEmail);
  await page.locator('[data-action-id="AUTH-LOGIN-PASSWORD"]').fill(password);
  await page.locator('[data-action-id="AUTH-LOGIN"]').click();
  await page.waitForURL('**/dashboard');
  await page.goto(`${base}/patients`);
  await page.waitForLoadState('networkidle');
  const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
  await page.locator('[data-action-id="PATIENT-CREATE"]').click();
  const dialog = page.getByRole('dialog', { name: 'Agregar paciente' });
  await dialog.getByLabel('Tipo de documento').selectOption('OTHER');
  await dialog.getByLabel('Número de documento').fill(run);
  await dialog.getByLabel('Nombre completo').fill(`Paciente ficticio ${run}`);
  await dialog.getByLabel('Fecha de nacimiento').fill('1990-01-01');
  await dialog.getByLabel('Femenino').check();
  await dialog.getByLabel('Teléfono celular').fill('7000-0000');
  await dialog.getByLabel('Empresa', { exact: true }).fill('Empresa demo');
  await dialog.getByRole('option', { name: 'Empresa demo', exact: true }).click();
  await dialog
    .getByRole('textbox', { name: 'Dirección obligatorio', exact: true })
    .fill('Dirección ficticia de prueba');
  await dialog.getByLabel('Comentarios relevantes de la dirección').fill('Sin datos reales');
  await page.route('**/api/patients', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Guardado rechazado para prueba.' }),
    });
  });
  await dialog.locator('[data-action-id="PATIENT-SAVE"]').click();
  await dialog.getByText('Guardado rechazado para prueba.', { exact: false }).waitFor();
  assert.ok(await dialog.isVisible());
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), storageBefore);
  assert.equal(
    await database.collection('patients').countDocuments({ organizationId, documentId: run }),
    0,
  );
  await page.screenshot({ path: `${output}/save-failure.png` });
  await page.unroute('**/api/patients');
  await dialog.locator('[data-action-id="PATIENT-SAVE"]').click();
  await dialog.waitFor({ state: 'hidden' });
  const persisted = await database
    .collection('patients')
    .findOne({ organizationId, documentId: run });
  assert.ok(persisted, 'Browser-created patient is present directly in Atlas');
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), storageBefore);
  await page.reload();
  const contextB = await browser.newContext({ extraHTTPHeaders: headers });
  const secondPage = await contextB.newPage();
  await secondPage.goto(`${base}/login`);
  await secondPage.locator('[data-action-id="AUTH-LOGIN-EMAIL"]').fill(email);
  await secondPage.locator('[data-action-id="AUTH-LOGIN-PASSWORD"]').fill(password);
  await secondPage.locator('[data-action-id="AUTH-LOGIN"]').click();
  await secondPage.waitForURL('**/dashboard');
  await secondPage.goto(`${base}/patients/${encodeURIComponent(persisted.id)}`);
  await secondPage
    .getByRole('heading', { name: `Paciente ficticio ${run}`, exact: true })
    .waitFor();
  await secondPage.screenshot({ path: `${output}/patient-session-b.png` });
  passed.push(
    'Nurse creates patient in React; rejected save stays open without localStorage; successful save is in Atlas and another browser session reads it',
  );

  const patientResult = await admin.context.get('/api/workspace');
  const workspace = await patientResult.json();
  const patient = workspace.patients.find((row: { id: string }) => row.id === persisted.id);
  assert.ok(patient);
  await mutate(
    admin,
    `/api/patients/${patient.id}`,
    {
      patient: { ...patient, fullName: `Paciente editado ${run}` },
      expectedVersion: workspace.patientVersions[patient.id],
    },
    200,
    'PUT',
  );
  // The repository intentionally uses the same conflict response for a missing,
  // foreign or stale record; verify denial AND unchanged data, not existence disclosure.
  await mutate(foreign, `/api/patients/${patient.id}`, { patient, expectedVersion: 2 }, 409, 'PUT');
  assert.equal((await foreign.context.get(`/api/patients/${patient.id}`)).status(), 404);
  assert.equal(
    (await database.collection('patients').findOne({ organizationId, id: patient.id }))?.fullName,
    `Paciente editado ${run}`,
  );
  const foreignWorkspace = await (await foreign.context.get('/api/workspace')).json();
  assert.ok(!foreignWorkspace.patients.some((row: { id: string }) => row.id === patient.id));
  assert.equal(
    (await nurse.context.post('/api/patients', { data: { patient } })).status(),
    403,
    'Missing CSRF cannot save',
  );
  passed.push('Patient edit, cross-organization exclusion and CSRF enforcement');

  const hospitalization = {
    id: `${run}-case`,
    patientId: patient.id,
    startDate: '2026-09-10',
    status: 'ACTIVE',
    accountType: 'PARTICULAR',
    assignedNursingResourceIds: [resource.id],
  };
  const caseResult = await mutate(admin, '/api/hospitalizations', { hospitalization }, 201);
  assert.deepEqual(caseResult.assignedNurseUserIds, [nurseAccount.id]);
  await mutate(
    admin,
    `/api/hospitalizations/${hospitalization.id}`,
    {
      hospitalization: { ...hospitalization, nextAction: 'Seguimiento ficticio' },
      expectedVersion: 1,
    },
    200,
    'PUT',
  );
  await mutate(
    nurse,
    '/api/hospitalizations',
    { hospitalization: { ...hospitalization, id: `${run}-forbidden` } },
    403,
  );
  await mutate(
    foreign,
    `/api/hospitalizations/${hospitalization.id}`,
    { hospitalization, expectedVersion: 2 },
    400,
    'PUT',
  );
  assert.equal(
    (await foreign.context.get(`/api/hospitalizations/${hospitalization.id}`)).status(),
    404,
  );
  assert.ok(
    await database
      .collection('hospitalizations')
      .findOne({ organizationId, id: hospitalization.id, nextAction: 'Seguimiento ficticio' }),
  );
  passed.push(
    'Hospitalization create/edit persists and resolves assigned nurse user; unauthorized roles and foreign organizations rejected',
  );

  for (const category of ['SPECIALTY', 'INSURER']) {
    await mutate(admin, '/api/operations', {
      command: 'configuration.save',
      entry: {
        id: `${run}-${category}`,
        category,
        label: `${category} ficticio ${run}`,
        active: true,
        ...(category === 'INSURER' ? { discountPercent: 0 } : {}),
      },
    });
  }
  const configurations = (await (await admin.context.get('/api/operations')).json()).configuration;
  assert.ok(configurations.some((row: { id: string }) => row.id === `${run}-SPECIALTY`));
  await secondPage.goto(`${base}/doctors`);
  await secondPage.locator('[data-action-id="DOCTOR-CREATE"]').click();
  const doctorDialog = secondPage.getByRole('dialog', { name: 'Nuevo médico' });
  await doctorDialog.getByLabel('Nombre completo').fill(`Médico ficticio ${run}`);
  await doctorDialog.getByLabel('JVPM', { exact: true }).fill(`QA-${run}`);
  await doctorDialog.getByLabel('DUI', { exact: true }).fill('00000000-0');
  await doctorDialog.getByLabel('Especialidad o profesión').fill(`SPECIALTY ficticio ${run}`);
  await doctorDialog
    .getByRole('option', { name: `SPECIALTY ficticio ${run}`, exact: true })
    .click();
  await doctorDialog.getByLabel('Dirección', { exact: true }).fill('Dirección ficticia');
  await doctorDialog.locator('[data-action-id="DOCTOR-SAVE"]').click();
  await doctorDialog.waitFor({ state: 'hidden' });
  const doctor = await database
    .collection('doctors')
    .findOne({ organizationId, fullName: `Médico ficticio ${run}` });
  assert.ok(doctor, 'Doctor created through React persists in Atlas');
  const doctorWorkspace = await (await admin.context.get('/api/workspace')).json();
  const publicDoctor = doctorWorkspace.doctors.find((row: { id: string }) => row.id === doctor.id);
  await mutate(
    admin,
    `/api/doctors/${doctor.id}`,
    {
      doctor: { ...publicDoctor, address: 'Dirección ficticia editada' },
      expectedVersion: doctorWorkspace.doctorVersions[doctor.id],
    },
    200,
    'PUT',
  );
  assert.equal((await foreign.context.get(`/api/doctors/${doctor.id}`)).status(), 404);
  passed.push(
    'Doctor created in React from the Mongo specialty selector; API edit and foreign-organization denial',
  );

  // File bodies live in private GridFS; verify bytes again under a different session.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLl8AAAAASUVORK5CYII=',
    'base64',
  );
  for (const [ownerType, ownerId] of [
    ['patient', patient.id],
    ['hospitalization', hospitalization.id],
    ['doctor', doctor.id],
  ]) {
    const uploaded = await admin.context.post('/api/files', {
      headers: { 'x-analiza-csrf': admin.csrf },
      multipart: {
        ownerType,
        ownerId,
        file: { name: `documento-ficticio-${ownerType}.png`, mimeType: 'image/png', buffer: png },
      },
    });
    assert.equal(uploaded.status(), 201, `${ownerType} private attachment upload`);
    const fileId = (await uploaded.json()).id;
    const authorizedSession = ownerType === 'doctor' ? contextB.request : nurse.context;
    const download = await authorizedSession.get(`${base}/api/files/${fileId}`);
    assert.equal(download.status(), 200);
    assert.deepEqual(await download.body(), png);
    const deniedFile = await foreign.context.get(`/api/files/${fileId}`);
    assert.equal(
      deniedFile.status(),
      404,
      'Foreign and nonexistent private files are indistinguishable',
    );
    assert.ok(!(await deniedFile.text()).includes(`documento-ficticio-${ownerType}`));
  }
  passed.push(
    'Patient, hospitalization and doctor private PNG uploads persist; second session recovers exact bytes, foreign organization denied',
  );
  await mutate(admin, '/api/operations', { command: 'purchase.create' }, 404);
  const shift = {
    id: `${run}-shift`,
    resourceId: resource.id,
    patientId: patient.id,
    startsAt: '2026-12-10T08:00:00.000Z',
    endsAt: '2026-12-10T14:00:00.000Z',
    status: 'SCHEDULED',
  };
  await mutate(admin, '/api/shifts', { shifts: [shift], idempotencyKey: `${run}-series` }, 201);
  await mutate(admin, '/api/shifts', { shifts: [shift], idempotencyKey: `${run}-series` }, 201);
  await mutate(
    admin,
    '/api/shifts',
    { shifts: [{ ...shift, id: `${run}-collision` }], idempotencyKey: `${run}-collision` },
    400,
  );
  assert.equal(
    await database.collection('shifts').countDocuments({ organizationId, id: shift.id }),
    1,
  );
  passed.push(
    'Catalog options persist; scheduling is idempotent and rejects collisions; hidden commands rejected',
  );
  for (const route of [
    '/dashboard',
    '/patients',
    '/hospitalizations',
    '/agenda',
    '/nursing-team',
    '/catalogs/operational',
    '/doctors',
  ]) {
    await secondPage.goto(`${base}${route}`);
    await secondPage.waitForLoadState('networkidle');
    assert.ok(await secondPage.locator('h1').count(), `${route} renders`);
    assert.equal(
      await secondPage
        .locator('nav a[href="/quotes"], nav a[href="/clinical"], nav a[href="/payments"]')
        .count(),
      0,
    );
  }
  await secondPage.goto(`${base}/quotes`);
  await secondPage.waitForURL('**/dashboard');
  await secondPage.setViewportSize({ width: 390, height: 844 });
  await secondPage.goto(`${base}/patients`);
  await secondPage.locator('[data-action-id="PATIENT-CREATE"]').click();
  await secondPage.getByRole('dialog').waitFor();
  assert.equal(
    await secondPage.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'No page overflow on mobile',
  );
  await secondPage.screenshot({ path: `${output}/patient-mobile.png` });
  assert.deepEqual(pageErrors, []);
  passed.push(
    'Core pages render, hidden routes redirect, mobile patient dialog has no viewport overflow',
  );
  if (process.env.ANALIZA_VERIFY_SELENIUM === '1') {
    const selenium = spawnSync(process.execPath, ['scripts/verify-core-selenium.mjs'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        MONGODB_INITIAL_ADMIN_EMAIL: email,
        MONGODB_INITIAL_ADMIN_PASSWORD: password,
      },
    });
    assert.equal(selenium.status, 0, 'Connected Selenium regression');
    passed.push(
      'Three connected Selenium checks: navigation, patient dialog and mobile hospitalization',
    );
  }
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        run,
        base,
        passed,
        patientId: patient.id,
        caseId: hospitalization.id,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.info(JSON.stringify({ run, base, passed, report: `${output}/report.json` }, null, 2));
} finally {
  await Promise.all(clients.map((context) => context.dispose()));
  await browser.close();
  // Preserve QA evidence in its isolated tenant, but revoke every generated account/session.
  if (qaUserIds.length) {
    await database
      .collection('memberships')
      .updateMany({ userId: { $in: qaUserIds } }, { $set: { active: false } });
    await database
      .collection('users')
      .updateMany({ id: { $in: qaUserIds } }, { $set: { disabledAt: new Date() } });
    await database
      .collection('sessions')
      .updateMany({ userId: { $in: qaUserIds } }, { $set: { revokedAt: new Date() } });
  }
  await closeMongoClient();
}
