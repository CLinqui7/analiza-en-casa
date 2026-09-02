import { expect, test } from '@playwright/test';

// test-id: playwright:ch03-financial-navigation
// test-id: playwright:ch03-administrative-board
// test-id: playwright:ch03-filters-table-safe-state
// test-id: playwright:ch03-quotes-invoice-metadata

async function login(page: import('@playwright/test').Page, path = '/hospitalizations') {
  await page.goto(`/login?next=${encodeURIComponent(path)}`);
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\/')}$`));
}

test('CH03-F001 financial navigation has three live, authorized destinations', async ({ page }) => {
  await login(page);
  const financial = page.getByRole('button', { name: 'Financiero' });
  if (await financial.getAttribute('aria-expanded') === 'false') await financial.click();
  await expect(page.getByRole('link', { name: 'Hospitalización' })).toHaveAttribute('href', '/hospitalizations');
  await expect(page.getByRole('link', { name: 'Cuentas por cobrar' })).toHaveAttribute('href', '/receivables');
  await page.getByRole('link', { name: 'Preautorizaciones y reclamos' }).click();
  await expect(page).toHaveURL(/\/insurance$/);
});

test('CH03-F002-F008 board tabs, coherent loading/empty state, filters and active table work', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Relación de pacientes por empresa' })).toBeVisible();
  for (const label of ['Activos', 'Cotizaciones', 'PIC Ejecución']) await expect(page.getByRole('tab', { name: label })).toBeVisible();
  await expect(page.getByText('Conteo no configurado').first()).toBeVisible();
  for (const column of ['Acciones', 'Identificador', 'Paciente', 'Empresa', 'Tipo', 'Estado', 'Duración']) await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
  await page.locator('[data-action-id="HOSPITALIZATION-FILTER-STATUS"]').selectOption('ACTIVE');
  await expect(page.getByRole('button', { name: 'Aplicar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await expect(page.locator('[data-action-id="HOSPITALIZATION-FILTER-STATUS"]')).toHaveValue('');
  await expect(page.getByText('Cargando hospitalizaciones…')).toHaveCount(0);
  await page.getByRole('tab', { name: 'PIC Ejecución' }).click();
  await expect(page.getByText('Configuración pendiente')).toBeVisible();
  await page.getByRole('tab', { name: 'Activos' }).click();
  await page.getByRole('link', { name: /Pacientes · Inactivos/ }).click();
  await expect(page).toHaveURL(/\/patients\?tab=INACTIVE/);
});

test('CH03-F009-F013 quote tracking, safe insurance states and invoice fields are usable', async ({ page }) => {
  await login(page);
  await page.getByRole('tab', { name: 'Cotizaciones' }).click();
  for (const column of ['Paciente', 'DUI/NIT', 'Nro.', 'Estado', 'Envío preautorización', 'Respuesta seguro', 'Envío de reclamo', 'Creación', 'Total']) await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
  await expect(page.getByText('No aplica').first()).toBeVisible();
  await page.getByRole('link', { name: '+ Nuevo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva cotización' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Datos del paciente' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Datos iniciales de factura' })).toBeVisible();
  for (const label of ['Buscar paciente', 'Paciente', 'Documento', 'Teléfono', 'Correo', 'Fecha', 'Grupo de descuento', 'Referido por', 'Giftcard', 'Comentarios']) await expect(dialog.getByRole(label === 'Paciente' || label === 'Grupo de descuento' || label === 'Buscar paciente' ? 'combobox' : 'textbox', { name: label, exact: true })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Documento', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('textbox', { name: 'Fecha', exact: true })).not.toHaveValue('');
  await dialog.getByRole('combobox', { name: 'Buscar paciente', exact: true }).fill('Aurora');
  await dialog.getByRole('combobox', { name: 'Paciente', exact: true }).selectOption({ index: 1 });
  await expect(dialog.getByRole('textbox', { name: 'Documento', exact: true })).not.toHaveValue('No disponible');
});

test('CH03 mobile board and quote dialog have no document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByRole('tab', { name: 'Cotizaciones' })).toBeVisible();
  await page.getByRole('tab', { name: 'Cotizaciones' }).click();
  await page.getByRole('link', { name: '+ Nuevo' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
