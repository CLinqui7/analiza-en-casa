import { expect, test } from '@playwright/test';

// test-id: playwright:ch15-medication-catalog
// test-id: playwright:ch15-medication-catalog-permissions
// test-id: playwright:ch15-studies-catalog
// test-id: playwright:ch15-studies-catalog-permissions

async function login(page: import('@playwright/test').Page, email = 'admin@demo.local', password = 'demo-admin', next = '/catalogs/medications') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
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

test('CH15 renders the factual empty supplies catalog without mutation', async ({ page }) => {
  await login(page, 'admin@demo.local', 'demo-admin', '/catalogs/supplies');
  await expect(page).toHaveURL(/\/catalogs\/supplies$/);
  const auditBefore = await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'));
  await expect(page.getByRole('heading', { name: 'Items / Insumos' })).toBeVisible();
  for (const header of ['Acciones', 'Código', 'Nombre', 'Tipo', 'Impuesto', 'Descuento', 'Lotes', 'Estado']) {
    await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  }
  await expect(page.locator('[data-action-id="CATALOG-SUPPLIES-EXPORT"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-SUPPLIES-CREATE"]')).toBeDisabled();
  await expect(page.getByLabel('Registros de insumos por página')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-SUPPLIES-PAGE-PREV"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-SUPPLIES-PAGE-NEXT"]')).toBeDisabled();
  await page.getByLabel('Buscar insumos').fill('sin-insumo-ch15');
  await expect(page.locator('tbody .empty-state')).toContainText('Sin insumos documentados');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-insumo-ch15');
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'))).toBe(auditBefore);
});

test('CH15 lets INVENTORY open the supplies catalog', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory', '/catalogs/supplies');
  await expect(page.getByRole('heading', { name: 'Items / Insumos' })).toBeVisible();
  await expect(page.getByLabel('Buscar insumos')).toBeVisible();
});

test('CH15 lets AUDITOR search the supplies catalog', async ({ page }) => {
  await login(page, 'auditor@demo.local', 'demo-auditor', '/catalogs/supplies');
  await page.getByLabel('Buscar insumos').fill('sin-insumo-auditor');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-insumo-auditor');
});

test('CH15 denies DOCTOR direct supplies catalog access', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor', '/catalogs/supplies');
  await expect(page.locator('main[role="alert"]')).toContainText('DOCTOR');
  await expect(page.getByLabel('Buscar insumos')).toHaveCount(0);
});

test('CH15 denies NURSE direct supplies catalog access', async ({ page }) => {
  await login(page, 'nurse@demo.local', 'demo-nurse', '/catalogs/supplies');
  await expect(page.locator('main[role="alert"]')).toContainText('NURSE');
  await expect(page.getByLabel('Buscar insumos')).toHaveCount(0);
});

test('CH15 denies FINANCE direct supplies catalog access', async ({ page }) => {
  await login(page, 'finance@demo.local', 'demo-finance', '/catalogs/supplies');
  await expect(page.locator('main[role="alert"]')).toContainText('FINANCE');
  await expect(page.getByLabel('Buscar insumos')).toHaveCount(0);
});

test('CH15 renders the factual empty diagnostic studies catalog without mutation', async ({ page }) => {
  await login(page, 'admin@demo.local', 'demo-admin', '/catalogs/studies');
  await expect(page).toHaveURL(/\/catalogs\/studies$/);
  const auditBefore = await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'));
  await expect(page.getByRole('heading', { name: 'Items / Estudios Dx' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Acciones' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Código' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Nombre' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Descripción' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Impuesto' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Descuento' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeVisible();
  await expect(page.locator('[data-action-id="CATALOG-STUDIES-EXPORT"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-STUDIES-CREATE"]')).toBeDisabled();
  await expect(page.getByLabel('Registros de estudios por página')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-STUDIES-PAGE-PREV"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-STUDIES-PAGE-NEXT"]')).toBeDisabled();
  await page.getByLabel('Buscar estudios diagnósticos').fill('sin-estudio-ch15');
  await expect(page.locator('tbody .empty-state')).toContainText('Sin estudios diagnósticos documentados');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-estudio-ch15');
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'))).toBe(auditBefore);
});

test('CH15 lets INVENTORY open the diagnostic studies catalog', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory', '/catalogs/studies');
  await expect(page.getByRole('heading', { name: 'Items / Estudios Dx' })).toBeVisible();
  await expect(page.getByLabel('Buscar estudios diagnósticos')).toBeVisible();
});

test('CH15 lets AUDITOR search the diagnostic studies catalog', async ({ page }) => {
  await login(page, 'auditor@demo.local', 'demo-auditor', '/catalogs/studies');
  await page.getByLabel('Buscar estudios diagnósticos').fill('sin-estudio-auditor');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-estudio-auditor');
});

test('CH15 denies DOCTOR direct diagnostic studies catalog access', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor', '/catalogs/studies');
  await expect(page.locator('main[role="alert"]')).toContainText('DOCTOR');
  await expect(page.getByLabel('Buscar estudios diagnósticos')).toHaveCount(0);
});

test('CH15 denies NURSE direct diagnostic studies catalog access', async ({ page }) => {
  await login(page, 'nurse@demo.local', 'demo-nurse', '/catalogs/studies');
  await expect(page.locator('main[role="alert"]')).toContainText('NURSE');
  await expect(page.getByLabel('Buscar estudios diagnósticos')).toHaveCount(0);
});

test('CH15 denies FINANCE direct diagnostic studies catalog access', async ({ page }) => {
  await login(page, 'finance@demo.local', 'demo-finance', '/catalogs/studies');
  await expect(page.locator('main[role="alert"]')).toContainText('FINANCE');
  await expect(page.getByLabel('Buscar estudios diagnósticos')).toHaveCount(0);
});
