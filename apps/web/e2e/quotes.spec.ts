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
  if (!(await dialog.getByLabel('Caso compatible').inputValue())) {
    await dialog.getByLabel('Buscar paciente', { exact: true }).fill('Paciente Demo Aurora');
    await expect(dialog.getByLabel('Caso compatible')).not.toHaveValue('');
  }
  await dialog.getByLabel('Resumen operativo').fill(summary);
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador de cotización persistido.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/quotes$/);
  return page.evaluate((expectedSummary) => {
    const quotes = JSON.parse(
      window.localStorage.getItem('analiza.en.casa.workspace.v3.quotes') ?? '[]',
    );
    return quotes.find((quote: { summary: string }) => quote.summary === expectedSummary)?.id;
  }, summary);
}

test('quotes list searches normalized id, patient, case and status, then clears', async ({
  page,
}) => {
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

test('quotes show the saved day and time with the most recently saved first', async ({ page }) => {
  await login(page);
  await page.evaluate(() => {
    const base = {
      caseId: 'case-demo-001',
      patientId: 'patient-demo-001',
      version: 1,
      status: 'DRAFT',
      summary: 'Seguimiento',
      items: [],
      subtotal: 0,
      discountAmount: 0,
      total: 0,
      insurerAmount: 0,
      patientAmount: 0,
      immutable: false,
    };
    window.localStorage.setItem(
      'analiza.en.casa.workspace.v3.quotes',
      JSON.stringify([
        { ...base, id: 'quote-old', createdAt: '2026-09-20T10:00:00.000Z' },
        { ...base, id: 'quote-new', createdAt: '2026-09-28T10:00:00.000Z' },
        {
          ...base,
          id: 'quote-edited',
          createdAt: '2026-09-19T10:00:00.000Z',
          updatedAt: '2026-09-29T19:00:00.000Z',
        },
      ]),
    );
  });
  await page.goto('/quotes');
  await expect(page.getByText('Últimos guardados primero · hora de El Salvador')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Último guardado' })).toBeVisible();
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('quote-edited');
  await expect(rows.nth(1)).toContainText('quote-new');
  await expect(rows.nth(2)).toContainText('quote-old');
  await expect(rows.nth(0).locator('time')).toHaveAttribute('datetime', '2026-09-29T19:00:00.000Z');
  await expect(rows.nth(0).locator('time')).toContainText('2026');
  await rows.nth(0).getByRole('link', { name: 'Consultar' }).click();
  await expect(page.getByText('Último guardado')).toBeVisible();
  await expect(page.locator('time[datetime="2026-09-29T19:00:00.000Z"]')).toBeVisible();
});

test('modern quote builder keeps the requested categories and optional origin', async ({
  page,
}) => {
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
  await expect(dialog.locator('#quote-summary-error')).toHaveText(
    'Escribe el resumen operativo en Atención y caso.',
  );
  await expect(dialog.getByRole('alert').first()).toContainText('Faltan datos para guardar');
  const id = await saveDraft(page, dialog, 'Cotización moderna sin referido');
  expect(id).toBeTruthy();
});

test('missing hospitalization explains the exact blocker and links to the field and case screen', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    window.localStorage.setItem(
      'analiza.en.casa.workspace.v3.patients',
      JSON.stringify([
        {
          id: 'patient-without-case',
          fullName: 'Paciente sin hospitalización',
          documentType: 'OTHER',
          documentId: 'NO-CASE-001',
          status: 'ACTIVE',
        },
      ]),
    );
    window.localStorage.setItem('analiza.en.casa.workspace.v3.hospitalizations', '[]');
  });
  const dialog = await openNewQuote(page);
  await dialog.getByLabel('Buscar paciente', { exact: true }).fill('Paciente sin hospitalización');
  await dialog.getByLabel('Resumen operativo').fill('Seguimiento sin caso');
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  const summary = dialog.locator('.quote-validation-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Este paciente aún no tiene una hospitalización');
  await summary.getByRole('button', { name: /Caso compatible/ }).click();
  await expect(dialog.getByLabel('Caso compatible')).toBeFocused();
  await expect(dialog.getByRole('link', { name: /Crear hospitalización/ })).toHaveAttribute(
    'href',
    '/hospitalizations',
  );
  await expect(page.getByText('Borrador de cotización persistido.', { exact: true })).toHaveCount(
    0,
  );
  await page.evaluate(() => {
    window.localStorage.setItem(
      'analiza.en.casa.workspace.v3.hospitalizations',
      JSON.stringify([
        {
          id: 'case-created-after-quote',
          patientId: 'patient-without-case',
          startDate: '2026-09-29',
          status: 'ACTIVE',
        },
      ]),
    );
  });
  await dialog.getByRole('button', { name: 'Actualizar casos' }).click();
  await expect(dialog.getByLabel('Caso compatible')).toContainText('case-created-after-quote');
  await dialog.getByLabel('Caso compatible').selectOption('case-created-after-quote');
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador de cotización persistido.', { exact: true })).toBeVisible();
});

test('exact patient search selects its compatible hospitalization before saving', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    window.localStorage.setItem(
      'analiza.en.casa.workspace.v3.patients',
      JSON.stringify([
        {
          id: 'patient-quote-first',
          fullName: 'Paciente QA Inicial',
          documentType: 'OTHER',
          documentId: 'QUOTE-FIRST',
          status: 'ACTIVE',
        },
        {
          id: 'patient-quote-exact',
          fullName: 'Paciente QA Exacto',
          documentType: 'OTHER',
          documentId: 'QUOTE-EXACT',
          status: 'ACTIVE',
        },
      ]),
    );
    window.localStorage.setItem(
      'analiza.en.casa.workspace.v3.hospitalizations',
      JSON.stringify([
        {
          id: 'case-quote-first',
          patientId: 'patient-quote-first',
          startDate: '2026-09-24',
          status: 'ACTIVE',
        },
        {
          id: 'case-quote-exact',
          patientId: 'patient-quote-exact',
          startDate: '2026-09-24',
          status: 'ACTIVE',
        },
      ]),
    );
  });
  const dialog = await openNewQuote(page);
  await dialog.getByLabel('Buscar paciente', { exact: true }).fill('Paciente QA Exacto');
  await expect(dialog.locator('[data-action-id="QUOTE-PATIENT-SELECT"]')).toHaveValue(
    'patient-quote-exact',
  );
  await expect(dialog.getByLabel('Caso compatible')).toHaveValue('case-quote-exact');
  const id = await saveDraft(page, dialog, 'Cotización con paciente encontrado');
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

test('draft can be edited, sent and revised without changing the sent version', async ({
  page,
}) => {
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
  await expect(
    dialog.locator('.field-error').filter({ hasText: 'El motivo de revisión es obligatorio.' }),
  ).toBeVisible();
  await dialog.getByLabel('Motivo de revisión').fill('Ajuste E2E documentado');
  await dialog.getByRole('button', { name: 'Crear revisión' }).click();
  await expect(page.getByRole('status')).toContainText('Nueva versión');
});

test('auditor remains read-only and mobile layout has no horizontal overflow', async ({
  browser,
}) => {
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
