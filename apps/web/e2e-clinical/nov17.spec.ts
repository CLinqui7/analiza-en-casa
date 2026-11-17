import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const evidence = process.env.NOV17_QA_RESULT
  ? JSON.parse(readFileSync(process.env.NOV17_QA_RESULT, 'utf8'))
  : null;
const secret = process.env.ANALIZA_QA_PASSWORD;
if (!evidence?.patientId?.startsWith('nov17-p-') || !secret)
  throw new Error('Run isolated Nov17 integration first.');
const screenshots = resolve('.local/nov17-screenshots');
mkdirSync(screenshots, { recursive: true });
async function login(page: Page, path: string, role = 'admin') {
  await page.goto('/login?next=' + encodeURIComponent(path));
  await page.getByLabel('Usuario o correo').fill(`qa-${role}@example.test`);
  await page.getByLabel('Clave').fill(secret!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page
    .waitForURL((url) => url.pathname === path.split('?')[0], { timeout: 30000 })
    .catch(() => {
      throw new Error('No se pudo iniciar la sesión sintética de QA.');
    });
}
async function api(
  page: Page,
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
) {
  return page.evaluate(
    async ({ path, body, method }) => {
      const csrf = method === 'GET' ? null : await (await fetch('/api/auth/csrf')).json();
      const response = await fetch(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-analiza-csrf': csrf.csrfToken } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, body, method },
  );
}
async function saveScreenshot(page: Page, name: string) {
  await page.screenshot({ path: resolve(screenshots, name + '.png'), animations: 'disabled' });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}
async function makeQuote(page: Page, careSetting = 'HOSPITALIZATION') {
  const id = randomUUID();
  const response = await api(page, '/api/quotes', {
    quote: {
      id,
      patientId: evidence.patientId,
      version: 1,
      status: 'DRAFT',
      immutable: false,
      summary: 'Cotización de navegador sintética',
      careSetting,
      primaryDoctorId: evidence.doctorId,
      admissionDate: '2026-11-17',
      createdAt: new Date().toISOString(),
      manager: 'Responsable QA',
      items: [
        {
          id: randomUUID(),
          inventoryItemId: evidence.itemId,
          category: 'SUPPLIES',
          name: 'Insumo de navegador sintético',
          quantity: 2,
          unitPrice: 10,
          discountAmount: 0,
        },
      ],
    },
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body;
}

test('Nov17 dependents save with private documents, reload and mobile layout', async ({ page }) => {
  await login(page, '/patients?edit=' + evidence.patientId);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[name="birthDate"]').fill('1990-01-01');
  await dialog.locator('[name="sex"][value="F"]').check();
  await dialog.locator('[name="phone"]').fill('0000-0000');
  await dialog.locator('[name="address.line"]').fill('Dirección sintética QA');
  await dialog.locator('[name="address.comments"]').fill('Referencia sintética QA');
  await dialog.getByRole('button', { name: 'Agregar dependiente' }).click();
  const child = dialog.locator('.dependent-card').last();
  await child.getByLabel('Nombres', { exact: true }).fill('Segundo hijo');
  await child.getByLabel('Apellidos').fill('Sintético QA');
  await child.getByLabel('Género').selectOption('M');
  await child.getByLabel('Fecha de nacimiento').fill('2021-05-01');
  for (const label of ['Partida de nacimiento', 'Consentimiento'])
    await child.getByLabel(label).setInputFiles({
      name: `qa-${label}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\nSynthetic QA only\n%%EOF'),
    });
  await page.setViewportSize({ width: 390, height: 844 });
  await saveScreenshot(page, 'dependents-mobile');
  await dialog.locator('[data-action-id="PATIENT-EDIT-SUBMIT"]').click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/patients/' + evidence.patientId);
  await expect(page.locator('.dependent-summary-grid')).toContainText('Segundo hijo');
  const files = await api(page, `/api/files?ownerType=patient&ownerId=${evidence.patientId}`);
  expect(files.status).toBe(200);
  expect(
    files.body.filter((file: { documentKind?: string }) => file.documentKind === 'CONSENT').length,
  ).toBeGreaterThan(0);
  const download = await page.evaluate(async (id) => {
    const r = await fetch('/api/files/' + id);
    return { status: r.status, text: await r.text() };
  }, files.body.at(-1).id);
  expect(download.status).toBe(200);
  expect(download.text).toContain('%PDF');
  await saveScreenshot(page, 'dependent-record-mobile');
});

test('Nov17 quote owner, manual Enviada, edit one logical quote and approve all modalities', async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page, '/quotes?create=1');
  await expect(page.getByLabel('Responsable administrativo')).toHaveValue('Usuario ficticio ADMIN');
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  const quote = await makeQuote(page);
  await page.goto('/quotes');
  const code = 'COT-' + quote.id.replaceAll('-', '').slice(-8).toUpperCase();
  const search = page.locator('[data-action-id="QUOTE-SEARCH"]');
  await search.fill(code);
  await page.getByRole('button', { name: 'Enviada', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Cotización marcada como enviada' }),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: code }).getByText('Enviada', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Motivo de revisión').fill('Edición sintética de navegador');
  await dialog.locator('[data-action-id="QUOTE-ITEM-EDIT"]').first().click();
  await dialog.getByLabel('Cantidad', { exact: true }).fill('3');
  await dialog.getByRole('button', { name: /Guardar línea|Actualizar línea/ }).click();
  await dialog.locator('[data-action-id="QUOTE-REVISE-SUBMIT"]').click();
  await expect(dialog).toHaveCount(0);
  await search.fill(code);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('30.00');
  const versions = (await api(page, '/api/quotes')).body.quotes
    .map((row: { quote: { rootQuoteId: string } }) => row.quote)
    .filter((item: { rootQuoteId: string }) => item.rootQuoteId === quote.id);
  expect(versions).toHaveLength(2);
  expect(versions.find((q: { version: number }) => q.version === 1).total).toBe(20);
  await saveScreenshot(page, 'quotes-logical-status');
  for (const careSetting of ['HOSPITALIZATION', 'HOME_OUTPATIENT', 'CLINIC_OUTPATIENT']) {
    const item = await makeQuote(page, careSetting);
    const decision = { id: randomUUID(), decision: 'APPROVED', reason: null };
    const approved = await api(page, `/api/quotes/${item.id}/decision`, decision);
    expect(approved.status, JSON.stringify(approved.body)).toBe(201);
    expect((await api(page, `/api/quotes/${item.id}/decision`, decision)).status).toBe(200);
    await page.goto('/quotes?search=' + item.id);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(
      page.locator('tbody tr').getByRole('link', { name: 'Editar', exact: true }),
    ).toHaveCount(0);
  }
  await page.goto('/clinical/hospitalizations');
  for (const type of ['HOME_OUTPATIENT', 'CLINIC_OUTPATIENT', 'HOSPITALIZATION']) {
    await page.locator('[data-action-id="CLINICAL-CARE-SETTING-FILTER"]').selectOption(type);
    const cases = await api(page, '/api/hospitalizations');
    expect(cases.status).toBe(200);
    await expect(page.locator('tbody tr').first()).toBeVisible();
  }
  await page.locator('[data-action-id="CLINICAL-CARE-SETTING-FILTER"]').selectOption('');
  await saveScreenshot(page, 'clinical-all-settings');
  const rejected = await makeQuote(page, 'HOME_OUTPATIENT');
  expect(
    (
      await api(page, `/api/quotes/${rejected.id}/decision`, {
        id: randomUUID(),
        decision: 'NOT_APPROVED',
        reason: 'Propuesta sintética no aceptada',
      })
    ).status,
  ).toBe(201);
  const rejectedRecord = (await api(page, `/api/quotes/${rejected.id}`)).body.quote;
  expect(rejectedRecord.status).toBe('DRAFT');
  await page.goto('/quotes?search=' + rejected.id);
  await expect(page.locator('tbody tr')).toContainText('Rechazada');
  await expect(
    page.locator('tbody tr').getByRole('link', { name: 'Editar', exact: true }),
  ).toHaveCount(0);
});

test('Nov17 prequote assignment, nurse delivery, supplier CRUD and responsive screens', async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page, '/quotes');
  const quote = await makeQuote(page);
  expect((await api(page, `/api/quotes/${quote.id}/send`, { expectedVersion: 1 })).status).toBe(
    200,
  );
  const request = await api(page, '/api/supply-requests', {
    idempotencyKey: randomUUID(),
    patientId: evidence.patientId,
    catalogItemId: evidence.itemId,
    quantity: 2,
    priority: 'MEDIUM',
    note: 'Solicitud QA navegador',
  });
  expect(request.status).toBe(201);
  await page.goto('/clinical/prequotes');
  await page.locator('tbody tr').first().getByRole('button', { name: 'Revisar solicitud' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Asignar a una cotización').selectOption(quote.id);
  await saveScreenshot(page, 'prequote-assignment');
  await dialog.getByRole('button', { name: 'Guardar asignación' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Solicitud asignada' })).toBeVisible();
  await page.goto('/inventory/received-orders');
  const code = 'COT-' + quote.id.replaceAll('-', '').slice(-8).toUpperCase();
  await page
    .locator('tbody tr')
    .filter({ hasText: code })
    .first()
    .getByRole('button', { name: 'Visualizar pedido' })
    .click();
  await dialog.getByLabel('Enfermera receptora').selectOption('qa-resource');
  await saveScreenshot(page, 'delivery-dialog');
  await dialog.getByRole('button', { name: 'Entregado', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('tbody tr').filter({ hasText: code }).first()).toContainText(
    'Entregado',
  );
  await page.goto('/inventory');
  await page.locator('[data-action-id="INVENTORY-SUPPLIERS-OPEN"]').click();
  await expect(page).toHaveURL(/\/inventory\/suppliers$/);
  await page.getByRole('button', { name: 'Nuevo proveedor' }).click();
  const name = 'Proveedor sintético navegador ' + Date.now();
  await dialog.getByLabel('Empresa / nombre').fill(name);
  await dialog.getByLabel('Contacto', { exact: true }).fill('Contacto sintético');
  await dialog.getByLabel('Correo', { exact: true }).fill('proveedor-qa@example.test');
  await dialog.getByLabel('Dirección y notas').fill('Dirección sintética de prueba');
  await dialog.getByRole('button', { name: 'Guardar proveedor' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.supplier-card').filter({ hasText: name })).toContainText(
    'Contacto sintético',
  );
  await page
    .locator('.supplier-card')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Editar proveedor' })
    .click();
  await expect(dialog.getByLabel('Correo', { exact: true })).toHaveValue(
    'proveedor-qa@example.test',
  );
  await dialog.getByLabel('Teléfono celular').fill('0000-0000');
  await dialog.getByRole('button', { name: 'Guardar proveedor' }).click();
  await expect(dialog).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await saveScreenshot(page, 'suppliers-mobile');
  await page.goto('/catalogs');
  await expect(page.getByRole('button', { name: 'Proveedores', exact: true })).toHaveCount(0);
  for (const [path, name] of [
    ['/clinical/prequotes', 'prequotes-mobile'],
    ['/inventory/received-orders', 'orders-mobile'],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await saveScreenshot(page, name);
  }
});
