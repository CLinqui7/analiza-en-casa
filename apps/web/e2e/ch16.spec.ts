import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login?next=%2Fcatalogs%2Fdiscounts');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

// test-id: playwright:ch16-discount-matrix
test('CH16 renders only the factual empty discount-family matrix without financial mutation', async ({
  page,
}) => {
  await login(page, 'admin@demo.local', 'demo-admin');
  await expect(page).toHaveURL(/\/catalogs\/discounts$/);
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );

  await expect(page.getByRole('heading', { name: 'Descuentos' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Acciones' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Nombre' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Descripción' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Servicios' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Laboratorios' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Medicamentos' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Equipos' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Insumos' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Honorarios' })).toBeVisible();

  await page.locator('[data-action-id="CATALOG-DISCOUNTS-SEARCH"]').fill('sin-matriz-ch16');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-matriz-ch16');
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-EXPORT"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-CREATE"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-PAGE-SIZE"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-PAGE-PREV"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-PAGE-NEXT"]')).toBeDisabled();

  await page.reload();
  await expect(page.locator('tbody .empty-state')).toContainText(
    'Sin perfiles de descuento documentados',
  );
  expect(
    await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
  ).toBe(auditBefore);
});

test('CH16 lets INVENTORY read the discount-family matrix', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory');
  await expect(page.getByRole('heading', { name: 'Descuentos' })).toBeVisible();
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-SEARCH"]')).toBeVisible();
});

test('CH16 lets AUDITOR search the factual discount-family matrix', async ({ page }) => {
  await login(page, 'auditor@demo.local', 'demo-auditor');
  await page.locator('[data-action-id="CATALOG-DISCOUNTS-SEARCH"]').fill('sin-auditor-ch16');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-auditor-ch16');
});

test('CH16 denies DOCTOR direct discount-matrix access', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor');
  await expect(page.locator('main[role="alert"]')).toContainText('DOCTOR');
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-SEARCH"]')).toHaveCount(0);
});

test('CH16 denies NURSE direct discount-matrix access', async ({ page }) => {
  await login(page, 'nurse@demo.local', 'demo-nurse');
  await expect(page.locator('main[role="alert"]')).toContainText('NURSE');
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-SEARCH"]')).toHaveCount(0);
});

test('CH16 denies FINANCE direct discount-matrix access', async ({ page }) => {
  await login(page, 'finance@demo.local', 'demo-finance');
  await expect(page.locator('main[role="alert"]')).toContainText('FINANCE');
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-SEARCH"]')).toHaveCount(0);
});
