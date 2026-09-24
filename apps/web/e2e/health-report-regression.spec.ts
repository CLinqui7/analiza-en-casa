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
  await page.getByRole('button', { name: /Paciente Demo Aurora/ }).click();

  const openCase = page.getByRole('link', { name: 'Abrir caso' });
  await expect(openCase).toHaveAttribute('href', '/hospitalizations/case-demo-001');

  await page.getByRole('tab', { name: /Signos vitales/ }).click();
  await expect(page.getByRole('heading', { name: 'Evaluación clínica' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '118/76' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Registro sintético de QA.' })).toBeVisible();

  await page.getByRole('tab', { name: /Notas de enfermería/ }).click();
  await expect(page.getByRole('heading', { name: 'Notas de enfermería' })).toBeVisible();
  await expect(page.getByText('Sin notas de enfermería')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir evoluciones' })).toHaveAttribute(
    'href',
    '/clinical/evolutions?case=case-demo-001',
  );
});

test('hospitalization detail opens the selected vital and nursing sections', async ({ page }) => {
  await login(page);
  await page.goto('/hospitalizations/case-demo-001');

  await page.locator('[data-action-id="HOSPITALIZATION-VITALS-OPEN"]').click();
  await expect(page).toHaveURL(/\/clinical\/reports\?case=case-demo-001&section=clinical$/);
  await expect(page.getByRole('tab', { name: /Signos vitales/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.goto('/hospitalizations/case-demo-001');
  await page.locator('[data-action-id="HOSPITALIZATION-NURSING-NOTES-OPEN"]').click();
  await expect(page).toHaveURL(/\/clinical\/reports\?case=case-demo-001&section=nursing$/);
  await expect(page.getByRole('tab', { name: /Notas de enfermería/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
