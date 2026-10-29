import { expect, test, type Locator, type Page } from '@playwright/test';

async function login(page: Page, email = 'admin@demo.local', password = 'demo-admin') {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

async function openNewQuote(page: Page) {
  await page.goto('/quotes');
  await page.getByRole('button', { name: '+ Nuevo' }).click();
  return page.getByRole('dialog', { name: 'Nueva cotización' });
}

async function saveDraft(page: Page, dialog: Locator, summary: string) {
  const patient = dialog.locator('[data-action-id="QUOTE-PATIENT-SELECT"]');
  if (!(await patient.inputValue())) await patient.selectOption({ index: 1 });
  await dialog.getByLabel('Ingreso clínico').selectOption('HOME_OUTPATIENT');
  await dialog.getByLabel('Diagnóstico').fill(summary);
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador de cotización persistido.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/quotes$/);
  return page.evaluate((diagnosis) => {
    const quotes = JSON.parse(
      window.localStorage.getItem('analiza.en.casa.workspace.v3.quotes') ?? '[]',
    );
    return quotes.find(
      (quote: { diagnosisSummary?: string }) => quote.diagnosisSummary === diagnosis,
    )?.id;
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

test('modern quote builder keeps categories and the requested clinical fields', async ({
  page,
}) => {
  await login(page);
  const dialog = await openNewQuote(page);
  await expect(dialog.getByRole('group', { name: 'Datos del paciente' })).toBeVisible();
  await expect(
    dialog.getByRole('group', { name: 'Datos clínicos y administrativos de la cotización' }),
  ).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Datos iniciales de factura' })).toHaveCount(0);
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
  await expect(dialog.getByLabel('Diagnóstico')).toBeVisible();
  await expect(dialog.getByLabel('Médico tratante principal')).toBeVisible();
  await expect(dialog.getByText('Presentación', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Unidades por presentación', { exact: true })).toHaveCount(0);
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

test('exact patient search leaves hospitalization unlinked until the user selects it', async ({
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
  await expect(dialog.getByLabel('Hospitalización vinculada (opcional)')).toHaveValue('');
  await dialog.getByLabel('Hospitalización vinculada (opcional)').selectOption('case-quote-exact');
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
  await dialog.getByLabel('Diagnóstico').fill('Borrador de cotización QA');
  await page.waitForTimeout(450);
  await page.goto('/patients');
  await page.goto('/quotes?create=1');
  dialog = page.getByRole('dialog', { name: 'Nueva cotización' });
  await expect(dialog.getByLabel('Diagnóstico')).toHaveValue('Borrador de cotización QA');
  await dialog.getByRole('button', { name: 'Descartar cambios' }).click();
  await page.goto('/quotes?create=1');
  await expect(
    page.getByRole('dialog', { name: 'Nueva cotización' }).getByLabel('Diagnóstico'),
  ).toHaveValue('');
});

test('medical fee inherits the primary doctor selected at the start of the quote', async ({
  page,
}) => {
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
      attachments: [],
    });
    window.localStorage.setItem(key, JSON.stringify(doctors));
  });
  const dialog = await openNewQuote(page);
  await dialog.getByRole('searchbox', { name: 'Buscar médico por nombre' }).fill('Honorario QA');
  await dialog.getByLabel('Médico tratante principal').selectOption('doctor-fee-qa');
  await dialog.getByRole('tab', { name: 'Honorarios' }).click();
  await dialog.getByLabel('Servicio de honorario').selectOption({ index: 1 });
  await expect(
    dialog.getByRole('searchbox', { name: 'Filtrar médicos de honorarios' }),
  ).toHaveCount(0);
  await dialog.getByLabel('Honorario médico').selectOption('35');
  await expect(dialog.getByLabel('Honorario médico')).toHaveValue('35');
  await dialog.getByLabel('Cantidad').fill('2');
  await dialog.getByRole('button', { name: 'Agregar línea' }).click();
  await expect(dialog.getByRole('region', { name: 'Todos los ítems anexados' })).toContainText(
    'USD 70.00',
  );
});

// test-id: playwright:quote-integer-inputs
test('quote quantities and category percentages reject decimals', async ({ page }) => {
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

  const percentage = dialog.getByLabel('Porcentaje único');
  await expect(percentage).toHaveAttribute('step', '1');
  await expect(percentage).toHaveAttribute('max', '100');
  await percentage.fill('5.5');
  expect(await percentage.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);

  await expect(dialog.getByLabel('Monto de descuento')).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: 'Servicios' }).check();
  await expect(dialog.getByRole('checkbox', { name: 'Servicios' })).toBeChecked();
});

test('draft can be edited and a previously sent version can be revised without changing it', async ({
  page,
}) => {
  await login(page);
  let dialog = await openNewQuote(page);
  const quoteId = await saveDraft(page, dialog, 'Flujo de estados E2E');
  expect(quoteId).toBeTruthy();
  await page.locator(`[data-action-id="QUOTE-DETAIL-NAVIGATE"][href="/quotes/${quoteId}"]`).click();
  await page.getByRole('button', { name: 'Editar borrador' }).click();
  dialog = page.getByRole('dialog', { name: /Editar borrador/ });
  await dialog.getByLabel('Diagnóstico').fill('Flujo de estados E2E editado');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toContainText('actualizado y persistido');
  await page.locator(`[data-action-id="QUOTE-DETAIL-NAVIGATE"][href="/quotes/${quoteId}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/quotes/${quoteId}$`));
  await expect(page.getByRole('button', { name: 'Enviar versión' })).toHaveCount(0);
  await page.evaluate((id) => {
    const key = 'analiza.en.casa.workspace.v3.quotes';
    const quotes = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    const target = quotes.find((candidate: { id: string }) => candidate.id === id);
    target.status = 'SENT';
    target.immutable = true;
    target.sentAt = new Date().toISOString();
    window.localStorage.setItem(key, JSON.stringify(quotes));
  }, quoteId);
  await page.goto(`/quotes/${quoteId}`);
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
