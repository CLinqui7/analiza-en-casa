import { expect, test } from '@playwright/test';

// test-id: playwright:ch11-agenda-patient-filter

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
  await expect(page.getByRole('button', { name: 'Nuevo turno' })).toHaveCount(0);
});

test('CH11 denies INVENTORY direct agenda navigation', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory');
  await expect(page.locator('main[role="alert"]')).toContainText('Acceso restringido para el rol INVENTORY');
  await expect(page.locator('[data-action-id="AGENDA-PATIENT-FILTER"]')).toHaveCount(0);
});
