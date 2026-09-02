import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login?next=%2Fclinical%2Freports');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

// test-id: playwright:ch17-health-report-empty-surface
test('CH17 keeps the visible report anatomy empty until its sensitive-data boundary is approved', async ({ page }) => {
  await login(page, 'admin@demo.local', 'demo-admin');
  await expect(page).toHaveURL(/\/clinical\/reports$/);
  const auditBefore = await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'));

  await expect(page.getByRole('heading', { name: 'Reporte de salud' })).toBeVisible();
  for (const column of ['Acciones', 'Cédula', 'Nombre', 'Empresa', 'Hospitalización', 'Período', 'Auditoría', 'Triage', 'Estatus']) {
    await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
  }
  await expect(page.getByText('Sin registros autorizados para mostrar')).toBeVisible();
  await expect(page.locator('[data-action-id="HEALTH-REPORT-SEARCH"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="HEALTH-REPORT-PAGE-PREV"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="HEALTH-REPORT-PAGE-NEXT"]')).toBeDisabled();
  await expect(page.getByText('CH16-Q008')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Sin registros autorizados para mostrar')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'))).toBe(auditBefore);
});

test('CH17 denies INVENTORY direct access to the clinical report route', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory');
  await expect(page.locator('main[role="alert"]')).toContainText('INVENTORY');
  await expect(page.locator('[data-action-id="HEALTH-REPORT-SEARCH"]')).toHaveCount(0);
});
