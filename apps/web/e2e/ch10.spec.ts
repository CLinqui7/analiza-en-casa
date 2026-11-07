import { expect, test, type Page } from '@playwright/test';
// Client-approved replacement: analizaencasa31oct_.pdf pp. 1–2.
// test-id: playwright:ch10-medical-order-list
// test-id: playwright:ch10-medical-order-menu-and-guards
async function login(page: Page, role = 'admin') {
  await page.goto('/login?next=%2Fclinical%2Forders');
  await page.getByLabel('Usuario o correo').fill(role + '@demo.local');
  await page.getByLabel('Clave').fill('demo-' + role);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}
test('CH10 all-patient order list supports name and document search', async ({ page }) => {
  await login(page);
  const search = page.getByRole('searchbox', { name: 'Buscar por nombre o DUI' });
  await expect(page.getByText('Paciente Demo Aurora', { exact: true })).toBeVisible();
  await expect(page.getByText('Paciente Demo Brisa', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Inactivos', exact: true })).toHaveCount(0);
  await search.fill('Aurora');
  await expect(page.locator('.clinical-patient-list > div')).toHaveCount(1);
  await search.fill('sin-coincidencia-ch10');
  await expect(page.getByText('No hay pacientes para mostrar')).toBeVisible();
  await search.fill('');
  await expect(page.getByText('Paciente Demo Gloria', { exact: true })).toBeVisible();
});
for (const role of ['admin', 'doctor', 'nurse'])
  test(
    'CH10 ' + role + ' opens a manual indication without inventing clinical values',
    async ({ page }) => {
      await login(page, role);
      await page
        .locator('.clinical-patient-list')
        .getByRole('button', { name: 'Indicación médica' })
        .first()
        .click();
      const dialog = page.getByRole('dialog', { name: 'Indicación médica' });
      await expect(dialog.getByLabel('Resumen', { exact: true })).toHaveValue('');
      await expect(dialog.getByRole('button', { name: 'Guardar', exact: true })).toBeEnabled();
      await expect(dialog.getByRole('combobox', { name: 'Paciente', exact: true })).toHaveValue(
        'patient-demo-001',
      );
      await dialog.getByRole('button', { name: 'Cancelar' }).click();
      await expect(page.locator('.clinical-record-block')).toHaveCount(0);
    },
  );
test('CH10 AUDITOR reads without clinical write controls', async ({ page }) => {
  await login(page, 'auditor');
  await expect(page.locator('.clinical-patient-list').getByRole('button')).toHaveCount(0);
  await expect(
    page.locator('.clinical-patient-list').getByRole('link', { name: 'Ver expediente' }).first(),
  ).toBeVisible();
});
for (const role of ['inventory', 'finance'])
  test('CH10 denies the clinical route to ' + role, async ({ page }) => {
    await login(page, role);
    await expect(page.locator('main[role="alert"]')).toContainText(role.toUpperCase());
  });
