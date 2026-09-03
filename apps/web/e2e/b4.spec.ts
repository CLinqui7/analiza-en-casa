import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function createDoctorFixture(page: import('@playwright/test').Page) {
  await page.goto('/doctors');
  await page.getByRole('button', { name: 'Nuevo médico' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo médico' });
  await dialog.getByLabel('Nombre completo').fill('Médica B4 Honorarios');
  await dialog.getByLabel('JVPM').fill('JVPM-B4-FEE');
  await dialog.getByLabel('DUI').fill('DUI-B4-FEE');
  await dialog.getByLabel('Especialidad o profesión').fill('Nutri');
  await dialog.getByRole('option', { name: 'Nutricionista' }).click();
  await dialog.getByLabel('Dirección').fill('Dirección sintética B4');
  await dialog.getByRole('button', { name: 'Guardar médico' }).click();
  await expect(page.getByRole('status')).toContainText('Médica B4 Honorarios registrado');
}

// test-id: playwright:cr013-doctor-fee
test('a manual doctor fee keeps its selected doctor after save and reload', async ({ page }) => {
  await login(page);
  await createDoctorFixture(page);
  await page.goto('/quotes');
  await page.getByRole('button', { name: '+ Nuevo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva cotización' });
  await dialog.locator('[data-action-id="QUOTE-PATIENT-SELECT"]').selectOption('patient-demo-001');
  await dialog.getByLabel('Referido por').fill('Amigos');
  await dialog.getByRole('option', { name: 'Amigos & Familia' }).click();
  await dialog.getByLabel('Resumen operativo').fill('Honorario médico B4');
  await dialog.getByRole('tab', { name: 'Honorarios' }).click();
  const doctor = dialog.locator('[data-action-id="QUOTE-FEE-DOCTOR-SELECT"]');
  await doctor.selectOption({ index: 1 });
  const doctorName = await doctor.locator('option:checked').textContent();
  await dialog.getByLabel('Concepto').fill('Honorario B4');
  await dialog.getByLabel('Cantidad').fill('1');
  await dialog.getByLabel('Honorario médico (manual)').fill('55');
  await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  await expect(dialog.getByText(`Médico: ${doctorName}`)).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador de cotización persistido.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/quotes$/);
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await expect(page.getByText('Honorario B4')).toBeVisible();
  await expect(page.getByText(`Médico: ${doctorName}`)).toBeVisible();
  await expect(
    page
      .getByRole('row', { name: /Honorario B4/ })
      .getByRole('cell')
      .nth(2),
  ).toHaveText('USD 55.00');
});

// test-id: playwright:cr016-patient-coverage-counts
test('dashboard shows separate private and insured patient counts', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard');
  await expect(page.getByText('Pacientes particulares')).toBeVisible();
  await expect(page.getByText('Pacientes asegurados')).toBeVisible();
  const privateCount = Number(await page.getByTestId('dashboard-private-patients').textContent());
  const insuredCount = Number(await page.getByTestId('dashboard-insured-patients').textContent());
  expect(Number.isInteger(privateCount) && privateCount >= 0).toBe(true);
  expect(Number.isInteger(insuredCount) && insuredCount >= 0).toBe(true);
  expect(privateCount + insuredCount).toBeGreaterThan(0);
});
