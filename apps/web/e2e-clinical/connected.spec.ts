import { test, expect, type Page } from '@playwright/test';
const patientId = process.env.CLINICAL_QA_PATIENT_ID!;
const caseId = process.env.CLINICAL_QA_CASE_ID!;
const secret = process.env.ANALIZA_QA_PASSWORD!;
if (!patientId?.startsWith('clinical-qa-p-') || !caseId?.startsWith('clinical-qa-c-') || !secret)
  throw new Error('Run the synthetic PostgreSQL verification first.');
async function browserApi(
  page: Page,
  url: string,
  data?: unknown,
  headers?: Record<string, string>,
) {
  // Production cookies are Secure. Keep localhost HTTP verification in Chrome,
  // which supports the localhost secure-context exception, instead of Node's cookie jar.
  return page.evaluate(
    async ({ url, data, headers }) => {
      const response = await fetch(url, {
        method: data === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
      return { status: response.status, body: await response.json() };
    },
    { url, data, headers },
  );
}
async function getJson(page: Page, url: string) {
  const response = await browserApi(page, url);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body;
}
async function login(page: Page, path: string, role = 'nurse') {
  await page.goto('/login?next=' + encodeURIComponent(path));
  await page.getByLabel('Usuario o correo').fill(`qa-${role}@example.test`);
  await page.getByLabel('Clave').fill(secret);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(path.replaceAll('/', '\\/') + '$'), { timeout: 30000 });
  await expect(page.locator('main h1')).toBeVisible();
}
async function editor(page: Page, label: string, nursing = false) {
  await page.goto('/clinical/orders');
  if (nursing)
    await page.getByRole('button', { name: 'Acciones de enfermería', exact: true }).click();
  await page
    .locator('.clinical-action-grid')
    .getByRole('button', { name: label, exact: true })
    .click();
  await page
    .getByRole('searchbox', { name: 'Buscar por nombre o DUI' })
    .fill(patientId.split('-').at(-1)!);
  await page
    .locator('.clinical-patient-list')
    .getByRole('button', { name: label, exact: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Hospitalización', exact: true }).selectOption(caseId);
  return dialog;
}
async function persist(page: Page) {
  const dialog = page.getByRole('dialog');
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith('/api/operations') && r.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(200);
  await expect(dialog).toHaveCount(0);
  return response.json();
}
// test-id: playwright:clinical-connected-persistence
test('medical and nursing forms persist through HTTP, reload and record printing', async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, '/clinical/orders');
  const run = Date.now().toString();
  for (const label of [
    'Indicación médica',
    'Evolución clínica',
    'Historia clínica',
    'Antecedentes clínicos',
  ]) {
    const dialog = await editor(page, label);
    await dialog.getByLabel('Resumen', { exact: true }).fill(`Texto sintético ${run} ${label}`);
    const saved = await persist(page);
    expect(saved.patientId).toBe(patientId);
    expect(saved.caseId).toBe(caseId);
    await page.reload();
    const snapshot = await getJson(page, '/api/operations');
    expect(snapshot.clinicalRecords.some((r: { id: string }) => r.id === saved.id)).toBe(true);
  }
  for (const plan of ['DIET', 'NURSING', 'LABORATORY']) {
    const dialog = await editor(page, 'Plan de cuidado', true);
    if (plan !== 'LABORATORY')
      await dialog
        .getByRole('checkbox', {
          name: plan === 'DIET' ? 'Dieta' : 'Cuidado de enfermería',
          exact: true,
        })
        .check();
    await expect(dialog.getByRole('checkbox', { name: /Laboratorio/ })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: /Laboratorio/ })).toBeDisabled();
    if (plan !== 'LABORATORY') await dialog.getByLabel('Descripción').fill('Plan sintético ' + run);
    const saved = await persist(page);
    if (plan === 'LABORATORY') expect(saved.laboratories).toContain('Laboratorio sintético QA');
  }
  const balance = await editor(page, 'Balance hídrico', true);
  await balance.getByLabel('Enteral · ml', { exact: true }).first().fill('100');
  await balance.getByLabel('Orina · ml', { exact: true }).first().fill('30');
  await expect(balance.locator('output')).toContainText('Balance: 70 ml');
  const fluid = await persist(page);
  expect(fluid.payload.rows[0].values[0]).toBe(100);
  const vitals = await editor(page, 'Signos vitales', true);
  await vitals.getByLabel('Hora', { exact: true }).fill('08:00');
  await vitals.locator('[name="pressure-0"]').fill('120/80');
  await persist(page);
  const note = await editor(page, 'Nota de enfermería', true);
  await note.getByLabel('Hora', { exact: true }).fill('08:10');
  await note.locator('[name="note-0"]').fill('Nota de QA ' + run);
  await expect(note.getByLabel('Completar mi JVPE')).toHaveValue('12345');
  await note.getByLabel('Completar mi JVPE').fill('edición pendiente');
  await expect(note.getByRole('button', { name: 'Actualizar mi perfil' })).toBeDisabled();
  const savedNote = await persist(page);
  expect(savedNote.jvpe).toBe('12345');
  const scale = await editor(page, 'Escala', true);
  await scale.getByRole('combobox', { name: 'Escala', exact: true }).selectOption('EVA');
  await scale.getByRole('radio').first().check();
  expect((await persist(page)).score).toBe(0);
  await page.goto('/clinical?patient=' + patientId);
  await page
    .getByRole('navigation', { name: 'Secciones del expediente' })
    .getByRole('button', { name: /Expediente completo/ })
    .click();
  await expect(page.locator('#patient-record-print')).toContainText('Nota de QA ' + run);
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole('button', { name: 'Imprimir expediente completo', exact: true }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#clinical-print-root')).toBeVisible();
  await expect(page.locator('#clinical-print-root')).toContainText('Paciente sintético');
  await expect(page.locator('#clinical-print-root')).toContainText('Nota de QA ' + run);
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.pdf({ path: './.local/clinical-record-qa.pdf', format: 'A4' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#clinical-print-root')).toHaveCount(0);
});

// test-id: playwright:clinical-connected-administration
test('card edit and mixed administration record each medicine without changing chronic inventory', async ({
  page,
}) => {
  await login(page, '/clinical/orders');
  const dialog = await editor(page, 'Tarjeta de medicamentos', true);
  await dialog.getByLabel('Crónicos', { exact: true }).fill('Crónico sintético navegador');
  const card = await persist(page);
  expect(card.medications).toHaveLength(2);
  const administration = await editor(page, 'Administración de medicamentos', true);
  const itemsTop = (await administration
    .getByRole('region', { name: 'Medicamentos de la administración' })
    .boundingBox())!.y;
  const detailsTop = (await administration
    .locator('.clinical-administration-details')
    .boundingBox())!.y;
  expect(itemsTop).toBeLessThan(detailsTop);
  await administration.getByLabel('Hora', { exact: true }).fill('09:00');
  await administration.getByLabel('Dosis', { exact: true }).fill('Captura manual sintética');
  await administration
    .getByRole('combobox', { name: 'Presentación', exact: true })
    .selectOption('Tableta');
  await administration
    .getByRole('combobox', { name: 'Vía de administración', exact: true })
    .selectOption('Oral');
  const med = card.medications.find((m: { chronic: boolean }) => !m.chronic);
  await administration
    .getByRole('combobox', { name: 'Aplicación · ' + med.name, exact: true })
    .selectOption('no');
  await administration
    .getByLabel('Motivo de no aplicación · ' + med.name)
    .fill('No aplicado en QA de navegador');
  await administration
    .getByRole('combobox', { name: 'Aplicación · Crónico sintético navegador', exact: true })
    .selectOption('yes');
  const result = await persist(page);
  expect(result.payload.items).toHaveLength(2);
  expect(result.stockMovementIds).toEqual([]);
  await page.goto('/reports/returns');
  await expect(page.getByText('No aplicado en QA de navegador').first()).toBeVisible();
});

// test-id: playwright:clinical-observations-menus
test('all seven nursing menus view, edit with versions, print and survive reload', async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, '/clinical/orders', 'admin');
  for (const label of [
    'Tarjeta de medicamentos',
    'Balance hídrico',
    'Plan de cuidado',
    'Administración de medicamentos',
    'Signos vitales',
    'Nota de enfermería',
    'Escala',
  ]) {
    await page.goto('/clinical/orders');
    await page.getByRole('button', { name: 'Acciones de enfermería', exact: true }).click();
    await page
      .locator('.clinical-action-grid')
      .getByRole('button', { name: label, exact: true })
      .click();
    await page
      .getByRole('searchbox', { name: 'Buscar por nombre o DUI' })
      .fill(patientId.split('-').at(-1)!);
    const row = page.locator('.clinical-patient-list > div').first();
    await row.locator('summary').click();
    await row.getByRole('button', { name: 'Ver', exact: true }).first().click();
    await expect(page.getByRole('dialog').locator('.clinical-record-card')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await row.locator('summary').click();
    await row.getByRole('button', { name: 'Editar', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('combobox', { name: 'Paciente', exact: true })).toBeDisabled();
    await dialog.getByLabel('Motivo de actualización').fill('Corrección sintética de verificación');
    const saved = await persist(page);
    expect(saved.correctionOf).toBeTruthy();
    expect(saved.version).toBeGreaterThan(1);
    await row.locator('summary').click();
    await page.evaluate(() => {
      window.print = () => {};
    });
    await row.getByRole('button', { name: 'Imprimir', exact: true }).first().click();
    await expect(page.locator('#clinical-print-root')).toContainText(label);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.reload();
    const snapshot = await getJson(page, '/api/operations');
    expect(snapshot.clinicalRecords.some((record: { id: string }) => record.id === saved.id)).toBe(
      true,
    );
  }
});

// test-id: playwright:clinical-connected-security
test('HTTP rejects missing CSRF, malformed input and cross-tenant clinical writes', async ({
  page,
}) => {
  await login(page, '/catalogs/clinical', 'foreign');
  const command = {
    command: 'clinical.record',
    record: {
      id: crypto.randomUUID(),
      patientId,
      caseId,
      date: '2026-11-04',
      payload: { kind: 'INDICATION', summary: 'Intento sintético externo' },
    },
  };
  expect((await browserApi(page, '/api/operations', command)).status).toBe(403);
  const csrf = await getJson(page, '/api/auth/csrf');
  const headers = { 'x-analiza-csrf': csrf.csrfToken };
  expect((await browserApi(page, '/api/operations', command, headers)).status).toBe(400);
  expect(
    (await browserApi(page, '/api/operations', { command: 'clinical.record', record: {} }, headers))
      .status,
  ).toBe(400);
  const snapshot = await getJson(page, '/api/operations');
  expect(
    snapshot.clinicalRecords.some((r: { patientId: string }) => r.patientId === patientId),
  ).toBe(false);
});

// test-id: playwright:clinical-connected-configuration
test('nurse can configure diagnosis associations and rates, then reopen the saved profile', async ({
  page,
}) => {
  await login(page, '/catalogs/clinical');
  const label = 'Diagnóstico sintético ' + Date.now();
  await page.getByRole('button', { name: 'Agregar diagnóstico' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre', { exact: true }).fill(label);
  await dialog.getByRole('checkbox', { name: 'EVA', exact: true }).check();
  await persist(page);
  await page.reload();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
  await page.goto('/catalogs/discounts');
  await page.getByRole('button', { name: 'Agregar perfil' }).click();
  await dialog.getByLabel('Nombre', { exact: true }).fill(label);
  await dialog.getByLabel('Medicamentos · %').fill('7');
  await persist(page);
  await page.reload();
  const row = page.locator('.clinical-patient-list > div').filter({ hasText: label });
  await row.getByRole('button', { name: 'Editar' }).click();
  await expect(dialog.getByLabel('Medicamentos · %')).toHaveValue('7');
});

// test-id: playwright:clinical-connected-discount
test('configured category discount creates a quote revision without changing the sent original', async ({
  page,
}) => {
  await login(page, '/quotes', 'admin');
  const run = patientId.split('-').at(-1)!;
  const quoteId = 'clinical-qa-q-' + run;
  await page.goto('/quotes?revise=' + quoteId);
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('combobox', { name: 'Perfil de descuento', exact: true })
    .selectOption('discount-FINANCE-' + run);
  await dialog.getByRole('combobox', { name: 'Ingreso clínico' }).selectOption('HOME_OUTPATIENT');
  await dialog
    .getByRole('combobox', { name: 'Diagnóstico', exact: true })
    .selectOption({ index: 1 });
  await dialog.getByLabel('Motivo de revisión').fill('QA de perfil por categoría');
  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().includes('/api/quotes') &&
      r.request().method() === 'POST' &&
      !r.url().includes('form-draft'),
  );
  await dialog.getByRole('button', { name: 'Crear revisión' }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBeLessThan(300);
  await expect(dialog).toHaveCount(0);
  await page.reload();
  const quotes = (await getJson(page, '/api/quotes')).quotes.map(
    (entry: { quote: unknown }) => entry.quote,
  );
  const original = quotes.find((quote: { id: string }) => quote.id === quoteId);
  const revised = quotes.find(
    (quote: { rootQuoteId?: string; originalQuoteId?: string; version: number }) =>
      (quote.rootQuoteId === quoteId || quote.originalQuoteId === quoteId) && quote.version === 2,
  );
  expect(original.total).toBe(3);
  expect(original.status).toBe('SENT');
  expect(revised.discount.categories.MEDICATIONS).toBe(5);
  expect(revised.total).toBe(2.85);
  const snapshot = await getJson(page, '/api/operations');
  const diagnosis = snapshot.configuration.find(
    (entry: { category: string; label: string }) =>
      entry.category === 'DIAGNOSIS' && entry.label === revised.diagnosisSummary,
  );
  expect(diagnosis).toBeTruthy();
  const csrf = await getJson(page, '/api/auth/csrf');
  expect(
    (
      await browserApi(
        page,
        '/api/operations',
        { command: 'configuration.save', entry: { ...diagnosis, scaleIds: ['GLASGOW'] } },
        { 'x-analiza-csrf': csrf.csrfToken },
      )
    ).status,
  ).toBe(200);
  const assessment = await editor(page, 'Escala', true);
  await expect(
    assessment.getByRole('combobox', { name: 'Escala', exact: true }).locator('option'),
  ).toHaveText(['Glasgow']);
});

// test-id: playwright:clinical-connected-correction-print
test('medication card correction preserves its original and prints only the selected record', async ({
  page,
}) => {
  await login(page, '/clinical/medication-cards');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const menu = page.locator('.clinical-row-menu summary').first();
    await expect(menu).toBeVisible();
    expect((await menu.boundingBox())!.width).toBeLessThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole('searchbox', { name: 'Buscar por nombre o DUI' })
    .fill(patientId.split('-').at(-1)!);
  const block = page
    .locator('.clinical-record-block')
    .filter({ has: page.locator('article.clinical-record-card') })
    .first();
  await expect(block).toBeVisible();
  const originalId = (await block.locator('article').getAttribute('id'))!.replace(
    'clinical-record-',
    '',
  );
  const before = (await getJson(page, '/api/operations')).clinicalRecords.find(
    (r: { id: string }) => r.id === originalId,
  );
  await block.getByRole('button', { name: 'Editar tarjeta', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Motivo de actualización').fill('Comprobación sintética de corrección');
  const chronic = 'Crónico sintético actualizado ' + Date.now();
  await expect(dialog.locator('[name="instructions"]')).toHaveCount(0);
  await dialog.getByRole('textbox', { name: 'Crónicos', exact: true }).fill(chronic);
  const saved = await persist(page);
  expect(saved.version).toBe(before.version + 1);
  expect(saved.rootId).toBe(before.rootId);
  expect(saved.payload.instructions).toBe(before.payload.instructions);
  const snapshot = await getJson(page, '/api/operations');
  expect(snapshot.clinicalRecords.find((r: { id: string }) => r.id === originalId)).toEqual(before);
  const corrected = page
    .locator('.clinical-record-block')
    .filter({ has: page.locator(`[id="clinical-record-${saved.id}"]`) });
  await page.evaluate(() => {
    window.print = () => {};
  });
  await corrected.getByRole('button', { name: 'Imprimir', exact: true }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#clinical-print-root')).toContainText(chronic);
  await expect(page.locator('#clinical-print-root .clinical-record-card')).toHaveCount(0);
  await expect(page.locator('#clinical-print-root h3')).toHaveCount(1);
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.pdf({ path: './.local/clinical-single-record-qa.pdf', format: 'A4' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#clinical-print-root')).toHaveCount(0);
});
