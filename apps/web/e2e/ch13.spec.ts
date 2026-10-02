import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
// test-id: playwright:ch13-factual-purchase-list
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login?next=%2Fpurchases');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/purchases$/);
}
test('CH13 renders a factual purchase list without financial operations', async ({ page }) => {
  await login(page);
  const before = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await expect(page.getByRole('heading', { name: 'Listado' })).toBeVisible();
  for (const header of [
    'Acciones',
    'Tipo',
    'Número',
    'Proveedor',
    'Total',
    '# Factura',
    'Fecha',
    'Estado',
    'Registro PT',
  ])
    await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excel' })).toBeDisabled();
  await page.getByLabel('Buscar compras').fill('sin-compra-ch13');
  await expect(page.locator('tbody .empty-state')).toContainText('Sin compras documentadas');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-compra-ch13');
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(before);
});
// test-id: playwright:feedback-purchase-catalog-prefix-and-equipment-traceability
test('purchase catalog supports word-prefix search and equipment keeps only its serial', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'Nueva compra' }).click();

  const dialog = page.getByRole('dialog', { name: 'Nueva compra' });
  await expect(dialog.getByLabel('Bodega de destino')).toHaveValue('central');
  const catalog = dialog.getByRole('combobox', { name: 'Ítem de catálogo' });
  await catalog.fill('unidad');
  await dialog.getByRole('option', { name: /Unidad inerte QA/ }).click();
  await expect(dialog.getByText(/Seleccionado:.*Unidad inerte QA/)).toBeVisible();
  await expect(dialog.getByLabel('Fecha de vencimiento')).toBeVisible();
  await expect(dialog.getByLabel('Lote')).toBeVisible();
  await expect(dialog.getByLabel('Número de serie')).toHaveCount(0);

  await dialog.getByLabel('Fecha de vencimiento').fill('2027-01-01');
  await dialog.getByLabel('Lote').fill('LOT-SYNTHETIC-01');
  await catalog.fill('kit');
  await dialog.getByRole('option', { name: /Kit operativo demo/ }).click();
  await expect(dialog.getByText(/Seleccionado:.*Kit operativo demo/)).toBeVisible();
  await expect(dialog.getByLabel('Fecha de vencimiento')).toHaveCount(0);
  await expect(dialog.getByLabel('Lote')).toHaveCount(0);
  await expect(dialog.getByLabel('Número de serie')).toBeVisible();

  await dialog.getByLabel('Referencia de compra').fill('PURCHASE-SEARCH-QA-001');
  await dialog.getByLabel('Número de serie').fill('SERIAL-SYNTHETIC-01');
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('status')).toContainText('guardada como borrador');

  const saved = await page.evaluate(() => {
    const purchases = JSON.parse(
      localStorage.getItem('analiza.en.casa.workspace.v3.purchases') ?? '[]',
    ) as Array<Record<string, unknown>>;
    return purchases.find((purchase) => purchase.reference === 'PURCHASE-SEARCH-QA-001');
  });
  expect(saved).toMatchObject({
    catalogItemId: 'catalog-demo-kit',
    warehouseId: 'central',
    serialNumber: 'SERIAL-SYNTHETIC-01',
  });
  expect(saved).not.toHaveProperty('expirationDate');
  expect(saved).not.toHaveProperty('lotNumber');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('compras-filtradas.xlsx');
  const archive = unzipSync(new Uint8Array(await readFile(await download.path())));
  expect(strFromU8(archive['xl/workbook.xml'])).toContain('sheet name="Compras"');
  expect(strFromU8(archive['xl/worksheets/sheet1.xml'])).toContain('PURCHASE-SEARCH-QA-001');
  expect(strFromU8(archive['xl/worksheets/sheet1.xml'])).toContain('central');
});
test('CH13 permits AUDITOR read-only list access and denies NURSE directly', async ({
  browser,
}) => {
  const auditor = await browser.newPage();
  await auditor.goto('/login?next=%2Fpurchases');
  await auditor.getByLabel('Usuario o correo').fill('auditor@demo.local');
  await auditor.getByLabel('Clave').fill('demo-auditor');
  await auditor.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(auditor.getByRole('heading', { name: 'Listado' })).toBeVisible();
  await expect(auditor.getByRole('button', { name: 'Nueva compra' })).toHaveCount(0);
  const nurse = await browser.newPage();
  await nurse.goto('/login?next=%2Fpurchases');
  await nurse.getByLabel('Usuario o correo').fill('nurse@demo.local');
  await nurse.getByLabel('Clave').fill('demo-nurse');
  await nurse.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(nurse.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol NURSE',
  );
  await auditor.close();
  await nurse.close();
});
