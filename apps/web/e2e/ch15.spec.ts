import { expect, test } from '@playwright/test';

// test-id: playwright:ch15-medication-catalog
// test-id: playwright:ch15-medication-catalog-permissions

async function login(page: import('@playwright/test').Page, email = 'admin@demo.local', password = 'demo-admin') {
  await page.goto('/login?next=%2Fcatalogs%2Fmedications');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('CH15 renders the factual empty medication catalog without mutation', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/catalogs\/medications$/);
  const auditBefore = await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'));
  await expect(page.getByRole('heading', { name: 'Items / Medicamentos' })).toBeVisible();
  for (const header of ['Acciones', 'Código', 'Nombre', 'Impuesto', 'Descuento', 'Lotes', 'Estado']) {
    await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  }
  await expect(page.locator('[data-action-id="CATALOG-MEDICATIONS-EXPORT"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-MEDICATIONS-CREATE"]')).toBeDisabled();
  await expect(page.getByLabel('Registros de medicamentos por página')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-MEDICATIONS-PAGE-PREV"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-MEDICATIONS-PAGE-NEXT"]')).toBeDisabled();
  await page.getByLabel('Buscar medicamentos').fill('sin-medicamento-ch15');
  await expect(page.locator('tbody .empty-state')).toContainText('Sin medicamentos documentados');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-medicamento-ch15');
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'))).toBe(auditBefore);
});

test('CH15 lets INVENTORY open the medication catalog', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory');
  await expect(page.getByRole('heading', { name: 'Items / Medicamentos' })).toBeVisible();
  await expect(page.getByLabel('Buscar medicamentos')).toBeVisible();
});

test('CH15 lets AUDITOR search the medication catalog', async ({ page }) => {
  await login(page, 'auditor@demo.local', 'demo-auditor');
  await page.getByLabel('Buscar medicamentos').fill('sin-medicamento-auditor');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-medicamento-auditor');
});

test('CH15 denies DOCTOR direct medication catalog access', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor');
  await expect(page.locator('main[role="alert"]')).toContainText('DOCTOR');
  await expect(page.getByLabel('Buscar medicamentos')).toHaveCount(0);
});

test('CH15 denies NURSE direct medication catalog access', async ({ page }) => {
  await login(page, 'nurse@demo.local', 'demo-nurse');
  await expect(page.locator('main[role="alert"]')).toContainText('NURSE');
  await expect(page.getByLabel('Buscar medicamentos')).toHaveCount(0);
});

test('CH15 denies FINANCE direct medication catalog access', async ({ page }) => {
  await login(page, 'finance@demo.local', 'demo-finance');
  await expect(page.locator('main[role="alert"]')).toContainText('FINANCE');
  await expect(page.getByLabel('Buscar medicamentos')).toHaveCount(0);
});
