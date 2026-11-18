import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const fixture = JSON.parse(readFileSync(process.env.CLINICAL_QA_RESULT!, 'utf8'));
if (!fixture.patientId?.startsWith('clinical-qa-p-'))
  throw new Error('Synthetic clinical QA required');
const output = resolve('.local/extras18-browser');
mkdirSync(output, { recursive: true });
async function login(page: Page, path: string, role = 'admin') {
  await page.goto('/login?next=' + encodeURIComponent(path));
  await page.getByLabel('Usuario o correo').fill(`qa-${role}@example.test`);
  await page.getByLabel('Clave').fill(process.env.ANALIZA_QA_PASSWORD!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.locator('main h1')).toBeVisible();
}
async function api(page: Page, path: string, data?: unknown) {
  return page.evaluate(
    async ({ path, data }) => {
      const csrf = await (await fetch('/api/auth/csrf')).json();
      const response = await fetch(path, {
        method: data ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'x-analiza-csrf': csrf.csrfToken },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, data },
  );
}
test('searchable case context and separate care descriptions persist, preserving toggled text', async ({
  page,
}) => {
  await login(page, '/clinical/orders');
  const extraCase = `HOS-444-${Date.now()}`;
  expect(
    (
      await api(page, '/api/hospitalizations', {
        hospitalization: {
          id: extraCase,
          patientId: fixture.patientId,
          startDate: '2026-11-18',
          status: 'ACTIVE',
          accountType: 'PARTICULAR',
          priority: 'MEDIUM',
        },
      })
    ).status,
  ).toBe(201);
  await page.reload();
  await expect(page.locator('.clinical-action-grid')).toContainText('Antecedentes personales');
  await page.getByRole('button', { name: 'Acciones de enfermería', exact: true }).click();
  await page
    .locator('.clinical-action-grid')
    .getByRole('button', { name: 'Plan de cuidado', exact: true })
    .click();
  await page
    .getByRole('searchbox', { name: 'Buscar por nombre o DUI' })
    .fill(fixture.patientId.split('-').at(-1));
  await page
    .locator('.clinical-patient-list')
    .getByRole('button', { name: 'Plan de cuidado', exact: true })
    .click();
  const dialog = page.getByRole('dialog'),
    combo = dialog.getByRole('combobox', { name: 'Hospitalización', exact: true });
  await combo.fill('44');
  await expect(dialog.getByRole('option', { name: new RegExp(extraCase) })).toBeVisible();
  await combo.press('Enter');
  await expect(dialog.locator('.searchable-select .field-help')).toContainText(extraCase);
  await combo.fill('no-case-matches');
  await expect(dialog.getByText('Sin resultados', { exact: true })).toBeVisible();
  await combo.fill(fixture.caseId);
  await dialog.getByRole('option').first().click();
  await dialog.getByRole('checkbox', { name: 'Dieta', exact: true }).check();
  await dialog.getByLabel('Descripción de dieta', { exact: true }).fill('Dieta separada EXTRAS18');
  await dialog.getByRole('checkbox', { name: 'Cuidado de enfermería', exact: true }).check();
  await dialog
    .getByLabel('Descripción de cuidados de enfermería', { exact: true })
    .fill('Cuidados separados EXTRAS18');
  await dialog.getByRole('checkbox', { name: 'Dieta', exact: true }).uncheck();
  await dialog.getByRole('checkbox', { name: 'Dieta', exact: true }).check();
  await expect(dialog.getByLabel('Descripción de dieta', { exact: true })).toHaveValue(
    'Dieta separada EXTRAS18',
  );
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: resolve(output, `care-${width}.png`), animations: 'disabled' });
  }
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/operations') && r.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(200);
  const record = await saved.json();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  const restored = (await api(page, '/api/operations')).body.clinicalRecords.find(
    (r: { id: string }) => r.id === record.id,
  );
  expect(restored.payload.descriptions).toEqual({
    DIET: 'Dieta separada EXTRAS18',
    NURSING: 'Cuidados separados EXTRAS18',
  });
});
test('PDF download uses the same one, several and all record sections as printing', async ({
  page,
}) => {
  await login(page, `/clinical?patient=${fixture.patientId}&case=${fixture.caseId}`);
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeVisible();
  for (const sections of [
    ['Acciones médicas'],
    ['Acciones médicas', 'Acciones de enfermería'],
    ['Resumen', 'Acciones médicas', 'Acciones de enfermería', 'Visitas'],
  ]) {
    await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
    const dialog = page.getByRole('dialog');
    for (const checkbox of await dialog.getByRole('checkbox').all()) await checkbox.uncheck();
    await expect(dialog.getByRole('button', { name: 'Descargar selección en PDF' })).toBeDisabled();
    for (const name of sections)
      await dialog.getByRole('checkbox', { name: new RegExp('^' + name) }).check();
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Descargar selección en PDF' }).click();
    const download = await downloadPromise,
      path = resolve(output, `clinical-${sections.length}.pdf`);
    await download.saveAs(path);
    const text = execFileSync(
      'python',
      [
        '-c',
        'import sys; from pypdf import PdfReader; sys.stdout.buffer.write("\\n".join(p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages).encode("utf-8"))',
        path,
      ],
      { encoding: 'utf8' },
    );
    expect(text).toContain('Antecedentes personales');
    if (sections.length === 1) expect(text).not.toContain('Dieta separada EXTRAS18');
    else {
      expect(text).toContain('Dieta separada EXTRAS18');
      expect(text).toContain('Cuidados separados EXTRAS18');
    }
    expect(text).not.toContain('Ver cotización completa');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  }
});
test('Doctor has four clinical pages, reads solution context and cannot access finance or administration', async ({
  page,
}) => {
  await login(page, '/clinical/hospitalizations', 'doctor');
  await expect(page.locator('.nav-list a')).toHaveCount(4);
  const workspace = await api(page, '/api/workspace');
  expect(workspace.status).toBe(200);
  expect(workspace.body.quotes).toEqual([]);
  expect(workspace.body.payments).toEqual([]);
  const operations = await api(page, '/api/operations');
  const quote = operations.body.clinicalQuotes.find(
    (q: { id: string }) => q.id === fixture.solutionQuoteId,
  );
  expect(quote.items).toEqual(
    expect.arrayContaining([expect.objectContaining({ inventoryItemId: fixture.solutionId })]),
  );
  expect(quote).not.toHaveProperty('total');
  expect(quote.items[0]).not.toHaveProperty('unitPrice');
  expect((await api(page, `/api/quotes/${fixture.solutionQuoteId}`)).status).toBe(403);
  expect((await api(page, '/api/prequotes')).status).toBe(403);
  for (const path of ['/clinical', '/clinical/orders', '/agenda', '/clinical/hospitalizations']) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
  }
  await page.goto('/quotes');
  await expect(page.getByRole('alert')).toContainText('Acceso restringido');
  await page.goto('/clinical/orders');
  await page.getByRole('button', { name: 'Acciones de enfermería', exact: true }).click();
  await page
    .getByRole('searchbox', { name: 'Buscar por nombre o DUI' })
    .fill(fixture.patientId.split('-').at(-1));
  await page
    .locator('.clinical-patient-list')
    .getByRole('button', { name: 'Tarjeta de medicamentos', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Hospitalización', exact: true }).fill(fixture.caseId);
  await dialog.getByRole('option').first().click();
  await expect(dialog).toContainText('Solución sintética QA');
});
