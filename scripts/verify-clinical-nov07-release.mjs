// Public black-box smoke restricted to the operator-provisioned synthetic organization.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { request, chromium, expect } from '@playwright/test';

const baseURL = process.env.CLINICAL_RELEASE_URL;
assert.ok(baseURL?.startsWith('https://'));
const account = JSON.parse(fs.readFileSync(process.env.CLINICAL_RELEASE_ACCOUNT_FILE, 'utf8'));
assert.equal(account.organizationId, '157a0046-7ed7-4bd6-85b8-005431466298');
assert.equal(account.organizationId, process.env.CLINICAL_RELEASE_QA_ORG);
const api = await request.newContext({ baseURL });
let browser;
try {
  assert.equal((await api.get('/api/health')).status(), 200);
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
  assert.ok(patient, 'Only the pre-existing synthetic patient may be used');
  assert.ok(workspace.doctors.some((d) => d.id === 'doctor-synthetic-clinical-release'));
  const run = Date.now().toString(),
    date = '2026-11-07';
  const caseId = `case-synthetic-nov07-${run}`,
    itemId = `item-synthetic-nov07-${run}`,
    warehouseId = `warehouse-synthetic-nov07-${run}`,
    quoteId = `quote-synthetic-nov07-${run}`;
  const name = `Medicamento sintético QA ${run}`;
  async function post(path, data, status = 200) {
    const response = await api.post(path, { headers, data });
    assert.equal(response.status(), status, `${path}: ${await response.text()}`);
    return response.json();
  }
  const op = (data) => post('/api/operations', data);
  await post(
    '/api/hospitalizations',
    {
      hospitalization: {
        id: caseId,
        patientId: patient.id,
        startDate: date,
        status: 'ACTIVE',
        accountType: 'QA sintético',
        primaryDoctorId: 'doctor-synthetic-clinical-release',
        diagnosisSummary: 'Validación de software; sin uso clínico',
      },
    },
    201,
  );
  await op({
    command: 'catalog.save',
    item: {
      id: itemId,
      sku: `QA07-${run}`,
      name,
      category: 'MEDICATIONS',
      status: 'ACTIVE',
      salePriceExcludingTax: 0,
      createdAt: new Date().toISOString(),
    },
  });
  await op({
    command: 'warehouse.save',
    warehouse: {
      id: warehouseId,
      code: `QA07-${run}`,
      name: 'Origen sintético QA ' + run,
      status: 'ACTIVE',
    },
  });
  await op({
    command: 'inventory.record',
    idempotencyKey: `receipt-nov07-${run}`,
    movement: {
      id: `receipt-nov07-${run}`,
      itemId,
      warehouseId,
      kind: 'ENTRY',
      quantity: 5,
      reason: 'Existencias sintéticas de verificación',
      createdAt: new Date().toISOString(),
    },
  });
  await op({
    command: 'configuration.save',
    entry: {
      id: `rule-nov07-${run}`,
      category: 'MEDICATION_STOCK',
      label: name,
      inventoryItemId: itemId,
      warehouseId,
      unitsPerApplication: 2,
      active: true,
    },
  });
  await post(
    '/api/quotes',
    {
      quote: {
        id: quoteId,
        patientId: patient.id,
        caseId,
        version: 1,
        status: 'DRAFT',
        summary: 'Cotización sintética de verificación',
        createdAt: new Date().toISOString(),
        items: [
          {
            id: 'med',
            inventoryItemId: itemId,
            category: 'MEDICATIONS',
            name,
            quantity: 2,
            unitPrice: 0,
            discountAmount: 0,
          },
        ],
      },
    },
    201,
  );
  const medicationId = `${quoteId}:med`;
  const base = { patientId: patient.id, caseId, date };
  const card = await op({
    command: 'clinical.record',
    record: {
      ...base,
      id: `card-nov07-${run}`,
      payload: {
        kind: 'MEDICATION_CARD',
        chronic: '',
        instructions: '',
        stock: [],
        schedule: [
          {
            medicationId,
            times: ['08:00', '16:00'],
            dilution: 'Texto sintético capturado por el equipo',
          },
        ],
      },
    },
  });
  assert.deepEqual(card.medications[0].applicationTimes, ['08:00', '16:00']);
  assert.equal(card.medications[0].inventoryItemId, itemId);
  const administration = {
    ...base,
    id: `admin-nov07-${run}`,
    payload: {
      kind: 'ADMINISTRATION',
      cardId: card.id,
      time: '08:05',
      dose: 'Captura sintética',
      presentation: 'Tableta',
      route: 'Oral',
      items: [
        { medicationId, scheduledTime: '08:00', applied: true, reason: '' },
        { medicationId, scheduledTime: '16:00', applied: false, reason: 'Omisión sintética QA' },
      ],
    },
  };
  const saved = await op({ command: 'clinical.record', record: administration });
  await op({ command: 'clinical.record', record: administration });
  assert.equal(saved.payload.stock[0].unitsPerApplication, 2);
  assert.equal(saved.stockMovementIds.length, 1);
  const corrected = await op({
    command: 'clinical.record',
    record: {
      ...administration,
      id: `admin-correction-nov07-${run}`,
      correctionOf: administration.id,
      correctionReason: 'Verificación sintética de compensación por horario',
      payload: {
        ...administration.payload,
        items: administration.payload.items.map((i) => ({
          ...i,
          applied: false,
          reason: 'Corrección sintética QA',
        })),
      },
    },
  });
  assert.equal(corrected.version, 2);
  const snapshot = await (await api.get('/api/operations')).json();
  assert.equal(snapshot.clinicalRecords.filter((r) => r.id === administration.id).length, 1);
  assert.equal(snapshot.medicationReturns.filter((r) => r.caseId === caseId).length, 2);
  const afterWorkspace = await (await api.get('/api/workspace')).json();
  const movements = afterWorkspace.inventoryMovements.filter((m) => m.itemId === itemId);
  assert.equal(
    movements.filter((m) => m.kind === 'EXIT').reduce((n, m) => n + m.quantity, 0),
    2,
  );
  assert.equal(
    movements.filter((m) => m.kind === 'ENTRY').reduce((n, m) => n + m.quantity, 0),
    7,
  );
  console.log(
    'PASS live scheduled persistence, configured consumption, retry, per-hour reversal and distinct returns in synthetic organization',
  );
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ baseURL, storageState: await api.storageState() });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    '/clinical?patient=' + encodeURIComponent(patient.id) + '&case=' + encodeURIComponent(caseId),
  );
  await page.getByRole('button', { name: 'Imprimir sección', exact: true }).click();
  const print = page.getByRole('dialog');
  await print.getByRole('checkbox', { name: /^Resumen/ }).uncheck();
  await print.getByRole('checkbox', { name: /^Acciones de enfermería/ }).check();
  await page.evaluate(() => {
    window.print = () => {};
  });
  await print.getByRole('button', { name: 'Imprimir selección' }).click();
  await expect(page.locator('#clinical-print-root')).toContainText(name);
  await expect(page.locator('#clinical-print-root')).toContainText(
    'Horas de aplicación: 08:00 · 16:00',
  );
  await expect(page.locator('#clinical-print-root')).not.toContainText('Resumen · cotizaciones');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await print.getByRole('button', { name: 'Cancelar', exact: true }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/clinical/orders');
    await page.getByRole('button', { name: 'Acciones de enfermería', exact: true }).click();
    await page
      .locator('.clinical-action-grid')
      .getByRole('button', { name: 'Administración de medicamentos', exact: true })
      .click();
    await page.getByRole('searchbox', { name: 'Buscar por nombre o DUI' }).fill(patient.fullName);
    await page
      .locator('.clinical-patient-list')
      .getByRole('button', { name: 'Administración de medicamentos', exact: true })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('combobox', { name: 'Hospitalización', exact: true })
      .selectOption(caseId);
    await dialog.getByLabel('Fecha', { exact: true }).fill(date);
    await expect(dialog.getByText('Hora programada · 08:00', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Hora programada · 16:00', { exact: true })).toBeVisible();
    await expect(dialog.getByText('No aplicación registrada', { exact: true })).toHaveCount(2);
    await expect(dialog.getByText(/Salida de inventario/)).toHaveCount(0);
    assert.ok(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth + 1));
    await page.screenshot({ path: `.local/clinical-nov07-live-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  }
  await page.goto('/catalogs/clinical');
  await page.getByRole('button', { name: 'Consumo de medicamentos', exact: true }).click();
  await page.getByLabel('Buscar', { exact: true }).fill(name);
  await expect(page.locator('.clinical-patient-list')).toContainText('2 unidades por aplicación');
  assert.deepEqual(errors, []);
  assert.equal((await api.get('/api/health')).status(), 200);
  console.log(
    JSON.stringify({
      status: 'PASS',
      syntheticCaseId: caseId,
      syntheticCardId: card.id,
      checks: [
        'persistence',
        'inventory',
        'idempotency',
        'correction',
        'returns',
        'section-print',
        'responsive',
        'configuration',
        'health',
      ],
    }),
  );
} finally {
  await browser?.close();
  await api.dispose();
}
