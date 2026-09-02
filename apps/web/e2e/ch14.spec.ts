import { expect, test } from '@playwright/test';

// test-id: playwright:ch14-inventory-factual-list
// test-id: playwright:ch14-inventory-permissions

async function login(page: import('@playwright/test').Page, email = 'admin@demo.local', password = 'demo-admin') {
  await page.goto('/login?next=%2Finventory');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('CH14 lists only factual synthetic balances and keeps undefined inventory operations disabled', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/inventory$/);
  const auditBefore = await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'));
  await expect(page.getByText('Items', { exact: true })).toHaveAttribute('aria-current', 'page');
  for (const header of ['Acciones', 'Tipo', 'Código', 'Nombre', 'Bodega', 'Disp', 'Comp', 'Total']) await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  await expect(page.getByText('No definido')).toHaveCount(2);
  await expect(page.getByText('No calculable')).toHaveCount(2);
  await expect(page.locator('[data-action-id="INVENTORY-ITEM-EXPORT"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="INVENTORY-TRANSFERS"]')).toBeDisabled();
  await page.getByLabel('Buscar inventario').fill('sin-inventario-ch14');
  await expect(page.locator('tbody .empty-state')).toContainText('Sin ítems documentados');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-inventario-ch14');
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'))).toBe(auditBefore);
});

test('CH14 grants factual inventory access to INVENTORY and denies NURSE directly', async ({ browser }) => {
  const inventory = await browser.newPage();
  await login(inventory, 'inventory@demo.local', 'demo-inventory');
  await expect(inventory.getByRole('heading', { name: 'Gestión de inventario' })).toBeVisible();
  await expect(inventory.getByLabel('Buscar inventario')).toBeVisible();
  const nurse = await browser.newPage();
  await login(nurse, 'nurse@demo.local', 'demo-nurse');
  await expect(nurse.locator('main[role="alert"]')).toContainText('Acceso restringido para el rol NURSE');
  await expect(nurse.getByRole('heading', { name: 'Gestión de inventario' })).toHaveCount(0);
  await inventory.close();
  await nurse.close();
});
