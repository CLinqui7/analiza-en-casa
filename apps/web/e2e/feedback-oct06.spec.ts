import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

async function login(page: import('@playwright/test').Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), {
    timeout: 15_000,
  });
}

test('catalog filters find items by name and status', async ({ page }) => {
  await login(page, '/catalogs');
  await page.getByRole('button', { name: 'Nuevo ítem' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo ítem' });
  await dialog.getByLabel('Nombre').fill('Servicio filtro QA');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await page.getByLabel('Buscar por nombre o código').fill('filtro QA');
  await expect(page.getByRole('cell', { name: 'Servicio filtro QA' })).toBeVisible();
  await page.getByLabel('Estado').selectOption('INACTIVE');
  await expect(page.getByRole('cell', { name: 'Servicio filtro QA' })).toHaveCount(0);
  await page.getByLabel('Estado').selectOption('ACTIVE');
  await expect(page.getByRole('cell', { name: 'Servicio filtro QA' })).toBeVisible();
});

test('purchase invoice, edit and cancellation persist before receipt', async ({ page }) => {
  await login(page, '/purchases');
  await page.getByRole('button', { name: 'Nueva compra' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva compra' });
  await dialog.getByLabel('Referencia de compra').fill('COMPRA-AUDIT-QA');
  await dialog.getByLabel('Número de factura (opcional)').fill('FACT-QA-001');
  await dialog.getByLabel('Número de serie').fill('SERIE-AUDIT-QA');
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  const row = page.getByRole('row').filter({ hasText: 'COMPRA-AUDIT-QA' });
  await expect(row).toContainText('FACT-QA-001');
  await row.getByRole('button', { name: 'Editar' }).click();
  const editor = page.getByRole('dialog', { name: 'Editar compra' });
  await editor.getByLabel('Número de factura (opcional)').fill('FACT-QA-002');
  await editor.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.reload();
  const updated = page.getByRole('row').filter({ hasText: 'COMPRA-AUDIT-QA' });
  await expect(updated).toContainText('FACT-QA-002');
  await updated.getByRole('button', { name: 'Anular' }).click();
  const cancel = page.getByRole('dialog', { name: 'Anular borrador de compra' });
  await cancel.getByLabel('Motivo de anulación').fill('Borrador de prueba reemplazado');
  await cancel.getByRole('button', { name: 'Confirmar anulación' }).click();
  await page.reload();
  const cancelled = page.getByRole('row').filter({ hasText: 'COMPRA-AUDIT-QA' });
  await expect(cancelled).toContainText('Anulada');
  await expect(cancelled.getByRole('button', { name: 'Recibir' })).toHaveCount(0);
});

test('one purchase invoice saves multiple product lines together', async ({ page }) => {
  await login(page, '/purchases');
  await page.getByRole('button', { name: 'Nueva compra' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva compra' });
  await dialog.getByLabel('Referencia de compra').fill('COMPRA-MULTI-QA');
  await dialog.getByLabel('Número de factura (opcional)').fill('FACT-MULTI-QA');
  await dialog.getByLabel('Número de serie').fill('SERIE-MULTI-A');
  await dialog.getByRole('button', { name: 'Añadir línea' }).click();
  await expect(dialog.getByText('Factura FACT-MULTI-QA: 1 línea(s) listas.')).toBeVisible();
  await dialog.getByLabel('Número de serie').fill('SERIE-MULTI-B');
  await dialog.getByRole('button', { name: 'Añadir línea' }).click();
  await dialog.getByRole('button', { name: 'Guardar factura (2)' }).click();
  await expect(page.getByRole('status')).toContainText('Factura guardada con 2 línea(s)');
  await page.getByLabel('Buscar compras').fill('COMPRA-MULTI-QA');
  const invoice = page.getByRole('row').filter({ hasText: 'COMPRA-MULTI-QA' });
  await expect(invoice).toHaveCount(1);
  await expect(invoice).toContainText('2 línea(s) en esta factura');
  await expect(invoice.getByRole('button', { name: 'Editar líneas' })).toBeVisible();
  await expect(invoice.getByRole('button', { name: 'Recibir líneas' })).toBeVisible();
  await expect(invoice.getByRole('button', { name: 'Anular factura' })).toBeVisible();
  if (process.env.ANALIZA_CAPTURE_FEEDBACK_SCREENSHOTS === '1') {
    await page.screenshot({
      path: 'docs/feedback/purchases-grouped-synthetic.png',
      fullPage: true,
      animations: 'disabled',
    });
  }
  await invoice.getByRole('button', { name: 'Abrir' }).click();
  const detail = page.getByRole('dialog', { name: 'Detalle de factura o compra' });
  await expect(detail.getByRole('row')).toHaveCount(3);
  if (process.env.ANALIZA_CAPTURE_FEEDBACK_SCREENSHOTS === '1') {
    await detail.getByRole('table', { name: 'Líneas de la factura' }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'docs/feedback/purchases-detail-synthetic.png',
      fullPage: true,
      animations: 'disabled',
    });
  }
  await expect(detail.getByRole('button', { name: 'Editar línea' })).toHaveCount(2);
  await expect(detail.getByRole('button', { name: 'Recibir línea' })).toHaveCount(2);
  await detail.getByRole('button', { name: 'Ver línea' }).nth(1).click();
  await expect(detail).toContainText('SERIE-MULTI-B');
  await detail.getByRole('button', { name: 'Anular línea' }).first().click();
  const cancellation = page.getByRole('dialog', { name: 'Anular borrador de compra' });
  await cancellation.getByLabel('Motivo de anulación').fill('Línea de prueba sustituida');
  await cancellation.getByRole('button', { name: 'Confirmar anulación' }).click();
  await invoice.getByRole('button', { name: 'Abrir' }).click();
  await expect(detail.getByRole('row')).toHaveCount(3);
  await expect(detail.getByRole('button', { name: 'Recibir línea' })).toHaveCount(1);
});

test('quote honorarium is selected for each quote, not fixed on the doctor', async ({ page }) => {
  await login(page, '/doctors');
  await page.getByRole('button', { name: 'Nuevo médico' }).click();
  const doctorDialog = page.getByRole('dialog', { name: 'Nuevo médico' });
  await doctorDialog.getByLabel('Nombre completo').fill('Médico QA Catálogo');
  await doctorDialog.getByLabel('JVPM').fill('JVPM-QA-CATALOG');
  await doctorDialog.getByLabel('DUI').fill('DUI-QA-CATALOG');
  await doctorDialog.getByLabel('Relación del médico').selectOption('NEW');
  await doctorDialog.getByLabel('Especialidad o profesión').fill('Nutri');
  await doctorDialog.getByRole('option', { name: 'Nutricionista' }).click();
  await doctorDialog.getByLabel('Dirección').fill('Dirección sintética QA');
  await doctorDialog.getByLabel('Teléfono fijo (obligatorio)').fill('2222-0600');
  await doctorDialog.getByRole('button', { name: 'Guardar médico' }).click();
  await page.goto('/quotes?create=1');
  const dialog = page.getByRole('dialog', { name: 'Nueva cotización' });
  await dialog
    .locator('[data-action-id="QUOTE-PRIMARY-DOCTOR"]')
    .selectOption({ label: 'Médico QA Catálogo' });
  await dialog.getByRole('tab', { name: 'Honorarios' }).click();
  const amount = dialog.locator('[data-action-id="QUOTE-FEE-AMOUNT"]');
  await expect(amount).toHaveValue('0');
  await amount.selectOption('75');
  await expect(amount).toHaveValue('75');
  await expect(amount.locator('option[value="300"]')).toHaveCount(1);
  await expect(amount.locator('option[value="301"]')).toHaveCount(0);
});

test('clinical case pickers filter by patient or case without dropping the selected record', async ({
  page,
}) => {
  await login(page, '/clinical/care-plans');
  await page.getByRole('button', { name: 'Nuevo plan de cuidado' }).click();
  const dialog = page.getByRole('dialog');
  const cases = dialog.getByRole('combobox', { name: 'Hospitalización' });
  const initial = await cases.inputValue();
  await dialog.getByLabel('Filtrar hospitalizaciones por paciente, DUI o código').fill('no-existe');
  await expect(cases.locator('option')).toHaveCount(1);
  await expect(cases).toHaveValue(initial);
  await dialog.getByRole('button', { name: 'Cancelar' }).click();

  await page.goto('/clinical/balance');
  const selectedCase = page.getByLabel('Paciente y hospitalización');
  const initialBalance = await selectedCase.inputValue();
  await page.getByLabel('Filtrar balances por paciente, DUI o código').fill('no-existe');
  await expect(selectedCase.locator('option')).toHaveCount(1);
  await expect(selectedCase).toHaveValue(initialBalance);
});

test('individual statement scopes charges to the selected patient', async ({ page }) => {
  await login(page, '/receivables');
  await page.evaluate(() => {
    const key = 'analiza.en.casa.workspace.v3.quotes';
    const quotes = JSON.parse(localStorage.getItem(key) ?? '[]');
    quotes.push({
      id: 'statement-qa-001',
      patientId: 'patient-demo-001',
      version: 1,
      status: 'SENT',
      summary: 'Cargo sintético para estado de cuenta',
      items: [],
      subtotal: 10,
      discountAmount: 0,
      total: 10,
      insurerAmount: 0,
      patientAmount: 10,
      immutable: true,
      createdAt: '2026-10-06T12:00:00.000Z',
      sentAt: '2026-10-06T12:00:00.000Z',
    });
    localStorage.setItem(key, JSON.stringify(quotes));
  });
  await page.reload();
  const search = page.getByRole('combobox', { name: 'Buscar paciente para estado de cuenta' });
  await search.fill('Paciente');
  const first = page.getByRole('option').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.getByRole('row').filter({ hasText: 'COT-' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar estado de cuenta PDF' })).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar estado de cuenta PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^estado-cuenta-.*\.pdf$/);
});

test('quote print layout paginates long content instead of clipping at viewport height', async ({
  page,
}) => {
  await login(page, '/quotes');
  await page.getByRole('link', { name: 'Editar' }).first().click();
  await expect(page.locator('.quote-print-area')).toBeVisible();
  await page.evaluate(() => {
    const area = document.querySelector('.quote-print-area');
    const overflow = document.createElement('div');
    overflow.style.height = '1800px';
    overflow.textContent = 'Continuación sintética de la cotización';
    area?.append(overflow);
  });
  await page.emulateMedia({ media: 'print' });
  const properties = await page.evaluate(() => {
    const app = getComputedStyle(document.querySelector('.app-shell')!);
    const main = getComputedStyle(document.querySelector('.main-content')!);
    return { appHeight: app.height, appOverflow: app.overflow, mainOverflow: main.overflow };
  });
  expect(properties.appOverflow).toBe('visible');
  expect(properties.mainOverflow).toBe('visible');
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1);
});
