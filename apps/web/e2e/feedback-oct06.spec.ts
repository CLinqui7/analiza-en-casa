import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

async function login(page: import('@playwright/test').Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
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

test('quote honorarium uses only requested selectable amounts', async ({ page }) => {
  await login(page, '/quotes?create=1');
  const dialog = page.getByRole('dialog', { name: 'Nueva cotización' });
  await dialog.getByRole('tab', { name: 'Honorarios' }).click();
  const amount = dialog.locator('[data-action-id="QUOTE-FEE-AMOUNT"]');
  await expect(amount).toHaveValue('0');
  await expect(amount.locator('option')).toHaveCount(59);
  await amount.selectOption('15');
  await expect(amount).toHaveValue('15');
  await amount.selectOption('300');
  await expect(amount).toHaveValue('300');
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
  await page.getByRole('link', { name: 'Consultar' }).first().click();
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
