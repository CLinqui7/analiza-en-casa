import { expect, test } from '@playwright/test';

// test-id: playwright:ch11-agenda-patient-filter
// test-id: playwright:ch11-calendar-navigation-views

async function login(page: import('@playwright/test').Page, email = 'admin@demo.local', password = 'demo-admin') {
  await page.goto('/login?next=%2Fagenda');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/agenda$/);
}

test('CH11 filters the factual agenda and colored calendar by selected patient', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Agenda por paciente' })).toBeVisible();
  await page.getByLabel('Buscar paciente').fill('Aurora');
  await page.locator('[data-action-id="AGENDA-PATIENT-FILTER"]').selectOption('patient-demo-001');
  await expect(page.getByRole('status')).toContainText('Paciente Demo Aurora');
  await expect(page.getByLabel('Calendario de agosto de 2026')).toContainText('Paciente Demo Aurora');
  await expect(page.getByLabel('Calendario de agosto de 2026')).not.toContainText('Paciente Demo Brisa');
  await page.locator('[data-action-id="AGENDA-PATIENT-FILTER"]').selectOption('');
  await expect(page.getByLabel('Calendario de agosto de 2026')).toContainText('Paciente Demo Brisa');
});

test('CH11 permits DOCTOR to use the factual agenda filter', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor');
  await page.locator('[data-action-id="AGENDA-PATIENT-FILTER"]').selectOption('patient-demo-002');
  await expect(page.getByLabel('Calendario de agosto de 2026')).toContainText('Paciente Demo Brisa');
  await page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-WEEK"]').click();
  await expect(page.locator('.agenda-period-label')).toContainText('Semana del');
  await expect(page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-WEEK"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Nuevo turno' })).toHaveCount(0);
});

test('CH11 denies INVENTORY direct agenda navigation', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory');
  await expect(page.locator('main[role="alert"]')).toContainText('Acceso restringido para el rol INVENTORY');
  await expect(page.locator('[data-action-id="AGENDA-PATIENT-FILTER"]')).toHaveCount(0);
});

test('CH11 navigates and changes read-only calendar views without mutating shifts', async ({ page }) => {
  await login(page);
  const storedBefore = await page.evaluate(() => [localStorage.getItem('analiza.en.casa.workspace.v3.shifts'), localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')]);
  await expect(page.locator('.agenda-period-label')).toContainText('agosto de 2026');
  await page.locator('[data-action-id="AGENDA-CALENDAR-PREV"]').click();
  await expect(page.locator('.agenda-period-label')).toContainText('julio de 2026');
  await page.locator('[data-action-id="AGENDA-CALENDAR-NEXT"]').click();
  await expect(page.locator('.agenda-period-label')).toContainText('agosto de 2026');
  await page.locator('[data-action-id="AGENDA-CALENDAR-TODAY"]').click();
  await expect(page.locator('.agenda-period-label')).toContainText('agosto de 2026');
  await page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-WEEK"]').click();
  await expect(page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-WEEK"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[aria-label^="Calendario de Semana del"]')).toBeVisible();
  await page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-MONTH"]').click();
  await expect(page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-MONTH"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-LIST-WEEK"]').click();
  await expect(page.getByRole('heading', { name: /Lista por semana/ })).toBeVisible();
  await page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-LIST-DAY"]').click();
  await expect(page.getByRole('heading', { name: /Lista por día/ })).toBeVisible();
  await expect(page.locator('[data-action-id="AGENDA-VISITS-DELETE"]')).toBeDisabled();
  await page.reload();
  await expect.poll(() => page.evaluate(() => [localStorage.getItem('analiza.en.casa.workspace.v3.shifts'), localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')])).toEqual(storedBefore);
});
