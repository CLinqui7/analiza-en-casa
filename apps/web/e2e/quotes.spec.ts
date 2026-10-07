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
  const patient = dialog.locator('[data-action-id="QUOTE-PATIENT-SELECT"]');
  if (!(await patient.inputValue())) await patient.selectOption({ index: 1 });
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
    await expect(page.getByTitle('quote-demo-001')).toBeVisible();
  }
  await search.fill('no existe QA');
  await expect(page.getByRole('status')).toContainText('Sin cotizaciones');
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await expect(search).toHaveValue('');
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
  await expect(dialog.getByText('El resumen operativo es obligatorio.')).toBeVisible();
  const id = await saveDraft(page, dialog, 'Cotización moderna sin referido');
  expect(id).toBeTruthy();
});

test('new patient quote saves without creating or requiring a hospitalization', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    const key = 'analiza.en.casa.workspace.v3.patients';
    const patients = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    patients.push({
      id: 'patient-new-care-e2e',
      fullName: 'Paciente Nuevo Sin Hospitalización',
      documentType: 'OTHER',
      documentId: 'NEW-CARE-E2E',
      status: 'ACTIVE',
    });
    window.localStorage.setItem(key, JSON.stringify(patients));
  });
  const dialog = await openNewQuote(page);
  await dialog
    .getByLabel('Buscar paciente', { exact: true })
    .fill('Paciente Nuevo Sin Hospitalización');
  await expect(dialog.locator('[data-action-id="QUOTE-PATIENT-SELECT"]')).toHaveValue(
    'patient-new-care-e2e',
  );
  await expect(dialog.getByLabel('Hospitalización vinculada (opcional)')).toHaveValue('');
  const id = await saveDraft(page, dialog, 'Atención nueva sin hospitalización E2E');
  expect(id).toBeTruthy();
  await expect(page.getByText('Atención nueva sin hospitalización')).toBeVisible();
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
  await expect(dialog.getByLabel('Hospitalización vinculada (opcional)')).toHaveValue(
    'case-quote-exact',
  );
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
  await expect(dialog.getByLabel('Precio de venta sin IVA')).toHaveValue('USD 25.50');
  await expect(dialog.getByLabel('Precio de venta sin IVA')).toHaveAttribute('readonly');
  await dialog.getByLabel('Cantidad').fill('2');
  await dialog.getByRole('button', { name: 'Agregar línea' }).click();
  await expect(dialog.getByRole('region', { name: 'Todos los ítems anexados' })).toContainText(
    'Servicio verificación E2E',
  );
  const id = await saveDraft(page, dialog, 'Cotización con catálogo buscable');
  expect(id).toBeTruthy();
});

test('unsaved quote draft survives navigation but is removed after explicit discard', async ({
  page,
}) => {
  await login(page);
  let dialog = await openNewQuote(page);
  await dialog.getByLabel('Resumen operativo').fill('Borrador de cotización QA');
  await page.waitForTimeout(450);
  await page.goto('/patients');
  await page.goto('/quotes?create=1');
  dialog = page.getByRole('dialog', { name: 'Nueva cotización' });
  await expect(dialog.getByLabel('Resumen operativo')).toHaveValue('Borrador de cotización QA');
  await dialog.getByRole('button', { name: 'Descartar cambios' }).click();
  await page.goto('/quotes?create=1');
  await expect(
    page.getByRole('dialog', { name: 'Nueva cotización' }).getByLabel('Resumen operativo'),
  ).toHaveValue('');
});

test('medical fee uses the doctor record and filters doctors by name', async ({ page }) => {
  await login(page);
  await page.evaluate(() => {
    const key = 'analiza.en.casa.workspace.v3.doctors';
    const doctors = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    doctors.push({
      id: 'doctor-fee-qa',
      fullName: 'Médica Honorario QA',
      documentId: 'DOCTOR-QA',
      specialty: 'Medicina general',
      address: 'Dirección QA',
      medicalFee: 35,
      attachments: [],
    });
    window.localStorage.setItem(key, JSON.stringify(doctors));
  });
  const dialog = await openNewQuote(page);
  await dialog.getByRole('tab', { name: 'Honorarios' }).click();
  await dialog.getByLabel('Servicio de honorario').selectOption({ index: 1 });
  await dialog
    .getByRole('searchbox', { name: 'Filtrar médicos de honorarios' })
    .fill('Honorario QA');
  await dialog.locator('[data-action-id="QUOTE-FEE-DOCTOR-SELECT"]').selectOption('doctor-fee-qa');
  await expect(dialog.getByLabel('Honorario médico')).toHaveValue('USD 35.00');
  await expect(dialog.getByLabel('Honorario médico')).toHaveAttribute('readonly');
  await dialog.getByLabel('Cantidad').fill('2');
  await dialog.getByRole('button', { name: 'Agregar línea' }).click();
  await expect(dialog.getByRole('region', { name: 'Todos los ítems anexados' })).toContainText(
    'USD 70.00',
  );
});

// test-id: playwright:quote-integer-inputs
test('quote quantities and percentages reject decimals while fixed money keeps cents', async ({
  page,
}) => {
  await login(page);
  const dialog = await openNewQuote(page);
  await dialog.getByRole('tab', { name: 'Honorarios' }).click();
  await dialog.getByLabel('Servicio de honorario').selectOption({ index: 1 });
  const quantity = dialog.getByLabel('Cantidad');
  await expect(quantity).toHaveAttribute('min', '1');
  await expect(quantity).toHaveAttribute('step', '1');
  await quantity.fill('3.01');
  await dialog.getByRole('button', { name: 'Agregar línea' }).click();
  await expect(dialog.getByText('La cantidad debe ser un número entero.')).toBeVisible();

  const percentage = dialog.getByLabel('Porcentaje de descuento');
  await expect(percentage).toHaveAttribute('step', '1');
  await expect(percentage).toHaveAttribute('max', '100');
  await percentage.fill('5.5');
  expect(await percentage.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);

  await dialog.locator('select[data-action-id="QUOTE-DISCOUNT-UPDATE"]').selectOption('FIXED');
  const fixedAmount = dialog.getByLabel('Monto de descuento');
  await expect(fixedAmount).toHaveAttribute('step', '0.01');
  await fixedAmount.fill('1.25');
  expect(await fixedAmount.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(true);
});

test('draft can be edited, sent and revised without changing the sent version', async ({
  page,
}) => {
  await login(page);
  let dialog = await openNewQuote(page);
  await dialog.getByLabel('Condición de pago (opcional)').fill('Pago acordado al recibir');
  const quoteId = await saveDraft(page, dialog, 'Flujo de estados E2E');
  expect(quoteId).toBeTruthy();
  await page.locator(`[data-action-id="QUOTE-DETAIL-NAVIGATE"][href="/quotes/${quoteId}"]`).click();
  await expect(page.getByText('Pago acordado al recibir')).toBeVisible();
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
