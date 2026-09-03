import { expect, test } from '@playwright/test';

// test-id: playwright:ch15-medication-catalog
// test-id: playwright:ch15-medication-catalog-permissions
// test-id: playwright:ch15-studies-catalog
// test-id: playwright:ch15-studies-catalog-permissions
// test-id: playwright:ch15-fees-catalog
// test-id: playwright:ch15-fees-catalog-permissions
// test-id: playwright:ch15-services-catalog
// test-id: playwright:ch15-services-catalog-permissions
// test-id: playwright:ch15-discounts-catalog
// test-id: playwright:ch15-discounts-catalog-permissions

async function login(
  page: import('@playwright/test').Page,
  email = 'admin@demo.local',
  password = 'demo-admin',
  next = '/catalogs/medications',
) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('CH15 renders the factual empty discount matrix without mutation', async ({ page }) => {
  await login(page, 'admin@demo.local', 'demo-admin', '/catalogs/discounts');
  await expect(page).toHaveURL(/\/catalogs\/discounts$/);
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await expect(page.getByRole('heading', { name: 'Descuentos' })).toBeVisible();
  for (const header of [
    'Acciones',
    'Nombre',
    'Descripción',
    'Servicios',
    'Laboratorios',
    'Medicamentos',
    'Equipos',
    'Insumos',
    'Honorarios',
  ]) {
    await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  }
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-EXPORT"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-CREATE"]')).toBeDisabled();
  await expect(page.getByLabel('Registros de descuentos por página')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-PAGE-PREV"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-DISCOUNTS-PAGE-NEXT"]')).toBeDisabled();
  await page.getByLabel('Buscar descuentos').fill('sin-descuento-ch15');
  await expect(page.locator('tbody .empty-state')).toContainText(
    'Sin perfiles de descuento documentados',
  );
  await expect(page.locator('tbody .empty-state')).toContainText('sin-descuento-ch15');
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(auditBefore);
});

test('CH15 lets INVENTORY open the discount matrix', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory', '/catalogs/discounts');
  await expect(page.getByRole('heading', { name: 'Descuentos' })).toBeVisible();
  await expect(page.getByLabel('Buscar descuentos')).toBeVisible();
});

test('CH15 lets AUDITOR search the discount matrix', async ({ page }) => {
  await login(page, 'auditor@demo.local', 'demo-auditor', '/catalogs/discounts');
  await page.getByLabel('Buscar descuentos').fill('sin-descuento-auditor');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-descuento-auditor');
});

test('CH15 denies DOCTOR direct discount matrix access', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor', '/catalogs/discounts');
  await expect(page.locator('main[role="alert"]')).toContainText('DOCTOR');
  await expect(page.getByLabel('Buscar descuentos')).toHaveCount(0);
});

test('CH15 denies NURSE direct discount matrix access', async ({ page }) => {
  await login(page, 'nurse@demo.local', 'demo-nurse', '/catalogs/discounts');
  await expect(page.locator('main[role="alert"]')).toContainText('NURSE');
  await expect(page.getByLabel('Buscar descuentos')).toHaveCount(0);
});

test('CH15 denies FINANCE direct discount matrix access', async ({ page }) => {
  await login(page, 'finance@demo.local', 'demo-finance', '/catalogs/discounts');
  await expect(page.locator('main[role="alert"]')).toContainText('FINANCE');
  await expect(page.getByLabel('Buscar descuentos')).toHaveCount(0);
});

test('CH15 renders the factual empty services catalog without mutation', async ({ page }) => {
  await login(page, 'admin@demo.local', 'demo-admin', '/catalogs/services');
  await expect(page).toHaveURL(/\/catalogs\/services$/);
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await expect(page.getByRole('heading', { name: 'Items / Servicios' })).toBeVisible();
  for (const header of [
    'Acciones',
    'Código',
    'Nombre',
    'Tipo de producto',
    'Categoría',
    'Impuesto',
    'Descuento',
    'Estado',
  ]) {
    await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  }
  await expect(page.locator('[data-action-id="CATALOG-SERVICES-EXPORT"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-SERVICES-CREATE"]')).toBeDisabled();
  await expect(page.getByLabel('Registros de servicios por página')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-SERVICES-PAGE-PREV"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-SERVICES-PAGE-NEXT"]')).toBeDisabled();
  await page.getByLabel('Buscar servicios').fill('sin-servicio-ch15');
  await expect(page.locator('tbody .empty-state')).toContainText('Sin servicios documentados');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-servicio-ch15');
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(auditBefore);
});

test('CH15 lets INVENTORY open the services catalog', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory', '/catalogs/services');
  await expect(page.getByRole('heading', { name: 'Items / Servicios' })).toBeVisible();
  await expect(page.getByLabel('Buscar servicios')).toBeVisible();
});

test('CH15 lets AUDITOR search the services catalog', async ({ page }) => {
  await login(page, 'auditor@demo.local', 'demo-auditor', '/catalogs/services');
  await page.getByLabel('Buscar servicios').fill('sin-servicio-auditor');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-servicio-auditor');
});

test('CH15 denies DOCTOR direct services catalog access', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor', '/catalogs/services');
  await expect(page.locator('main[role="alert"]')).toContainText('DOCTOR');
  await expect(page.getByLabel('Buscar servicios')).toHaveCount(0);
});

test('CH15 denies NURSE direct services catalog access', async ({ page }) => {
  await login(page, 'nurse@demo.local', 'demo-nurse', '/catalogs/services');
  await expect(page.locator('main[role="alert"]')).toContainText('NURSE');
  await expect(page.getByLabel('Buscar servicios')).toHaveCount(0);
});

test('CH15 denies FINANCE direct services catalog access', async ({ page }) => {
  await login(page, 'finance@demo.local', 'demo-finance', '/catalogs/services');
  await expect(page.locator('main[role="alert"]')).toContainText('FINANCE');
  await expect(page.getByLabel('Buscar servicios')).toHaveCount(0);
});

test('CH15 renders the factual empty fees catalog without mutation', async ({ page }) => {
  await login(page, 'admin@demo.local', 'demo-admin', '/catalogs/fees');
  await expect(page).toHaveURL(/\/catalogs\/fees$/);
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await expect(page.getByRole('heading', { name: 'Items / Honorarios' })).toBeVisible();
  for (const header of ['Acciones', 'Código', 'Nombre', 'Impuesto', 'Descuento', 'Estado']) {
    await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  }
  await expect(page.locator('[data-action-id="CATALOG-FEES-EXPORT"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-FEES-CREATE"]')).toBeDisabled();
  await expect(page.getByLabel('Registros de honorarios por página')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-FEES-PAGE-PREV"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="CATALOG-FEES-PAGE-NEXT"]')).toBeDisabled();
  await page.getByLabel('Buscar honorarios').fill('sin-honorario-ch15');
  await expect(page.locator('tbody .empty-state')).toContainText('Sin honorarios documentados');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-honorario-ch15');
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(auditBefore);
});

test('CH15 lets INVENTORY open the fees catalog', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory', '/catalogs/fees');
  await expect(page.getByRole('heading', { name: 'Items / Honorarios' })).toBeVisible();
  await expect(page.getByLabel('Buscar honorarios')).toBeVisible();
});

test('CH15 lets AUDITOR search the fees catalog', async ({ page }) => {
  await login(page, 'auditor@demo.local', 'demo-auditor', '/catalogs/fees');
  await page.getByLabel('Buscar honorarios').fill('sin-honorario-auditor');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-honorario-auditor');
});

test('CH15 denies DOCTOR direct fees catalog access', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor', '/catalogs/fees');
  await expect(page.locator('main[role="alert"]')).toContainText('DOCTOR');
  await expect(page.getByLabel('Buscar honorarios')).toHaveCount(0);
});

test('CH15 denies NURSE direct fees catalog access', async ({ page }) => {
  await login(page, 'nurse@demo.local', 'demo-nurse', '/catalogs/fees');
  await expect(page.locator('main[role="alert"]')).toContainText('NURSE');
  await expect(page.getByLabel('Buscar honorarios')).toHaveCount(0);
});

test('CH15 denies FINANCE direct fees catalog access', async ({ page }) => {
  await login(page, 'finance@demo.local', 'demo-finance', '/catalogs/fees');
  await expect(page.locator('main[role="alert"]')).toContainText('FINANCE');
  await expect(page.getByLabel('Buscar honorarios')).toHaveCount(0);
});

test('CH15 renders the factual empty medication catalog without mutation', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/catalogs\/medications$/);
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await expect(page.getByRole('heading', { name: 'Items / Medicamentos' })).toBeVisible();
  for (const header of [
    'Acciones',
    'Código',
    'Nombre',
    'Impuesto',
    'Descuento',
    'Lotes',
    'Estado',
  ]) {
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
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(auditBefore);
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
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await expect(page.getByRole('heading', { name: 'Items / Insumos' })).toBeVisible();
  for (const header of [
    'Acciones',
    'Código',
    'Nombre',
    'Tipo',
    'Impuesto',
    'Descuento',
    'Lotes',
    'Estado',
  ]) {
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
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(auditBefore);
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

test('CH15 renders the factual empty diagnostic studies catalog without mutation', async ({
  page,
}) => {
  await login(page, 'admin@demo.local', 'demo-admin', '/catalogs/studies');
  await expect(page).toHaveURL(/\/catalogs\/studies$/);
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
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
  await expect(page.locator('tbody .empty-state')).toContainText(
    'Sin estudios diagnósticos documentados',
  );
  await expect(page.locator('tbody .empty-state')).toContainText('sin-estudio-ch15');
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(auditBefore);
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
