import { expect, test } from '@playwright/test';

// test-id: playwright:ch09-clinical-hospitalization-list
// test-id: playwright:ch09-clinical-hospitalization-permissions
// test-id: playwright:ch09-clinical-hospitalization-column-filters
// test-id: playwright:ch09-clinical-hospitalization-row-menu

async function loginToClinicalHospitalizations(
  page: import('@playwright/test').Page,
  email = 'admin@demo.local',
  password = 'demo-admin',
) {
  await page.goto('/login?next=%2Fclinical%2Fhospitalizations');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/clinical\/hospitalizations$/);
}

test('CH09 presents factual clinical-hospitalization columns while blocking undefined clinical filters', async ({
  page,
}) => {
  await loginToClinicalHospitalizations(page);

  await expect(page.getByRole('columnheader', { name: 'Paciente', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Acciones', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'DUI/NIT', exact: true })).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Hospitalización', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Triage', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Empresa', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Clínico', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Inicio', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Fin', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Duración', exact: true })).toBeVisible();

  await expect(page.getByLabel('Estado clínico')).toBeDisabled();
  await expect(page.getByLabel('Activado por')).toBeDisabled();
  await expect(page.getByLabel('Tipo de servicio')).toBeDisabled();
  await expect(page.getByLabel('Activos')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  await expect(page.locator('thead tr')).toHaveCount(2);
  await expect(page.locator('thead tr').nth(1).locator('th').first()).toBeEmpty();
  await expect(page.getByLabel('Tipo de atención')).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('no se aplican como reglas locales');

  const search = page.getByLabel('Buscar hospitalización o paciente');
  await search.fill('sin-coincidencia-ch09');
  await expect(page.getByText('Sin hospitalizaciones coincidentes', { exact: true })).toBeVisible();
  await search.fill('');
  const patientColumnFilter = page.locator(
    '[data-action-id="CLINICAL-HOSPITALIZATION-PATIENT-COLUMN-FILTER"]',
  );
  await patientColumnFilter.fill('Aurora');
  await expect(page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')).toHaveAttribute(
    'href',
    '/hospitalizations/case-demo-001',
  );
  await patientColumnFilter.fill('sin-coincidencia-columna-ch09');
  await expect(page.getByText('Sin hospitalizaciones coincidentes', { exact: true })).toBeVisible();
  await patientColumnFilter.fill('');

  const documentColumnFilter = page.locator(
    '[data-action-id="CLINICAL-HOSPITALIZATION-DOCUMENT-COLUMN-FILTER"]',
  );
  await documentColumnFilter.fill('12345678-9');
  await expect(page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')).toHaveCount(1);
  await documentColumnFilter.fill('sin-documento-ch09');
  await expect(page.getByText('Sin hospitalizaciones coincidentes', { exact: true })).toBeVisible();
  await documentColumnFilter.fill('');

  const caseColumnFilter = page.locator(
    '[data-action-id="CLINICAL-HOSPITALIZATION-CASE-COLUMN-FILTER"]',
  );
  await caseColumnFilter.fill('CASE-DEMO-001');
  await expect(page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')).toHaveCount(1);
  await caseColumnFilter.fill('sin-caso-ch09');
  await expect(page.getByText('Sin hospitalizaciones coincidentes', { exact: true })).toBeVisible();
  await caseColumnFilter.fill('');

  const triageColumnFilter = page.locator(
    '[data-action-id="CLINICAL-HOSPITALIZATION-TRIAGE-COLUMN-FILTER"]',
  );
  await triageColumnFilter.fill('No documentado');
  await expect(page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')).toHaveCount(1);
  await triageColumnFilter.fill('sin-triage-ch09');
  await expect(page.getByText('Sin hospitalizaciones coincidentes', { exact: true })).toBeVisible();
  await triageColumnFilter.fill('');

  const companyColumnFilter = page.locator(
    '[data-action-id="CLINICAL-HOSPITALIZATION-COMPANY-COLUMN-FILTER"]',
  );
  await companyColumnFilter.fill('No documentada');
  await expect(page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')).toHaveCount(1);
  await companyColumnFilter.fill('sin-empresa-ch09');
  await expect(page.getByText('Sin hospitalizaciones coincidentes', { exact: true })).toBeVisible();
  await companyColumnFilter.fill('');

  const clinicianColumnFilter = page.locator(
    '[data-action-id="CLINICAL-HOSPITALIZATION-CLINICIAN-COLUMN-FILTER"]',
  );
  await clinicianColumnFilter.fill('No documentado');
  await expect(page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')).toHaveCount(1);
  await clinicianColumnFilter.fill('sin-clinico-ch09');
  await expect(page.getByText('Sin hospitalizaciones coincidentes', { exact: true })).toBeVisible();
  await clinicianColumnFilter.fill('');

  const startColumnFilter = page.locator(
    '[data-action-id="CLINICAL-HOSPITALIZATION-START-COLUMN-FILTER"]',
  );
  await startColumnFilter.fill('2026-08-28');
  await expect(page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')).toHaveCount(1);
  await startColumnFilter.fill('sin-inicio-ch09');
  await expect(page.getByText('Sin hospitalizaciones coincidentes', { exact: true })).toBeVisible();
  await startColumnFilter.fill('');

  const endColumnFilter = page.locator(
    '[data-action-id="CLINICAL-HOSPITALIZATION-END-COLUMN-FILTER"]',
  );
  await endColumnFilter.fill('En curso');
  await expect(page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')).toHaveCount(1);
  await endColumnFilter.fill('sin-fin-ch09');
  await expect(page.getByText('Sin hospitalizaciones coincidentes', { exact: true })).toBeVisible();
  await endColumnFilter.fill('');

  const durationColumnFilter = page.locator(
    '[data-action-id="CLINICAL-HOSPITALIZATION-DURATION-COLUMN-FILTER"]',
  );
  await durationColumnFilter.fill('En curso');
  await expect(page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')).toHaveCount(1);
  await durationColumnFilter.fill('sin-duracion-ch09');
  await expect(page.getByText('Sin hospitalizaciones coincidentes', { exact: true })).toBeVisible();
  await durationColumnFilter.fill('');
  await search.fill('case-demo-001');
  await expect(
    page.getByRole('link', { name: 'Ver hospitalización', exact: true }),
  ).toHaveAttribute('href', '/hospitalizations/case-demo-001');
});

test('CH09 DOCTOR can open the factual clinical list and its authorized hospitalization detail', async ({
  page,
}) => {
  await loginToClinicalHospitalizations(page, 'doctor@demo.local', 'demo-doctor');

  await expect(page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')).toBeVisible();
  await page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]').click();
  await expect(page).toHaveURL(/\/hospitalizations\/case-demo-001$/);
  await expect(page.getByRole('heading', { name: 'case-demo-001' })).toBeVisible();
});

test('CH09 row menu opens the scoped quote and blocks undefined clinical workflows', async ({
  page,
}) => {
  await loginToClinicalHospitalizations(page);

  const menuToggle = page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-ACTIONS-MENU"]');
  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
  const quoteLink = page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-QUOTE-VIEW"]');
  await expect(quoteLink).toHaveAttribute('href', '/quotes/quote-demo-001');
  await expect(
    page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-PROFILE-OPEN"]'),
  ).toBeDisabled();
  await expect(
    page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-RELIEF-DOCUMENT-OPEN"]'),
  ).toBeDisabled();
  await expect(
    page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-READMISSION-OPEN"]'),
  ).toBeDisabled();
  await expect(
    page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-REINFECTION-OPEN"]'),
  ).toBeDisabled();
  await expect(
    page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-ULCERATION-OPEN"]'),
  ).toBeDisabled();
  await expect(
    page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-NEAR-MISS-OPEN"]'),
  ).toBeDisabled();
  await expect(page.getByText(/CH09-Q006/)).toBeVisible();

  await quoteLink.click();
  await expect(page).toHaveURL(/\/quotes\/quote-demo-001$/);
  await expect(page.getByRole('heading', { name: 'quote-demo-001' })).toBeVisible();
});

test('CH09 NURSE can read the factual list but cannot expose a quote navigation', async ({
  page,
}) => {
  await loginToClinicalHospitalizations(page, 'nurse@demo.local', 'demo-nurse');

  const menuToggle = page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-ACTIONS-MENU"]');
  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-QUOTE-VIEW"]')).toHaveCount(
    0,
  );
  await expect(
    page.locator('[data-action-id="CLINICAL-HOSPITALIZATION-PROFILE-OPEN"]'),
  ).toBeDisabled();
});

test('CH09 INVENTORY is denied the clinical hospitalizations direct route', async ({ page }) => {
  await page.goto('/login?next=%2Fclinical%2Fhospitalizations');
  await page.getByLabel('Usuario o correo').fill('inventory@demo.local');
  await page.getByLabel('Clave').fill('demo-inventory');
  await page.locator('[data-action-id="AUTH-LOGIN"]').click();

  await expect(page).toHaveURL(/\/clinical\/hospitalizations$/);
  await expect(page.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol INVENTORY',
  );
  await expect(page.locator('[data-action-id^="CLINICAL-HOSPITALIZATION-"]')).toHaveCount(0);
});
