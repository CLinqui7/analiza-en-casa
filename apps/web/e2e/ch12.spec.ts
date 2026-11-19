import { expect, test } from '@playwright/test';

// test-id: playwright:ch12-payables-summary
// test-id: playwright:ch12-payables-permissions

async function login(
  page: import('@playwright/test').Page,
  email = 'admin@demo.local',
  password = 'demo-admin',
  next = '/payables',
) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

test('CH12 renders the factual payables summary without creating financial records', async ({
  page,
}) => {
  await login(page);
  const storedBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await expect(page.getByRole('heading', { name: 'Órdenes de compra' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Facturas de proveedores' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Estado de factura' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Saldo aprobado' })).toBeVisible();
  await page.getByLabel('Buscar orden o proveedor').fill('sin-factura-ch12');
  await expect(page.getByText('No hay órdenes para esta búsqueda.')).toBeVisible();
  await expect(page.getByText('No hay facturas para esta búsqueda.')).toBeVisible();
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(storedBefore);
});

test('CH12 permits FINANCE to read the payables summary', async ({ page }) => {
  await login(page, 'finance@demo.local', 'demo-finance', '/receivables');
  await page.locator('[data-action-id="PAYABLES-NAVIGATE"]').click();
  await expect(page).toHaveURL(/\/payables$/);
  await expect(page.getByRole('heading', { name: 'Cuentas por pagar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Órdenes de compra' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Crear orden' })).toHaveCount(0);
});

test('CH12 denies INVENTORY direct payables navigation', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory');
  await expect(page.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol INVENTORY',
  );
  await expect(page.getByRole('heading', { name: 'Cuentas por pagar' })).toHaveCount(0);
});
