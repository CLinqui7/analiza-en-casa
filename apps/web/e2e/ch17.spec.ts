import { expect, test, type Page } from '@playwright/test';
async function login(page: Page, role = 'admin') {
  await page.goto('/login?next=%2Fclinical%2Freports');
  await page.getByLabel('Usuario o correo').fill(role + '@demo.local');
  await page.getByLabel('Clave').fill('demo-' + role);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}
// Five sections supersede seven historical tabs: client PDF p1.
// test-id: playwright:ch17-health-report-empty-surface
test('CH17 record retains patient data without mutation on read', async ({ page }) => {
  await login(page);
  const before = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await expect(
    page.getByRole('heading', { name: 'Expediente clínico', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Paciente', exact: true })
    .selectOption('patient-demo-001');
  await page
    .getByRole('combobox', { name: 'Hospitalización', exact: true })
    .selectOption('case-demo-001');
  await expect(page.getByRole('link', { name: 'Abrir caso', exact: true })).toHaveAttribute(
    'href',
    '/hospitalizations/case-demo-001',
  );
  await expect(page.locator('#patient-record-print')).toContainText('Paciente Demo Aurora');
  expect(
    await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
  ).toBe(before);
});
// test-id: playwright:ch17-health-report-actions-menu
test('CH17 preserves original signed document correction workflow links', async ({ page }) => {
  await login(page);
  await page.goto('/clinical/reports?case=case-demo-001&section=nursing');
  await expect(
    page.getByRole('link', { name: 'Firmas y correcciones de documentos anteriores' }),
  ).toHaveAttribute('href', '/clinical/document-versions');
  await expect(page.getByRole('link', { name: 'Registrar atención' })).toHaveAttribute(
    'href',
    '/clinical/orders',
  );
});
// test-id: playwright:ch17-health-report-empty-sections
test('CH17 five sections and legacy vital readings remain available', async ({ page }) => {
  await login(page);
  await page.goto('/clinical/reports?case=case-demo-001');
  const nav = page.getByRole('navigation', { name: 'Secciones del expediente' });
  await expect(nav.getByRole('button')).toHaveCount(5);
  for (const label of [
    'Resumen',
    'Acciones médicas',
    'Acciones de enfermería',
    'Visitas',
    'Expediente completo',
  ]) {
    await nav.getByRole('button', { name: new RegExp(label) }).click();
    await expect(nav.getByRole('button', { name: new RegExp(label) })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('#patient-record-print')).toContainText(label);
  }
  // This historical reading has no case ID: do not attribute it to a hospitalization.
  await expect(page.locator('#patient-record-print')).not.toContainText('118/76');
  await page.getByRole('combobox', { name: 'Hospitalización', exact: true }).selectOption('');
  await expect(page.locator('#patient-record-print')).toContainText('118/76');
  await expect(
    page.getByRole('button', { name: 'Imprimir expediente completo', exact: true }),
  ).toBeVisible();
});
test('CH17 historical deep links open regrouped clinical data', async ({ page }) => {
  await login(page, 'doctor');
  for (const section of ['clinical', 'nursing']) {
    await page.goto('/clinical/reports?case=case-demo-001&section=' + section);
    await expect(
      page
        .getByRole('navigation', { name: 'Secciones del expediente' })
        .getByRole('button', { name: /Acciones de enfermería/ }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#patient-record-print')).not.toContainText('118/76');
    await page.getByRole('combobox', { name: 'Hospitalización', exact: true }).selectOption('');
    await expect(page.locator('#patient-record-print')).toContainText('118/76');
  }
});
for (const role of ['inventory', 'finance'])
  test('CH17 denies the clinical report to ' + role, async ({ page }) => {
    await login(page, role);
    await expect(page.locator('main[role="alert"]')).toContainText(role.toUpperCase());
    await expect(page.locator('#patient-record-print')).toHaveCount(0);
  });
