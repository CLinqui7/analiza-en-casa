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
  await dialog.getByLabel('Relación del médico').selectOption('NEW');
  await dialog.getByLabel('Especialidad o profesión').fill('Nutri');
  await dialog.getByRole('option', { name: 'Nutricionista' }).click();
  await dialog.getByLabel('Dirección').fill('Dirección sintética B4');
  await dialog.getByLabel('Teléfono fijo (obligatorio)').fill('2222-0400');
  await dialog.getByRole('button', { name: 'Guardar médico' }).click();
  await expect(page.getByRole('status')).toContainText('Médica B4 Honorarios registrado');
}

// test-id: playwright:cr013-doctor-fee
test('a cataloged doctor fee keeps its selected doctor after save and reload', async ({ page }) => {
  await login(page);
  await createDoctorFixture(page);
  await page.goto('/quotes');
  await expect(page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').first()).toBeVisible();
  const existingQuoteLinks = await page
    .locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  await page.getByRole('button', { name: '+ Nuevo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva cotización' });
  await dialog.locator('[data-action-id="QUOTE-PATIENT-SELECT"]').selectOption('patient-demo-001');
  const doctor = dialog.locator('[data-action-id="QUOTE-PRIMARY-DOCTOR"]');
  await doctor.selectOption({ label: 'Médica B4 Honorarios' });
  const doctorName = await doctor.locator('option:checked').textContent();
  await dialog.getByRole('tab', { name: 'Honorarios' }).click();
  await dialog.getByLabel('Servicio de honorario').selectOption({ label: 'Visita' });
  await dialog.getByLabel('Cantidad').fill('1');
  await dialog.locator('[data-action-id="QUOTE-FEE-AMOUNT"]').selectOption('55');
  await expect(dialog.locator('[data-action-id="QUOTE-FEE-AMOUNT"]')).toHaveValue('55');
  await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  await expect(dialog.getByText(`Médico: ${doctorName}`)).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador de cotización persistido.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/quotes$/);
  await expect(dialog).toHaveCount(0);
  const createdQuoteHref = await page
    .locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]')
    .evaluateAll(
      (links, existing) =>
        links.map((link) => link.getAttribute('href')).find((href) => !existing.includes(href)),
      existingQuoteLinks,
    );
  expect(createdQuoteHref).toBeTruthy();
  await page.reload();
  await page
    .locator(`[data-action-id="QUOTE-DETAIL-NAVIGATE"][href="${createdQuoteHref}"]`)
    .click();
  await expect(page.getByText('Visita', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`Médico: ${doctorName}`)).toBeVisible();
  await expect(
    page
      .getByRole('row', { name: /Visita/ })
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
