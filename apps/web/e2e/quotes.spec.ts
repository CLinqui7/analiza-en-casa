import { expect, test, type Locator, type Page } from '@playwright/test';

async function login(page: Page, email = 'admin@demo.local', password = 'demo-admin') {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function openNewQuote(page: Page) {
  await page.goto('/quotes');
  await page.getByRole('button', { name: '+ Nuevo' }).click();
  return page.getByRole('dialog', { name: 'Nueva cotización' });
}

async function saveDraft(page: Page, dialog: Locator, summary: string) {
  await dialog.getByLabel('Resumen operativo').fill(summary);
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('status')).toContainText('Borrador de cotización persistido');
  await expect(page).toHaveURL(/\/quotes$/);
  return page.evaluate((expectedSummary) => {
    const quotes = JSON.parse(
      window.localStorage.getItem('analiza.en.casa.workspace.v3.quotes') ?? '[]',
    );
    return quotes.find((quote: { summary: string }) => quote.summary === expectedSummary)?.id;
  }, summary);
}

test('quotes list searches normalized id, patient, case and status, then clears', async ({ page }) => {
  await login(page);
  await page.goto('/quotes');
  const search = page.getByLabel('Buscar cotización');
  for (const query of ['quote demo 001', 'Áurora', 'case demo 001', 'draft']) {
    await search.fill(query);
    await expect(page.getByText('quote-demo-001')).toBeVisible();
  }
  await search.fill('no existe QA');
  await expect(page.getByRole('status')).toContainText('Sin cotizaciones');
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await expect(search).toHaveValue('');
});

test('modern quote builder keeps the requested categories and optional origin', async ({ page }) => {
  await login(page);
  const dialog = await openNewQuote(page);
  await expect(dialog.getByRole('group', { name: 'Datos del paciente' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Datos iniciales de factura' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Constructor por categorías' })).toBeVisible();
  await expect(dialog.getByRole('tab')).toHaveText([
    'Servicios',
    'Laboratorios',
    'Medicamentos',
    'Insumos',
    'Equipos',
    'Honorarios',
    'Fisioterapia',
    'Imágenes',
  ]);
  await expect(dialog.getByLabel('Origen del contacto (opcional)')).toBeVisible();
  await expect(dialog.getByText('Presentación', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Unidades por presentación', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(dialog.getByText('El resumen operativo es obligatorio.')).toBeVisible();
  const id = await saveDraft(page, dialog, 'Cotización moderna sin referido');
  expect(id).toBeTruthy();
});

test('catalog search matches code initials, closes on selection and reuses the configured price', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    const key = 'analiza.en.casa.workspace.v3.catalogItems';
    const items = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    items.push({
      id: 'service-e2e-search',
      sku: 'SV-E2E-001',
      name: 'Servicio verificación E2E',
      category: 'SERVICES',
      status: 'ACTIVE',
      salePriceExcludingTax: 25.5,
      createdAt: new Date().toISOString(),
    });
    window.localStorage.setItem(key, JSON.stringify(items));
  });
  const dialog = await openNewQuote(page);
  const catalog = dialog.getByRole('combobox', {
    name: 'Buscar ítem de catálogo por código o nombre',
  });
  await catalog.fill('SV-E2E');
  const option = dialog.getByRole('option', { name: /SV-E2E-001/ });
  await expect(option).toBeVisible();
  await option.click();
  await expect(option).toHaveCount(0);
  await expect(catalog).toHaveAttribute('placeholder', /SV-E2E-001/);
  await expect(dialog.getByLabel('Precio de venta sin IVA')).toHaveValue('25.5');
  await dialog.getByLabel('Cantidad').fill('2');
  await dialog.getByRole('button', { name: 'Agregar línea' }).click();
  await expect(dialog.getByRole('region', { name: 'Todos los ítems anexados' })).toContainText(
    'Servicio verificación E2E',
  );
  const id = await saveDraft(page, dialog, 'Cotización con catálogo buscable');
  expect(id).toBeTruthy();
});

test('draft can be edited, sent and revised without changing the sent version', async ({ page }) => {
  await login(page);
  let dialog = await openNewQuote(page);
  const quoteId = await saveDraft(page, dialog, 'Flujo de estados E2E');
  expect(quoteId).toBeTruthy();
  await page.locator(`[data-action-id="QUOTE-DETAIL-NAVIGATE"][href="/quotes/${quoteId}"]`).click();
  await page.getByRole('button', { name: 'Editar borrador' }).click();
  dialog = page.getByRole('dialog', { name: /Editar borrador/ });
  await dialog.getByLabel('Resumen operativo').fill('Flujo de estados E2E editado');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toContainText('actualizado y persistido');
  await page.locator(`[data-action-id="QUOTE-DETAIL-NAVIGATE"][href="/quotes/${quoteId}"]`).click();
  await page.getByRole('button', { name: 'Enviar versión' }).click();
  await expect(page.getByRole('status')).toContainText('inmutable');
  await expect(page.getByRole('button', { name: 'Editar borrador' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Revisar / nueva versión' }).click();
  dialog = page.getByRole('dialog', { name: /Revisar/ });
  await dialog.getByRole('button', { name: 'Crear revisión' }).click();
  await expect(dialog.getByText('El motivo de revisión es obligatorio.')).toBeVisible();
  await dialog.getByLabel('Motivo de revisión').fill('Ajuste E2E documentado');
  await dialog.getByRole('button', { name: 'Crear revisión' }).click();
  await expect(page.getByRole('status')).toContainText('Nueva versión');
});

test('auditor remains read-only and mobile layout has no horizontal overflow', async ({ browser }) => {
  const auditorContext = await browser.newContext();
  const auditor = await auditorContext.newPage();
  await login(auditor, 'auditor@demo.local', 'demo-auditor');
  await auditor.goto('/quotes');
  await expect(auditor.getByRole('button', { name: '+ Nuevo' })).toHaveCount(0);
  await auditor.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').first().click();
  await expect(auditor.getByRole('button', { name: 'Editar borrador' })).toHaveCount(0);
  await expect(auditor.getByRole('button', { name: 'Enviar versión' })).toHaveCount(0);
  await auditorContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobile = await mobileContext.newPage();
  await login(mobile);
  await mobile.goto('/quotes');
  expect(
    await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 8),
  ).toBe(true);
  await mobileContext.close();
});
