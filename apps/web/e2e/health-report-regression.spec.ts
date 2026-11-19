import { expect, test } from '@playwright/test';

// test-id: playwright:health-report-regression

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login?next=%2Fclinical%2Freports');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/clinical\/reports$/);
}

test('health report links to the real hospitalization route and exposes clinical views', async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole('combobox', { name: 'Paciente', exact: true })
    .selectOption('patient-demo-001');
  await page
    .getByRole('combobox', { name: 'Hospitalización', exact: true })
    .selectOption('case-demo-001');
  await expect(page.getByRole('link', { name: 'Abrir caso' })).toHaveAttribute(
    'href',
    '/hospitalizations/case-demo-001',
  );
  await page
    .getByRole('navigation', { name: 'Secciones del expediente' })
    .getByRole('button', { name: /Acciones de enfermería/ })
    .click();
  await page.getByRole('button', { name: 'Signos vitales', exact: true }).click();
  await expect(page.locator('#patient-record-print')).not.toContainText('118/76');
  await page.getByRole('combobox', { name: 'Hospitalización', exact: true }).selectOption('');
  await expect(page.locator('#patient-record-print')).toContainText('118/76');
  await expect(page.locator('#patient-record-print')).toContainText('Registro sintético de QA.');
  await page.getByRole('button', { name: 'Notas de enfermería', exact: true }).click();
  await expect(page.locator('#patient-record-print')).not.toContainText('118/76');
  await expect(
    page.getByRole('link', { name: 'Firmas y correcciones de documentos anteriores' }),
  ).toHaveAttribute('href', '/clinical/document-versions');
});

test('hospitalization detail opens the selected vital and nursing sections', async ({ page }) => {
  await login(page);
  await page.goto('/hospitalizations/case-demo-001');

  await page.locator('[data-action-id="HOSPITALIZATION-VITALS-OPEN"]').click();
  await expect(page).toHaveURL(/\/clinical\/reports\?case=case-demo-001&section=clinical$/);
  await expect(
    page
      .getByRole('navigation', { name: 'Secciones del expediente' })
      .getByRole('button', { name: /Acciones de enfermería/ }),
  ).toHaveAttribute('aria-current', 'page');

  await page.goto('/hospitalizations/case-demo-001');
  await page.locator('[data-action-id="HOSPITALIZATION-NURSING-NOTES-OPEN"]').click();
  await expect(page).toHaveURL(/\/clinical\/reports\?case=case-demo-001&section=nursing$/);
  await expect(
    page
      .getByRole('navigation', { name: 'Secciones del expediente' })
      .getByRole('button', { name: /Acciones de enfermería/ }),
  ).toHaveAttribute('aria-current', 'page');
});
