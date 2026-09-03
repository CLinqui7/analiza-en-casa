import { expect, test, type Locator } from '@playwright/test';

async function login(
  page: import('@playwright/test').Page,
  email = 'admin@demo.local',
  password = 'demo-admin',
) {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function openNewQuote(page: import('@playwright/test').Page) {
  await page.goto('/quotes');
  await page.getByRole('button', { name: '+ Nuevo' }).click();
  return page.getByRole('dialog', { name: 'Nueva cotización' });
}

async function selectAdministrativeReferral(dialog: Locator, label = 'Redes Sociales') {
  await dialog.getByLabel('Referido por').fill(label.split(' ')[0]);
  await dialog.getByRole('option', { name: label }).click();
}

async function createDoctorFixture(page: import('@playwright/test').Page) {
  await page.goto('/doctors');
  await page.getByRole('button', { name: 'Nuevo médico' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo médico' });
  await dialog.getByLabel('Nombre completo').fill('Médica QA Cotizaciones');
  await dialog.getByLabel('JVPM').fill('JVPM-QA-QUOTE');
  await dialog.getByLabel('DUI').fill('DUI-QA-QUOTE');
  await dialog.getByLabel('Especialidad o profesión').fill('Nutri');
  await dialog.getByRole('option', { name: 'Nutricionista' }).click();
  await dialog.getByLabel('Dirección').fill('Dirección sintética QA');
  await dialog.getByRole('button', { name: 'Guardar médico' }).click();
  await expect(page.getByRole('status')).toContainText('Médica QA Cotizaciones registrado');
}

test('quotes list searches normalized id, patient, case and status, then clears', async ({
  page,
}) => {
  await login(page);
  await page.goto('/quotes');
  const search = page.getByLabel('Buscar cotización');
  await search.fill('quote demo 001');
  await expect(page.getByText('quote-demo-001')).toBeVisible();
  await search.fill('Áurora');
  await expect(page.getByText('quote-demo-001')).toBeVisible();
  await search.fill('case demo 001');
  await expect(page.getByText('quote-demo-001')).toBeVisible();
  await search.fill('draft');
  await expect(page.getByText('quote-demo-001')).toBeVisible();
  await search.fill('no existe QA');
  await expect(page.getByRole('status')).toContainText('Sin cotizaciones');
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await expect(search).toHaveValue('');
});

// test-id: playwright:cr011-quote-categories
test('quote builder persists all categories, calculations, edit, send, revision and related actions', async ({
  page,
}) => {
  await login(page);
  await createDoctorFixture(page);
  let dialog = await openNewQuote(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  dialog = await openNewQuote(page);
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(dialog.getByText('El resumen operativo es obligatorio.')).toBeVisible();
  await dialog.getByLabel('Resumen operativo').fill('Cotización QA integral');
  await selectAdministrativeReferral(dialog);
  await dialog.getByLabel('Comentarios').fill('Comentario QA persistente');
  for (const category of [
    'Servicios',
    'Estudios Dx',
    'Medicamentos',
    'Insumos',
    'Equipos',
    'Honorarios',
    'Extras',
  ]) {
    await dialog.getByRole('tab', { name: category }).click();
    await dialog.getByLabel('Concepto').fill(`Concepto ${category}`);
    if (category === 'Honorarios')
      await dialog.locator('[data-action-id="QUOTE-FEE-DOCTOR-SELECT"]').selectOption({ index: 1 });
    await dialog.getByLabel('Cantidad').fill('1');
    await dialog
      .getByLabel(category === 'Honorarios' ? 'Honorario médico (manual)' : 'Precio manual')
      .fill('10');
    await dialog.getByLabel('Descuento manual').fill('1');
    await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  }
  await dialog.getByRole('tab', { name: 'Servicios' }).click();
  await dialog.getByRole('button', { name: 'Editar' }).click();
  await dialog.getByLabel('Cantidad').fill('2');
  await dialog.getByRole('button', { name: 'Actualizar línea' }).click();
  await dialog.getByLabel('Tipo').selectOption('PERCENT');
  await dialog.getByLabel('Porcentaje de descuento').fill('10');
  await dialog.getByLabel('Responsabilidad explícita de aseguradora').fill('5');
  await expect(dialog.getByLabel('Totales de cotización')).toContainText('USD 65.70');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('status')).toContainText('Borrador de cotización persistido');
  await expect(page).toHaveURL(/\/quotes$/);
  await page.reload();
  await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await expect(page.getByText('Comentario QA persistente')).toBeVisible();
  for (const category of [
    'Servicios',
    'Estudios Dx',
    'Medicamentos',
    'Insumos',
    'Equipos',
    'Honorarios',
    'Extras',
  ]) {
    await expect(page.getByRole('heading', { name: category })).toBeVisible();
    await expect(page.getByText(`Concepto ${category}`)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Editar borrador' }).click();
  dialog = page.getByRole('dialog', { name: /Editar borrador/ });
  await dialog.getByRole('tab', { name: 'Extras' }).click();
  await dialog.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page).toHaveURL(/\/quotes$/);
  await page.reload();
  await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await expect(page.getByText('Concepto Extras')).toHaveCount(0);
  await expect(page.getByText('Concepto Honorarios')).toBeVisible();
  await page.getByRole('button', { name: 'Editar borrador' }).click();
  dialog = page.getByRole('dialog', { name: /Editar borrador/ });
  await dialog.getByLabel('Resumen operativo').fill('Cotización QA editada');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toContainText('actualizado y persistido');
  await expect(page).toHaveURL(/\/quotes$/);
  await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await page.getByRole('button', { name: 'Enviar versión' }).click();
  await expect(page.getByRole('status')).toContainText('inmutable');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Editar borrador' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar versión' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Revisar / nueva versión' }).click();
  dialog = page.getByRole('dialog', { name: /Revisar/ });
  await page.getByRole('button', { name: 'Crear revisión' }).click();
  await expect(dialog.getByText('El motivo de revisión es obligatorio.')).toBeVisible();
  await dialog.getByLabel('Motivo de revisión').fill('Ajuste QA documentado');
  await page.getByRole('button', { name: 'Crear revisión' }).click();
  await expect(page.getByRole('status')).toContainText('Nueva versión');
  await expect(page).toHaveURL(/\/quotes$/);
  await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await expect(page.getByRole('cell', { name: 'Ajuste QA documentado' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'v1' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'v2' })).toBeVisible();
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printCalled = 'true';
    };
  });
  await page.getByRole('button', { name: 'Imprimir' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-called', 'true');
  await page.getByRole('button', { name: 'Abrir seguro' }).click();
  await expect(page).toHaveURL(/\/insurance\?quote=/);
  await page.goBack();
  await page.getByRole('button', { name: 'Abrir pagos' }).click();
  await expect(page).toHaveURL(/\/payments\?quote=/);
  await page.goBack();
  await page.getByRole('button', { name: 'Enviar WhatsApp' }).click();
  await expect(page.getByRole('status')).toContainText('Proveedor de mensajería no configurado');
  await page.getByRole('button', { name: 'Copiar enlace portal' }).click();
  await expect(page.getByRole('status')).toContainText('Portal seguro no configurado');
});

// test-id: playwright:quotes-metadata-filters-pagination
test('quote metadata persists through reload and list filters and pagination have observable effects', async ({
  page,
}) => {
  await login(page);
  let dialog = await openNewQuote(page);
  const today = new Date().toISOString().slice(0, 10);
  await dialog.getByLabel('Buscar paciente').fill('Aurora');
  await expect(dialog.locator('#quote-patient-options option')).toHaveCount(1);
  await dialog.locator('[data-action-id="QUOTE-PATIENT-SELECT"]').selectOption('patient-demo-001');
  await dialog.getByLabel('Resumen operativo').fill('Metadatos B4 persistidos');
  await dialog.locator('[data-action-id="QUOTE-INVOICE-DATE"]').fill(today);
  await dialog.locator('[data-action-id="QUOTE-DISCOUNT-GROUP"]').selectOption('Regular');
  await selectAdministrativeReferral(dialog);
  await dialog.locator('[data-action-id="QUOTE-GIFTCARD"]').fill('GIFT-B4');
  await dialog.locator('[data-action-id="QUOTE-COMMENTS"]').fill('Comentarios B4 persistidos');
  await dialog.getByLabel('Concepto').fill('Servicio metadatos B4');
  await dialog.getByLabel('Cantidad').fill('1');
  await dialog.getByLabel('Precio manual').fill('10');
  await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page).toHaveURL(/\/quotes$/);
  const quoteId = await page.evaluate(() => {
    const quotes = JSON.parse(
      window.localStorage.getItem('analiza.en.casa.workspace.v3.quotes') ?? '[]',
    );
    return quotes.find((quote: { summary: string }) => quote.summary === 'Metadatos B4 persistidos')
      ?.id;
  });
  expect(quoteId).toBeTruthy();
  await page.reload();
  await page.locator(`[data-action-id="QUOTE-DETAIL-NAVIGATE"][href="/quotes/${quoteId}"]`).click();
  await page.getByRole('button', { name: 'Editar borrador' }).click();
  dialog = page.getByRole('dialog', { name: /Editar borrador/ });
  await expect(dialog.locator('[data-action-id="QUOTE-PATIENT-SELECT"]')).toHaveValue(
    'patient-demo-001',
  );
  await expect(dialog.locator('[data-action-id="QUOTE-INVOICE-DATE"]')).toHaveValue(today);
  await expect(dialog.locator('[data-action-id="QUOTE-DISCOUNT-GROUP"]')).toHaveValue('Regular');
  await expect(dialog.getByLabel('Referidos seleccionados')).toContainText('Redes Sociales');
  await expect(dialog.locator('[data-action-id="QUOTE-GIFTCARD"]')).toHaveValue('GIFT-B4');
  await expect(dialog.locator('[data-action-id="QUOTE-COMMENTS"]')).toHaveValue(
    'Comentarios B4 persistidos',
  );
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/quotes$/);
  dialog = await openNewQuote(page);
  await dialog.getByLabel('Resumen operativo').fill('Filtro enviada B4');
  await dialog.getByLabel('Concepto').fill('Servicio enviada B4');
  await dialog.getByLabel('Cantidad').fill('1');
  await dialog.getByLabel('Precio manual').fill('10');
  await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  await selectAdministrativeReferral(dialog);
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  const sentQuoteId = await page.evaluate(() => {
    const quotes = JSON.parse(
      window.localStorage.getItem('analiza.en.casa.workspace.v3.quotes') ?? '[]',
    );
    return quotes.find((quote: { summary: string }) => quote.summary === 'Filtro enviada B4')?.id;
  });
  expect(sentQuoteId).toBeTruthy();
  await page
    .locator(`[data-action-id="QUOTE-DETAIL-NAVIGATE"][href="/quotes/${sentQuoteId}"]`)
    .click();
  await page.getByRole('button', { name: 'Enviar versión' }).click();
  await expect(page.getByRole('status')).toContainText('inmutable');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enviar versión' })).toHaveCount(0);
  for (let index = 0; index < 10; index += 1) {
    dialog = await openNewQuote(page);
    await dialog.getByLabel('Resumen operativo').fill(`Paginación B4 ${index}`);
    await selectAdministrativeReferral(dialog);
    await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page).toHaveURL(/\/quotes$/);
  }
  await page.goto('/quotes');
  await page.locator('[data-action-id="QUOTE-FILTER-STATUS"]').selectOption('SENT');
  await page.locator('[data-action-id="QUOTE-FILTER-APPLY"]').click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody').getByText('Enviada', { exact: true })).toBeVisible();
  await expect(page.locator('tbody').getByText('Borrador', { exact: true })).toHaveCount(0);
  await page.locator('[data-action-id="QUOTE-FILTER-STATUS"]').selectOption('DRAFT');
  await page.locator('[data-action-id="QUOTE-FILTER-APPLY"]').click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await expect(page.locator('tbody').getByText('Borrador', { exact: true }).first()).toBeVisible();
  await expect(page.locator('tbody').getByText('Enviada', { exact: true })).toHaveCount(0);
  await page.locator('[data-action-id="QUOTE-FILTER-CREATED-DATE"]').fill('2099-12-31');
  await page.locator('[data-action-id="QUOTE-FILTER-APPLY"]').click();
  await expect(page.getByText('Sin cotizaciones', { exact: true })).toBeVisible();
  await page.locator('[data-action-id="QUOTE-FILTER-CLEAR"]').click();
  await expect(page.locator('[data-action-id="QUOTE-FILTER-STATUS"]')).toHaveValue('');
  await expect(page.locator('[data-action-id="QUOTE-FILTER-CREATED-DATE"]')).toHaveValue('');
  await expect(page.locator('tbody').getByText('Enviada', { exact: true })).toBeVisible();
  await expect(page.locator('tbody').getByText('Borrador', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-action-id="QUOTE-PAGE-NEXT"]')).toBeEnabled();
  await page.locator('[data-action-id="QUOTE-PAGE-NEXT"]').click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  await page.locator('[data-action-id="QUOTE-PAGE-PREV"]').click();
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
});

test('quote permissions keep auditor read-only and mobile has no horizontal overflow', async ({
  browser,
}) => {
  const auditorContext = await browser.newContext();
  const auditor = await auditorContext.newPage();
  await login(auditor, 'auditor@demo.local', 'demo-auditor');
  await auditor.goto('/quotes');
  await expect(auditor.getByRole('button', { name: 'Nueva cotización' })).toHaveCount(0);
  await auditor.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').first().click();
  await expect(auditor.getByRole('button', { name: 'Editar borrador' })).toHaveCount(0);
  await expect(auditor.getByRole('button', { name: 'Enviar versión' })).toHaveCount(0);
  await auditorContext.close();
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobile = await mobileContext.newPage();
  await login(mobile);
  await mobile.goto('/quotes');
  expect(
    await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await mobileContext.close();
});

// test-id: playwright:ch04-quote-general-sections
test('CH04 quote general sections select patient, referral tags, and the bounded service catalog', async ({
  page,
}) => {
  await login(page);
  const dialog = await openNewQuote(page);
  await expect(dialog.getByRole('group', { name: 'Datos del paciente' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Datos iniciales de factura' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Constructor por categorías' })).toBeVisible();
  await dialog.getByLabel('Buscar paciente').fill('Aurora');
  await dialog.locator('[data-action-id="QUOTE-PATIENT-SELECT"]').selectOption('patient-demo-001');
  await expect(dialog.getByLabel('Documento')).not.toHaveValue('No disponible');
  await expect(dialog.getByLabel('Teléfono')).not.toHaveValue('No disponible');
  await expect(dialog.getByLabel('Correo')).not.toHaveValue('No disponible');
  await dialog.locator('[data-action-id="QUOTE-INVOICE-DATE"]').fill('2026-09-02');
  await expect(dialog.locator('[data-action-id="QUOTE-DISCOUNT-GROUP"]')).toHaveValue('Regular');
  const requiredReferralSummary = 'CH04 referido obligatorio';
  await dialog.getByLabel('Resumen operativo').fill(requiredReferralSummary);
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Seleccione al menos un referido.');
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate(
      (summary) =>
        JSON.parse(window.localStorage.getItem('analiza.en.casa.workspace.v3.quotes') ?? '[]').some(
          (quote: { summary: string }) => quote.summary === summary,
        ),
      requiredReferralSummary,
    ),
  ).toBe(false);
  const referralToggle = dialog.getByRole('button', { name: 'Mostrar opciones de referido' });
  await expect(referralToggle).toHaveAttribute('aria-expanded', 'false');
  await referralToggle.click();
  await expect(referralToggle).toHaveAttribute('aria-expanded', 'true');
  const referralCatalog = dialog.getByLabel('Catálogo de referidos');
  await expect(referralCatalog).toBeVisible();
  expect(
    await referralCatalog.evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      scrollable: element.scrollHeight > element.clientHeight,
    })),
  ).toEqual({ overflowY: 'auto', scrollable: true });
  expect(
    await referralToggle.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe('rgb(23, 131, 79)');
  const referral = dialog.getByLabel('Referido por');
  await referral.fill('Redes');
  await dialog.getByRole('option', { name: 'Redes Sociales' }).click();
  await referral.fill('Amigos');
  await dialog.getByRole('option', { name: 'Amigos & Familia' }).click();
  await expect(dialog.getByLabel('Referidos seleccionados')).toContainText('Redes Sociales');
  await expect(dialog.getByLabel('Referidos seleccionados')).toContainText('Amigos & Familia');
  await dialog.getByRole('button', { name: 'Quitar Amigos & Familia' }).click();
  await expect(dialog.getByLabel('Referidos seleccionados')).not.toContainText('Amigos & Familia');
  await dialog.locator('[data-action-id="QUOTE-INVENTORY-ONLY"]').check();
  await expect(dialog.locator('[data-action-id="QUOTE-SERVICE-CATALOG"] option')).toHaveCount(2);
  await dialog
    .locator('[data-action-id="QUOTE-BUSINESS-PARTNER"]')
    .selectOption('Socio sintético A');
  await dialog
    .locator('[data-action-id="QUOTE-SERVICE-CATALOG"]')
    .selectOption('Servicio sintético disponible');
  await dialog.getByLabel('Cantidad').fill('1');
  await dialog.getByLabel('Precio manual').fill('10');
  await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  await expect(dialog.getByText('Socio: Socio sintético A')).toBeVisible();
  await dialog.getByLabel('Resumen operativo').fill('CH04 secciones persistidas');
  await dialog.getByLabel('Comentarios').fill('Comentario administrativo sintético');
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page).toHaveURL(/\/quotes$/);
  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('analiza.en.casa.workspace.v3.quotes') ?? '[]').find(
      (quote: { summary: string }) => quote.summary === 'CH04 secciones persistidas',
    ),
  );
  expect(saved.referralSelections).toEqual(['Redes Sociales']);
  expect(saved.items[0].businessPartnerLabel).toBe('Socio sintético A');
  await page.reload();
  await page
    .locator(`[data-action-id="QUOTE-DETAIL-NAVIGATE"][href="/quotes/${saved.id}"]`)
    .click();
  await page.getByRole('button', { name: 'Editar borrador' }).click();
  await expect(
    page.getByRole('dialog', { name: /Editar borrador/ }).getByLabel('Referidos seleccionados'),
  ).toContainText('Redes Sociales');
});

// test-id: playwright:ch05-quote-services-medications
test('CH05 service and medication catalogs search, recover, reset, process, and persist only manual amounts', async ({
  page,
}) => {
  await login(page);
  const dialog = await openNewQuote(page);
  await dialog.getByLabel('Resumen operativo').fill('CH05 catálogos sintéticos persistidos');
  await selectAdministrativeReferral(dialog);
  await expect(dialog.getByRole('tab')).toHaveText([
    'Servicios',
    'Estudios Dx',
    'Medicamentos',
    'Insumos',
    'Equipos',
    'Honorarios',
    'Extras',
  ]);

  const serviceSearch = dialog.getByLabel('Buscar servicios');
  await serviceSearch.fill('disponible');
  await expect(
    dialog
      .getByLabel('Resultados de servicios')
      .getByRole('option', { name: 'Servicio sintético disponible' }),
  ).toBeVisible();
  await dialog
    .getByLabel('Resultados de servicios')
    .getByRole('option', { name: 'Servicio sintético disponible' })
    .click();
  await expect(
    dialog
      .getByLabel('Resultados de servicios')
      .getByRole('option', { name: 'Servicio sintético disponible' }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByLabel('Concepto')).toHaveValue('Servicio sintético disponible');
  await dialog
    .locator('[data-action-id="QUOTE-BUSINESS-PARTNER"]')
    .selectOption('Socio sintético A');
  await expect(dialog.getByLabel('Cantidad')).toHaveValue('0');
  await expect(dialog.getByLabel('Cantidad')).toHaveAttribute('aria-required', 'true');
  await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  await expect(dialog.getByRole('alert')).toHaveText('La cantidad debe ser mayor que cero.');
  await expect(
    dialog.locator('tbody tr').filter({ hasText: 'Servicio sintético disponible' }),
  ).toHaveCount(0);
  await dialog.getByLabel('Cantidad').fill('2');
  await dialog.getByLabel('Precio manual').fill('12');
  await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  await expect(dialog.locator('.quote-processing')).toHaveText('Procesando...');
  await expect(
    dialog.locator('tbody tr').filter({ hasText: 'Servicio sintético disponible' }),
  ).toBeVisible();

  await dialog.getByRole('tab', { name: 'Medicamentos' }).click();
  await expect(dialog.getByLabel('Concepto')).toHaveValue('');
  await expect(dialog.getByLabel('Buscar medicamentos')).toHaveValue('');
  await expect(dialog.locator('[data-action-id="QUOTE-MEDICATION-BUSINESS-PARTNER"]')).toHaveValue(
    '',
  );
  await dialog.locator('[data-action-id="QUOTE-MEDICATION-INVENTORY-ONLY"]').check();
  await expect(dialog.locator('[data-action-id="QUOTE-MEDICATION-INVENTORY-ONLY"]')).toBeChecked();
  const medicationSearch = dialog.getByLabel('Buscar medicamentos');
  await medicationSearch.fill('sin coincidencia');
  await expect(dialog.getByRole('status')).toHaveText('No results found');
  await medicationSearch.fill('disponible');
  await expect(
    dialog
      .getByLabel('Resultados de medicamentos')
      .getByRole('option', { name: 'Medicamento sintético disponible' }),
  ).toBeVisible();
  await dialog
    .getByLabel('Resultados de medicamentos')
    .getByRole('option', { name: 'Medicamento sintético disponible' })
    .click();
  await expect(
    dialog
      .getByLabel('Resultados de medicamentos')
      .getByRole('option', { name: 'Medicamento sintético disponible' }),
  ).toHaveAttribute('aria-selected', 'true');
  await dialog
    .locator('[data-action-id="QUOTE-MEDICATION-BUSINESS-PARTNER"]')
    .selectOption('Socio sintético B');
  await dialog.getByLabel('Cantidad').fill('1');
  await dialog.getByLabel('Precio manual').fill('9');
  await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  await expect(dialog.locator('.quote-processing')).toHaveText('Procesando...');
  await expect(
    dialog.locator('tbody tr').filter({ hasText: 'Medicamento sintético disponible' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page).toHaveURL(/\/quotes$/);
  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('analiza.en.casa.workspace.v3.quotes') ?? '[]').find(
      (quote: { summary: string }) => quote.summary === 'CH05 catálogos sintéticos persistidos',
    ),
  );
  expect(
    saved.items.map((item: { name: string; unitPrice: number }) => [item.name, item.unitPrice]),
  ).toEqual([
    ['Servicio sintético disponible', 12],
    ['Medicamento sintético disponible', 9],
  ]);
  await page.reload();
  await page
    .locator(`[data-action-id="QUOTE-DETAIL-NAVIGATE"][href="/quotes/${saved.id}"]`)
    .click();
  await expect(page.getByText('Servicio sintético disponible', { exact: true })).toBeVisible();
  await expect(page.getByText('Medicamento sintético disponible', { exact: true })).toBeVisible();
});

// test-id: playwright:ch06-synthetic-catalogs
test('CH06 supply, study, and fee catalogs preserve selected synthetic concepts with manual amounts', async ({
  page,
}) => {
  await login(page);
  await createDoctorFixture(page);
  const dialog = await openNewQuote(page);
  await dialog.getByLabel('Resumen operativo').fill('CH06 catálogos sintéticos persistidos');
  await selectAdministrativeReferral(dialog);

  await dialog.getByRole('tab', { name: 'Insumos' }).click();
  await dialog
    .locator('[data-action-id="QUOTE-SUPPLY-BUSINESS-PARTNER"]')
    .selectOption('Socio sintético A');
  await dialog.locator('[data-action-id="QUOTE-SUPPLY-INVENTORY-ONLY"]').check();
  await expect(dialog.getByRole('option', { name: /sin disponibilidad configurada/ })).toHaveCount(
    0,
  );
  const supplySearch = dialog.getByLabel('Buscar insumos');
  await supplySearch.fill('sin coincidencia');
  await expect(dialog.getByRole('status')).toHaveText('No results found');
  await supplySearch.fill('INS-SYN-001');
  await dialog
    .getByLabel('Resultados de insumos')
    .getByRole('option', { name: /Insumo sintético disponible/ })
    .click();
  await expect(dialog.getByLabel('Concepto')).toHaveValue(/INS-SYN-001/);
  await dialog.getByLabel('Cantidad').fill('2');
  await dialog.getByLabel('Precio manual').fill('12');
  await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  await expect(dialog.locator('tbody tr').filter({ hasText: 'INS-SYN-001' })).toBeVisible();

  await dialog.getByRole('tab', { name: 'Estudios Dx' }).click();
  await dialog
    .locator('[data-action-id="QUOTE-STUDY-BUSINESS-PARTNER"]')
    .selectOption('Socio sintético B');
  await dialog.locator('[data-action-id="QUOTE-STUDY-INVENTORY-ONLY"]').check();
  const studySearch = dialog.getByLabel('Buscar estudios');
  await studySearch.fill('hemoglobina');
  await dialog
    .getByLabel('Resultados de estudios')
    .getByRole('option', { name: 'Estudio sintético de hemoglobina disponible' })
    .click();
  await dialog.getByLabel('Cantidad').fill('1');
  await dialog.getByLabel('Precio manual').fill('9');
  await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  await expect(
    dialog.locator('tbody tr').filter({ hasText: 'Estudio sintético de hemoglobina disponible' }),
  ).toBeVisible();

  await dialog.getByRole('tab', { name: 'Honorarios' }).click();
  await dialog
    .locator('[data-action-id="QUOTE-FEE-BUSINESS-PARTNER"]')
    .selectOption('Socio sintético A');
  await dialog
    .locator('[data-action-id="QUOTE-FEE-SERVICE-CATALOG"]')
    .selectOption('Seguimiento sintético disponible');
  await dialog.locator('[data-action-id="QUOTE-FEE-DOCTOR-SELECT"]').selectOption({ index: 1 });
  await dialog.getByLabel('Cantidad').fill('1');
  await dialog.getByLabel('Honorario médico (manual)').fill('15');
  await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  await expect(
    dialog.locator('tbody tr').filter({ hasText: 'Seguimiento sintético disponible' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page).toHaveURL(/\/quotes$/);

  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('analiza.en.casa.workspace.v3.quotes') ?? '[]').find(
      (quote: { summary: string }) => quote.summary === 'CH06 catálogos sintéticos persistidos',
    ),
  );
  expect(
    saved.items.map((item: { name: string; unitPrice: number }) => [item.name, item.unitPrice]),
  ).toEqual([
    ['INS-SYN-001 | Insumo sintético disponible — Fabricante sintético (1)', 12],
    ['Estudio sintético de hemoglobina disponible', 9],
    ['Seguimiento sintético disponible', 15],
  ]);
  await page.reload();
  await page
    .locator(`[data-action-id="QUOTE-DETAIL-NAVIGATE"][href="/quotes/${saved.id}"]`)
    .click();
  await expect(
    page.getByText('INS-SYN-001 | Insumo sintético disponible — Fabricante sintético (1)'),
  ).toBeVisible();
  await expect(page.getByText('Estudio sintético de hemoglobina disponible')).toBeVisible();
  await expect(page.getByText('Seguimiento sintético disponible')).toBeVisible();
});
