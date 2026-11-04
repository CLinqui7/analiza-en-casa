import { test, expect, type Page } from '@playwright/test';
const patientId = process.env.CLINICAL_QA_PATIENT_ID!;
const caseId = process.env.CLINICAL_QA_CASE_ID!;
const secret = process.env.ANALIZA_QA_PASSWORD!;
if (!patientId?.startsWith('clinical-qa-p-') || !caseId?.startsWith('clinical-qa-c-') || !secret)
  throw new Error('Run the synthetic PostgreSQL verification first.');
async function login(page: Page, path: string, role = 'nurse') {
  await page.goto('/login?next=' + encodeURIComponent(path));
  await page.getByLabel('Usuario o correo').fill(`qa-${role}@example.test`);
  await page.getByLabel('Clave').fill(secret);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
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
    const snapshot = await (await page.request.get('/api/operations')).json();
    expect(snapshot.clinicalRecords.some((r: { id: string }) => r.id === saved.id)).toBe(true);
  }
  for (const plan of ['DIET', 'NURSING', 'LABORATORY']) {
    const dialog = await editor(page, 'Plan de cuidado', true);
    await dialog.getByLabel('Plan', { exact: true }).selectOption(plan);
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
  await administration.getByLabel('Hora', { exact: true }).fill('09:00');
  await administration.getByLabel('Dosis', { exact: true }).fill('Captura manual sintética');
  await administration.getByLabel('Presentación', { exact: true }).selectOption('Tableta');
  await administration.getByLabel('Vía de administración', { exact: true }).selectOption('Oral');
  const med = card.medications.find((m: { chronic: boolean }) => !m.chronic);
  await administration.getByLabel('Aplicación · ' + med.name, { exact: true }).selectOption('no');
  await administration
    .getByLabel('Motivo de no aplicación · ' + med.name)
    .fill('No aplicado en QA de navegador');
  await administration
    .getByLabel('Aplicación · Crónico sintético navegador', { exact: true })
    .selectOption('yes');
  const result = await persist(page);
  expect(result.payload.items).toHaveLength(2);
  expect(result.stockMovementIds).toEqual([]);
  await page.goto('/reports/returns');
  await expect(page.getByText('No aplicado en QA de navegador').first()).toBeVisible();
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
  expect((await page.request.post('/api/operations', { data: command })).status()).toBe(403);
  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  const headers = { 'x-analiza-csrf': csrf.csrfToken };
  expect((await page.request.post('/api/operations', { data: command, headers })).status()).toBe(
    400,
  );
  expect(
    (
      await page.request.post('/api/operations', {
        data: { command: 'clinical.record', record: {} },
        headers,
      })
    ).status(),
  ).toBe(400);
  const snapshot = await (await page.request.get('/api/operations')).json();
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
    .getByLabel('Perfil de descuento', { exact: true })
    .selectOption('discount-FINANCE-' + run);
  await dialog.getByLabel('Ingreso clínico').selectOption('HOME_OUTPATIENT');
  await dialog.getByLabel('Diagnóstico', { exact: true }).selectOption({ index: 1 });
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
  const { quotes } = await (await page.request.get('/api/quotes')).json();
  const original = quotes.find((quote: { id: string }) => quote.id === quoteId);
  const revised = quotes.find(
    (quote: { rootQuoteId?: string; originalQuoteId?: string; version: number }) =>
      (quote.rootQuoteId === quoteId || quote.originalQuoteId === quoteId) && quote.version === 2,
  );
  expect(original.total).toBe(3);
  expect(original.status).toBe('SENT');
  expect(revised.discount.categories.MEDICATIONS).toBe(5);
  expect(revised.total).toBe(2.85);
  const snapshot = await (await page.request.get('/api/operations')).json();
  const diagnosis = snapshot.configuration.find(
    (entry: { category: string; label: string }) =>
      entry.category === 'DIAGNOSIS' && entry.label === revised.diagnosisSummary,
  );
  expect(diagnosis).toBeTruthy();
  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  expect(
    (
      await page.request.post('/api/operations', {
        headers: { 'x-analiza-csrf': csrf.csrfToken },
        data: { command: 'configuration.save', entry: { ...diagnosis, scaleIds: ['GLASGOW'] } },
      })
    ).status(),
  ).toBe(200);
  const assessment = await editor(page, 'Escala', true);
  await expect(
    assessment.getByRole('combobox', { name: 'Escala', exact: true }).locator('option'),
  ).toHaveText(['Glasgow']);
});
