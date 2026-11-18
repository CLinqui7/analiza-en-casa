import { test, expect, type Page, type BrowserContext } from '@playwright/test';
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
const sessions = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>();
async function login(page: Page, path: string, role = 'admin') {
  const cookies = sessions.get(role);
  if (cookies) {
    await page.context().addCookies(cookies);
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    return;
  }
  await page.goto('/login?next=' + encodeURIComponent(path));
  await page.getByLabel('Usuario o correo').fill(`qa-${role}@example.test`);
  await page.getByLabel('Clave').fill(secret!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page
    .waitForURL((url) => url.pathname === path.split('?')[0], { timeout: 30000 })
    .catch(() => {
      throw new Error('No se pudo iniciar la sesión sintética de QA.');
    });
  sessions.set(role, await page.context().cookies());
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
  await login(page, '/quotes');
  expect(
    (await api(page, '/api/quotes/form-draft?key=quote.create.new', {}, 'DELETE')).status,
  ).toBe(200);
  await page.goto('/quotes?create=1');
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
  await expect(dialog.locator('[data-action-id="QUOTE-REVISE-SUBMIT"]')).toBeEnabled();
  await dialog.getByLabel('Motivo de revisión').fill('Edición sintética de navegador');
  await expect(dialog.getByLabel('Motivo de revisión')).toHaveValue(
    'Edición sintética de navegador',
  );
  await dialog.locator('[data-action-id="QUOTE-ITEM-EDIT"]').first().click();
  await dialog.getByRole('spinbutton', { name: /^Cantidad/ }).fill('3');
  await dialog.getByRole('button', { name: /Guardar línea|Actualizar línea/ }).click();
  await expect(dialog.getByLabel('Motivo de revisión')).toHaveValue(
    'Edición sintética de navegador',
  );
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
    const admissions = (await api(page, '/api/hospitalizations')).body.hospitalizations
      .map(
        (entry: { hospitalization: { linkedQuoteIds: string[]; careSetting: string } }) =>
          entry.hospitalization,
      )
      .filter((entry: { linkedQuoteIds?: string[] }) => entry.linkedQuoteIds?.includes(item.id));
    expect(admissions).toHaveLength(1);
    expect(admissions[0].careSetting).toBe(careSetting);
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
  const rejectedRecord = (await api(page, '/api/quotes')).body.quotes.find(
    (entry: { quote: { id: string } }) => entry.quote.id === rejected.id,
  ).quote;
  expect(rejectedRecord.status).toBe('DRAFT');
  await page.goto('/quotes?search=' + rejected.id);
  await expect(page.locator('tbody tr')).toContainText('Rechazada');
  await expect(
    page.locator('tbody tr').getByRole('link', { name: 'Editar', exact: true }),
  ).toHaveCount(0);
});

test('Nov17 prequote refresh, assignment, nurse delivery, supplier table CRUD and responsive screens', async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page, '/quotes');
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
  await expect(page.locator('tbody tr').first()).toBeVisible();
  // A quote created after loading the inbox must be available without reloading the page.
  const quote = await makeQuote(page);
  expect((await api(page, `/api/quotes/${quote.id}/send`, { expectedVersion: 1 })).status).toBe(
    200,
  );
  await page.locator('tbody tr').first().getByRole('button', { name: 'Revisar solicitud' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Asignar a una cotización').selectOption(quote.id);
  const otherQuote = await makeQuote(page);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.locator('tbody tr').first().getByRole('button', { name: 'Revisar solicitud' }).click();
  await expect(
    dialog.getByLabel('Asignar a una cotización').locator(`option[value="${otherQuote.id}"]`),
  ).toHaveCount(1);
  await page.route('**/api/prequotes?requestId=*', (route) =>
    route.fulfill({ status: 503, json: { error: 'Interrupción sintética de consulta' } }),
  );
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.locator('tbody tr').first().getByRole('button', { name: 'Revisar solicitud' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Interrupción sintética');
  await expect(dialog.getByRole('button', { name: 'Añadir a cotización' })).toBeDisabled();
  await expect(
    dialog.getByText('Este paciente no tiene cotizaciones disponibles', { exact: false }),
  ).toHaveCount(0);
  await page.unroute('**/api/prequotes?requestId=*');
  await dialog.getByRole('button', { name: 'Reintentar consulta', exact: true }).click();
  await dialog.getByLabel('Asignar a una cotización').selectOption(quote.id);
  await saveScreenshot(page, 'prequote-assignment');
  await dialog.getByRole('button', { name: 'Añadir a cotización' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Solicitud asignada' })).toBeVisible();
  const code = 'COT-' + quote.id.replaceAll('-', '').slice(-8).toUpperCase();
  await page.goto('/receivables');
  const account = page.getByRole('row').filter({ hasText: code });
  await expect(account).toHaveCount(1);
  await expect(account).toContainText('40.00');
  await page.goto('/quotes?search=' + code);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('40.00');
  await page.goto('/inventory/received-orders');
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
  await expect(page.getByRole('table', { name: 'Proveedores', exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: name })).toContainText('Contacto sintético');
  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Editar proveedor' })
    .click();
  await expect(dialog.getByLabel('Correo', { exact: true })).toHaveValue(
    'proveedor-qa@example.test',
  );
  await dialog.getByLabel('Teléfono celular').fill('0000-0000');
  await dialog.getByRole('button', { name: 'Guardar proveedor' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: name })).toContainText('0000-0000');
  await page.getByLabel('Buscar proveedor').fill(name);
  await expect(page.locator('.supplier-table tbody tr')).toHaveCount(1);
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    if (width >= 1280) {
      expect(
        await page
          .locator('.supplier-table-wrap')
          .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await saveScreenshot(page, 'suppliers-table-desktop');
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

test('Extras1 restores empty quote owner and retains it across edits, autosave and reload', async ({
  page,
}) => {
  await login(page, '/quotes?create=1');
  const owner = page.getByLabel('Responsable administrativo');
  await expect(owner).toHaveValue('Usuario ficticio ADMIN');
  const url = '/api/quotes/form-draft?key=quote.create.new';
  await expect
    .poll(async () => (await api(page, url)).body.draft?.manager)
    .toBe('Usuario ficticio ADMIN');
  const previous = (await api(page, url)).body.draft;
  expect((await api(page, url, { ...previous, manager: '' }, 'PUT')).status).toBe(200);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(
    page.getByText('Se recuperó el formulario pendiente.', { exact: false }),
  ).toBeVisible();
  await expect(owner).toHaveValue('Usuario ficticio ADMIN');
  const otherTab = await page.context().newPage();
  await otherTab.goto('/inventory/suppliers');
  await expect(otherTab.getByRole('heading', { name: 'Proveedores', exact: true })).toBeVisible();
  await otherTab.close();
  await page.getByLabel('Buscar paciente', { exact: true }).fill('Paciente sintético');
  await page.getByLabel('Fecha de ingreso', { exact: true }).fill('2026-11-18');
  await page.locator('[data-action-id="QUOTE-PRIORITY"]').selectOption('HIGH');
  await expect(owner).toHaveValue('Usuario ficticio ADMIN');
  await expect.poll(async () => (await api(page, url)).body.draft?.priority).toBe('HIGH');
  await page.reload();
  await expect(owner).toHaveValue('Usuario ficticio ADMIN');
  await expect(owner).toHaveAttribute('readonly', '');
  await expect(owner).toBeDisabled();
  expect(
    (await api(page, url, { ...previous, manager: 'Nombre ajeno recuperado' }, 'PUT')).status,
  ).toBe(200);
  await page.reload();
  await expect(owner).toHaveValue('Usuario ficticio ADMIN');
  await page.getByLabel('Fecha de ingreso', { exact: true }).fill('2026-11-19');
  await expect
    .poll(async () => (await api(page, url)).body.draft?.manager)
    .toBe('Usuario ficticio ADMIN');
  await page.reload();
  await expect(owner).toHaveValue('Usuario ficticio ADMIN');
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
});

test('Nov18 owner stays locked while profile loads and cannot be replaced', async ({ page }) => {
  await login(page, '/quotes');
  expect(
    (await api(page, '/api/quotes/form-draft?key=quote.create.new', {}, 'DELETE')).status,
  ).toBe(200);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/profile', async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: '+ Nuevo' }).click();
  const owner = page.getByLabel('Responsable administrativo');
  await expect(page.locator('#quote-editor-form')).toHaveAttribute('aria-busy', 'false');
  await expect(owner).toHaveAttribute('readonly', '');
  await expect(owner).toBeDisabled();
  const loaded = page.waitForResponse((response) => response.url().endsWith('/api/profile'));
  release();
  await loaded;
  await page.locator('[data-action-id="QUOTE-PRIORITY"]').selectOption('LOW');
  await expect(owner).toHaveValue('Usuario ficticio ADMIN');
  await expect
    .poll(
      async () =>
        (await api(page, '/api/quotes/form-draft?key=quote.create.new')).body.draft?.manager,
    )
    .toBe('Usuario ficticio ADMIN');
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
});

test('Pending18 unpriced supply adds at zero without price input and keeps the same receivable', async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page, '/quotes');
  const quote = await makeQuote(page);
  expect(quote.manager).toBe('Usuario ficticio ADMIN');
  expect(
    (
      await api(page, `/api/quotes/${quote.id}/decision`, {
        id: randomUUID(),
        decision: 'APPROVED',
        reason: null,
      })
    ).status,
  ).toBe(201);
  const request = await api(page, '/api/supply-requests', {
    idempotencyKey: randomUUID(),
    patientId: evidence.patientId,
    catalogItemId: evidence.unpricedItemId,
    quantity: 3,
    priority: 'HIGH',
    note: 'Solicitud sin precio de catálogo QA',
  });
  expect(request.status).toBe(201);
  await page.goto('/clinical/prequotes');
  await page.locator('tbody tr').first().getByRole('button', { name: 'Revisar solicitud' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Asignar a una cotización').selectOption(quote.id);
  await expect(dialog.getByRole('button', { name: 'Actualizar cotizaciones' })).toHaveCount(0);
  const add = dialog.getByRole('button', { name: 'Añadir a cotización', exact: true });
  await expect(add).toHaveCount(1);
  await expect(add).toBeDisabled();
  await dialog
    .getByLabel('Motivo de la ampliación')
    .fill('Insumos adicionales con precio pendiente, autorización sintética');
  await expect(dialog.getByLabel('Precio unitario de esta solicitud (USD)')).toHaveCount(0);
  await expect(dialog.getByText('Precio de venta pendiente.', { exact: false })).toBeVisible();
  await expect(add).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await saveScreenshot(page, 'pending18-zero-price-mobile');
  let writes = 0,
    failedRefresh = false;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/prequotes') && request.method() === 'POST') writes++;
  });
  await page.route('**/api/workspace', async (route) => {
    if (!failedRefresh) {
      failedRefresh = true;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Fallo sintético de sincronización' }),
      });
    } else await route.continue();
  });
  const pending = page.waitForResponse(
    (r) => r.url().endsWith('/api/prequotes') && r.request().method() === 'POST',
  );
  await add.click();
  const response = await pending;
  expect(response.status(), await response.text()).toBe(200);
  const saved = await response.json();
  await expect(page.getByText('Los insumos ya se guardaron.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar vista de saldos', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Actualizar vista de saldos', exact: true }),
  ).toHaveCount(0);
  expect(writes).toBe(1);
  await page.unroute('**/api/workspace');
  expect(
    (await api(page, '/api/prequotes', response.request().postDataJSON())).body.alreadyAssigned,
  ).toBe(true);
  await expect(dialog).toHaveCount(0);
  await page.getByRole('link', { name: 'Ver cotización actualizada' }).click();
  await expect(page).toHaveURL(new RegExp('/quotes/' + saved.quoteId + '$'));
  await expect(page.getByText('Insumo sin precio sintético Nov18', { exact: true })).toBeVisible();
  const after = (await api(page, '/api/quotes')).body.quotes.find(
    (row: { quote: { id: string } }) => row.quote.id === saved.quoteId,
  ).quote;
  expect(after.total).toBe(20);
  expect(after.items.at(-1).quantity).toBe(3);
  expect(after.items.at(-1).unitPrice).toBe(0);
  const code = 'COT-' + quote.id.replaceAll('-', '').slice(-8).toUpperCase();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/receivables');
  const account = page.getByRole('row').filter({ hasText: code });
  await expect(account).toHaveCount(1);
  await expect(account).toContainText('20.00');
  // The team configures the reusable sale price in the actual catalogue table.
  await page.goto(
    '/catalogs?category=SUPPLIES&search=Insumo%20sin%20precio%20sint%C3%A9tico%20Nov18',
  );
  const catalogueRow = page
    .locator('tbody tr')
    .filter({ hasText: 'Insumo sin precio sintético Nov18' });
  await expect(catalogueRow).toHaveCount(1);
  await catalogueRow.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Precio de venta sin IVA').fill('7.25');
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const original = (await api(page, '/api/quotes')).body.quotes.find(
    (row: { quote: { id: string } }) => row.quote.id === saved.quoteId,
  ).quote;
  expect(original.total).toBe(20);
  expect(original.items.at(-1).unitPrice).toBe(0);
  await page.goto('/clinical/prequotes');
  await page.locator('tbody tr').first().getByRole('button', { name: 'Revisar solicitud' }).click();
  await expect(dialog.getByText('Precio aplicado', { exact: false })).toContainText('$0.00');
  await expect(
    dialog.getByRole('button', { name: 'Añadir a cotización', exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  // A fresh request uses the registered price automatically; the earlier one stays unique.
  const nextRequest = await api(page, '/api/supply-requests', {
    idempotencyKey: randomUUID(),
    patientId: evidence.patientId,
    catalogItemId: evidence.unpricedItemId,
    quantity: 2,
    priority: 'LOW',
    note: 'Precio de catálogo ya registrado QA',
  });
  expect(nextRequest.status).toBe(201);
  await page.goto('/clinical/prequotes');
  await page.locator('tbody tr').first().getByRole('button', { name: 'Revisar solicitud' }).click();
  await dialog.getByLabel('Asignar a una cotización').selectOption(saved.quoteId);
  await dialog
    .getByLabel('Motivo de la ampliación')
    .fill('Segunda solicitud sintética con tarifa del catálogo');
  await expect(dialog.getByLabel('Precio unitario de esta solicitud (USD)')).toHaveCount(0);
  const pricedResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/prequotes') && r.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Añadir a cotización', exact: true }).click();
  const priced = await pricedResponse;
  expect(priced.status()).toBe(200);
  const pricedId = (await priced.json()).quoteId;
  const final = (await api(page, '/api/quotes')).body.quotes.find(
    (row: { quote: { id: string } }) => row.quote.id === pricedId,
  ).quote;
  expect(final.total).toBe(34.5);
  expect(
    final.items.filter((line: { id: string }) => line.id === `supply-request-${request.body.id}`),
  ).toHaveLength(1);
  await page.goto('/receivables');
  await expect(page.getByRole('row').filter({ hasText: code })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: code })).toContainText('34.50');
});

test('Nov18 patient search crosses pages and supply requests are under Clinical', async ({
  page,
}) => {
  await login(page, '/inventory/received-orders');
  const search = page.getByLabel('Buscar paciente por nombre o DUI');
  await search.fill('ANGELA BUSQUEDA');
  await expect(page.getByText('Página 1 · 51 líneas', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await search.fill('991234567');
  await expect(page.getByText('Página 1 · 51 líneas', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await search.fill('Sin coincidencias sintéticas');
  await expect(page.getByText('Sin coincidencias', { exact: true })).toBeVisible();
  await search.fill('99123456-7');
  await expect(page.locator('tbody tr')).toHaveCount(50);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await saveScreenshot(page, 'nov18-orders-' + width);
  }
  await page.getByRole('button', { name: 'Limpiar búsqueda', exact: true }).click();
  await expect(search).toHaveValue('');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/supply-requests');
  const clinical = page
    .locator('.nav-group')
    .filter({ has: page.locator('.nav-group-trigger').filter({ hasText: 'Clínico' }) });
  await expect(
    clinical.getByRole('link', { name: 'Solicitudes de insumos', exact: true }),
  ).toBeVisible();
  await expect(clinical.locator('a')).toHaveText([
    'Cotizaciones',
    'Ingresos clínicos',
    'Agenda',
    'Expediente clínico',
    'Órdenes médicas',
    'Precotización',
    'Solicitudes de insumos',
  ]);
  const inventory = page.locator('.nav-group').filter({
    has: page.locator('.nav-group-trigger').filter({ hasText: 'Inventario y compras' }),
  });
  await expect(inventory.locator('a[href="/supply-requests"]')).toHaveCount(0);
});

test('Approved extension keeps approval and the same admission, with reason and closed general editing', async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page, '/quotes');
  const quote = await makeQuote(page, 'HOME_OUTPATIENT');
  const decision = { id: randomUUID(), decision: 'APPROVED', reason: null };
  expect((await api(page, `/api/quotes/${quote.id}/decision`, decision)).status).toBe(201);
  const before = (await api(page, '/api/quotes')).body.quotes.find(
    (row: { quote: { id: string } }) => row.quote.id === quote.id,
  ).quote;
  const admissionBefore = (await api(page, '/api/hospitalizations')).body.hospitalizations.find(
    (row: { hospitalization: { linkedQuoteIds?: string[] } }) =>
      row.hospitalization.linkedQuoteIds?.includes(quote.id),
  );
  expect(admissionBefore).toBeTruthy();
  const request = await api(page, '/api/supply-requests', {
    idempotencyKey: randomUUID(),
    patientId: evidence.patientId,
    catalogItemId: evidence.itemId,
    quantity: 3,
    priority: 'MEDIUM',
    note: 'Solicitud posterior a aprobación QA',
  });
  expect(request.status).toBe(201);
  await page.goto('/clinical/prequotes');
  await page.locator('tbody tr').first().getByRole('button', { name: 'Revisar solicitud' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Asignar a una cotización').selectOption(quote.id);
  await expect(dialog.locator('option:checked')).toContainText('Aprobada');
  const save = dialog.getByRole('button', { name: 'Añadir a cotización', exact: true });
  await expect(save).toBeDisabled();
  await dialog
    .getByLabel('Motivo de la ampliación')
    .fill('Solicitud posterior a aprobación, validada para QA');
  await expect(save).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await saveScreenshot(page, 'approved-extension-mobile');
  const pending = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/prequotes') && response.request().method() === 'POST',
  );
  await save.click();
  const response = await pending;
  expect(response.status(), await response.text()).toBe(200);
  const result = await response.json();
  const submitted = response.request().postDataJSON();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Ampliación registrada' })).toBeVisible();
  expect((await api(page, '/api/prequotes', submitted)).body.alreadyAssigned).toBe(true);
  const after = (await api(page, '/api/quotes')).body.quotes.map(
    (row: { quote: unknown }) => row.quote,
  );
  const original = after.find((q: { id: string }) => q.id === quote.id);
  const extended = after.find((q: { id: string }) => q.id === result.quoteId);
  expect(original).toEqual(before);
  expect(extended.total).toBe(50);
  expect(extended.items.slice(0, -1)).toEqual(before.items);
  expect(extended.caseId).toBe(admissionBefore.hospitalization.id);
  expect(extended.revisionReason).toContain(submitted.approvedExtension.reason);
  expect((await api(page, `/api/quotes/${extended.id}/decision`)).body.decisions).toHaveLength(1);
  expect((await api(page, `/api/quotes/${extended.id}/decision`, decision)).status).toBe(409);
  expect(
    (
      await api(page, `/api/quotes/${extended.id}/revision`, {
        quote: {
          ...extended,
          id: randomUUID(),
          version: extended.version + 1,
          status: 'DRAFT',
          immutable: false,
          revisionReason: 'Intento de editar una aprobada',
        },
      })
    ).status,
  ).toBe(400);
  const admissionAfter = (await api(page, '/api/hospitalizations')).body.hospitalizations.filter(
    (row: { hospitalization: { id: string } }) =>
      row.hospitalization.id === admissionBefore.hospitalization.id,
  );
  expect(admissionAfter).toEqual([admissionBefore]);
  const code = 'COT-' + quote.id.replaceAll('-', '').slice(-8).toUpperCase();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/quotes?search=' + code);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Aprobada');
  await expect(page.locator('tbody tr')).toContainText('50.00');
  await expect(
    page.locator('tbody tr').getByRole('link', { name: 'Editar', exact: true }),
  ).toHaveCount(0);
  await page.goto('/hospitalizations/' + admissionBefore.hospitalization.id);
  await expect(page.locator(`a[href="/quotes/${extended.id}"]`)).toBeVisible();
  const order = (await api(page, '/api/received-orders')).body.entries.find(
    (entry: { quoteId: string; lineId: string }) =>
      entry.quoteId === extended.id && entry.lineId === extended.items.at(-1).id,
  );
  expect(order.quantity).toBe(3);
  expect(order.delivered).toBe(0);
  expect(
    (
      await api(page, '/api/received-orders', {
        idempotencyKey: randomUUID(),
        quoteId: extended.id,
        lineId: order.lineId,
        nursingResourceId: 'qa-resource',
        quantity: 1,
      })
    ).status,
  ).toBe(200);
  await page.goto('/inventory/received-orders');
  await expect(
    page.locator('tbody tr').filter({ hasText: code }).filter({ hasText: 'Entrega parcial' }),
  ).toHaveCount(1);
});
