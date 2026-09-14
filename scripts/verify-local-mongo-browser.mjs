import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.ANALIZA_VERIFY_URL || 'http://localhost:3110';
const protectionBypass = process.env.ANALIZA_PREVIEW_BYPASS;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
  ...(protectionBypass
    ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': protectionBypass } }
    : {}),
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await mkdir('.local/mongo-verification', { recursive: true });
try {
  await page.goto(`${base}/login`);
  await page.getByLabel('Usuario o correo').fill(process.env.MONGODB_INITIAL_ADMIN_EMAIL);
  await page.getByLabel('Clave', { exact: true }).fill(process.env.MONGODB_INITIAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.waitForURL('**/dashboard', { timeout: 45000 });
  const response = await context.request.get(`${base}/api/workspace`);
  const workspace = await response.json();
  assert.equal(response.status(), 200, `Workspace rejected: ${workspace.error}`);
  assert.ok(workspace.patients.length >= 3);
  await page.getByText('Cargando indicadores sintéticos…').waitFor({ state: 'hidden' });
  const loadError = page.getByText('No fue posible cargar el dashboard:', { exact: false });
  assert.equal(
    await loadError.count(),
    0,
    (await loadError.count()) ? await loadError.innerText() : 'Workspace rendered',
  );
  await page.screenshot({ path: '.local/mongo-verification/dashboard.png' });
  // Real React form + simulated server failure: do not close, announce success or fall back to localStorage.
  await page.goto(`${base}/patients`);
  await page.waitForLoadState('networkidle');
  const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
  await page.locator('[data-action-id="PATIENT-CREATE"]').click();
  const patientDialog = page.getByRole('dialog', { name: 'Agregar paciente' });
  await patientDialog.getByLabel('Tipo de documento').selectOption('OTHER');
  await patientDialog.getByLabel('Número de documento').fill('QA-SAVE-FAILURE');
  await patientDialog.getByLabel('Nombre completo').fill('Paciente QA Guardado Fallido');
  await patientDialog.getByLabel('Fecha de nacimiento').fill('1990-01-01');
  await patientDialog.getByLabel('Femenino').check();
  await patientDialog.getByLabel('Teléfono celular').fill('7000-0000');
  await patientDialog.getByLabel('Empresa').fill('Empresa demo');
  await patientDialog.getByRole('option', { name: 'Empresa demo', exact: true }).click();
  await patientDialog
    .getByRole('textbox', { name: 'Dirección obligatorio', exact: true })
    .fill('Dirección ficticia QA');
  await patientDialog.getByLabel('Comentarios relevantes de la dirección').fill('Referencia QA');
  let rejectedSaves = 0;
  await page.route('**/api/patients', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    rejectedSaves++;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Error de guardado simulado para QA.' }),
    });
  });
  await patientDialog.locator('[data-action-id="PATIENT-SAVE"]').click();
  await patientDialog.getByText('Error de guardado simulado para QA.', { exact: false }).waitFor();
  assert.equal(rejectedSaves, 1);
  assert.ok(await patientDialog.isVisible());
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), storageBefore);
  assert.ok(
    !(await (await context.request.get(`${base}/api/workspace`)).json()).patients.some(
      (row) => row.documentId === 'QA-SAVE-FAILURE',
    ),
  );
  await page.screenshot({ path: '.local/mongo-verification/patient-save-failure.png' });
  await page.unroute('**/api/patients');

  // Purchase drafts use the real tenant-scoped command. A failed command must keep
  // the dialog open and must never announce success; a successful retry must survive reload.
  await page.goto(`${base}/purchases`);
  await page.waitForLoadState('networkidle');
  const purchaseAction = page.locator('[data-action-id="PURCHASE-CREATE"]');
  assert.ok(
    await purchaseAction.isEnabled(),
    'A synthetic catalog item is required for purchase verification',
  );
  await purchaseAction.click();
  const purchaseDialog = page.getByRole('dialog', { name: 'Nueva compra sintética' });
  const purchaseReference = `PURCHASE-QA-${Date.now()}`;
  await purchaseDialog.getByLabel('Referencia de compra').fill(purchaseReference);
  await purchaseDialog.getByLabel('Nota (opcional)').fill('Borrador sintético de verificación');
  let rejectedPurchaseSaves = 0;
  await page.route('**/api/operations', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const body = route.request().postDataJSON();
    if (body?.command !== 'purchase.create') return route.continue();
    rejectedPurchaseSaves++;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Error de compra simulado para QA.' }),
    });
  });
  await purchaseDialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await page.getByText('Error de compra simulado para QA.', { exact: false }).waitFor();
  assert.equal(rejectedPurchaseSaves, 1);
  assert.ok(await purchaseDialog.isVisible());
  assert.equal(await page.getByText('Compra sintética guardada', { exact: false }).count(), 0);
  await page.unroute('**/api/operations');
  await purchaseDialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await page.getByText('Compra sintética guardada', { exact: false }).waitFor();
  await page.reload();
  await page.getByLabel('Buscar compras').fill(purchaseReference);
  await page.getByText(purchaseReference, { exact: true }).waitFor();
  const purchasesAfter = (await (await context.request.get(`${base}/api/workspace`)).json())
    .purchases;
  assert.ok(purchasesAfter.some((row) => row.reference === purchaseReference));
  await page.screenshot({ path: '.local/mongo-verification/purchases.png' });

  for (const route of [
    'patients',
    'hospitalizations',
    'quotes',
    'receivables',
    'insurance',
    'agenda',
    'catalogs/operational',
    'clinical/balance',
    'clinical/administrations',
    'nursing-team',
    'reports/visits-goals',
    'changes',
    'inventory/kardex',
    'inventory/movements',
  ]) {
    await page.goto(`${base}/${route}`);
    await page.waitForLoadState('networkidle');
    if (route === 'patients')
      assert.ok(
        (await page.getByText(workspace.patients[0].fullName, { exact: true }).count()) > 0,
        'Mongo patient must render in React',
      );
    await page.screenshot({ path: `.local/mongo-verification/${route.replaceAll('/', '-')}.png` });
    const createAction = {
      patients: 'PATIENT-CREATE',
      hospitalizations: 'HOSPITALIZATION-CREATE',
      quotes: 'QUOTE-CREATE',
      'nursing-team': 'NURSE-ACCOUNT-CREATE',
      'catalogs/operational': 'CONFIGURATION-CREATE',
      'clinical/administrations': 'MEDICATION-ADMINISTER',
      'reports/visits-goals': 'HOME-VISIT-CREATE',
    }[route];
    if (createAction) {
      const button = page.locator(`[data-action-id="${createAction}"]`).first();
      if ((await button.count()) && (await button.isEnabled())) {
        await button.click();
        await page.getByRole('dialog').first().waitFor({ state: 'visible' });
        await page.screenshot({
          path: `.local/mongo-verification/${route.replaceAll('/', '-')}-dialog.png`,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({
          path: `.local/mongo-verification/${route.replaceAll('/', '-')}-mobile-dialog.png`,
        });
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
          `${route} mobile overflow`,
        );
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
    }
  }
  assert.deepEqual(errors, []);
  const result = {
    verifiedAt: new Date().toISOString(),
    base,
    provider: 'mongodb',
    patients: workspace.patients.length,
    hospitalizations: workspace.hospitalizations.length,
    quotes: workspace.quotes.length,
    purchases: purchasesAfter.length,
    saveFailureVerified: true,
    purchaseFailureVerified: true,
    browserErrors: errors,
  };
  await writeFile('.local/mongo-verification/browser-report.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
