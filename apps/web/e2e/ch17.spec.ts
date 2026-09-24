import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login?next=%2Fclinical%2Freports');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

// test-id: playwright:ch17-health-report-empty-surface
test('CH17 renders factual report data without mutating clinical records', async ({ page }) => {
  await login(page, 'admin@demo.local', 'demo-admin');
  await expect(page).toHaveURL(/\/clinical\/reports$/);
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );

  await expect(page.getByRole('heading', { name: 'Reporte de salud' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Paciente Demo Aurora/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir caso' })).toHaveAttribute(
    'href',
    '/hospitalizations/case-demo-001',
  );
  await expect(page.getByRole('tab', { name: /Signos vitales/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Notas de enfermería/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Reporte de salud' })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
  ).toBe(auditBefore);
});

test('CH17 denies INVENTORY direct access to the clinical report route', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory');
  await expect(page.locator('main[role="alert"]')).toContainText('INVENTORY');
  await expect(page.locator('[data-action-id^="HEALTH-REPORT-"]')).toHaveCount(0);
});

// test-id: playwright:ch17-health-report-actions-menu
test('CH17 exposes only safe navigation for the selected hospitalization', async ({ page }) => {
  await login(page, 'admin@demo.local', 'demo-admin');
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );

  await page.getByRole('button', { name: /Paciente Demo Aurora/ }).click();
  await page.getByLabel('Más acciones').click();
  await expect(page.getByRole('link', { name: 'Historia clínica' })).toHaveAttribute(
    'href',
    '/hospitalizations/case-demo-001',
  );
  await expect(page.getByRole('link', { name: 'Visitas', exact: true })).toHaveAttribute(
    'href',
    '/clinical/visits',
  );
  await expect(
    page.locator('.health-case-actions details').getByRole('link', { name: 'Evoluciones' }),
  ).toHaveAttribute('href', '/clinical/evolutions');

  await page.reload();
  expect(
    await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
  ).toBe(auditBefore);
});

test('CH17 permits DOCTOR to read a report but denies FINANCE the direct clinical route', async ({
  browser,
}) => {
  const doctor = await browser.newPage();
  await login(doctor, 'doctor@demo.local', 'demo-doctor');
  await expect(doctor.getByRole('heading', { name: 'Reporte de salud' })).toBeVisible();
  await expect(doctor.getByRole('link', { name: 'Abrir caso' })).toHaveAttribute(
    'href',
    '/hospitalizations/case-demo-001',
  );
  await doctor.close();

  const finance = await browser.newPage();
  await login(finance, 'finance@demo.local', 'demo-finance');
  await expect(finance.locator('main[role="alert"]')).toContainText('FINANCE');
  await expect(finance.locator('[data-action-id^="HEALTH-REPORT-"]')).toHaveCount(0);
  await finance.close();
});

// test-id: playwright:ch17-health-report-empty-sections
test('CH17 switches the seven report sections and exposes vital and nursing history safely', async ({
  page,
}) => {
  await login(page, 'admin@demo.local', 'demo-admin');
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  const panel = page.locator('#health-report-active-section[role="tabpanel"]');

  await expect(panel).toHaveCount(1);
  for (const actionId of [
    'INFORMATION',
    'CLINICAL',
    'MEDICAL',
    'TREATMENTS',
    'NURSING',
    'EVENTS',
    'EVIDENCE',
  ]) {
    await expect(
      page.locator(`[data-action-id="HEALTH-REPORT-SECTION-${actionId}"]`),
    ).toHaveAttribute('aria-controls', 'health-report-active-section');
  }

  const clinical = page.locator('[data-action-id="HEALTH-REPORT-SECTION-CLINICAL"]');
  await clinical.click();
  await expect(clinical).toHaveAttribute('aria-selected', 'true');
  await expect(panel).toContainText('Evaluación clínica');
  await expect(page.getByRole('cell', { name: '118/76' })).toBeVisible();

  const nursing = page.locator('[data-action-id="HEALTH-REPORT-SECTION-NURSING"]');
  await nursing.click();
  await expect(nursing).toHaveAttribute('aria-selected', 'true');
  await expect(panel).toContainText('Notas de enfermería');
  await expect(page.getByRole('link', { name: 'Abrir evoluciones' })).toHaveAttribute(
    'href',
    '/clinical/evolutions?case=case-demo-001',
  );

  expect(
    await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
  ).toBe(auditBefore);
});

test('CH17 deep links select vital and nursing sections for authorized clinical roles', async ({
  browser,
}) => {
  const doctor = await browser.newPage();
  await login(doctor, 'doctor@demo.local', 'demo-doctor');
  await doctor.goto('/clinical/reports?case=case-demo-001&section=clinical');
  await expect(doctor.getByRole('tab', { name: /Signos vitales/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(doctor.getByRole('tabpanel')).toContainText('Evaluación clínica');
  await doctor.goto('/clinical/reports?case=case-demo-001&section=nursing');
  await expect(doctor.getByRole('tab', { name: /Notas de enfermería/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await doctor.close();

  const finance = await browser.newPage();
  await login(finance, 'finance@demo.local', 'demo-finance');
  await expect(finance.locator('main[role="alert"]')).toContainText('FINANCE');
  await finance.close();
});
