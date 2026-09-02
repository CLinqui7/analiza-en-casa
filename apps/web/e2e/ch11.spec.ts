import { expect, test } from '@playwright/test';

// test-id: playwright:ch11-agenda-patient-filter
// test-id: playwright:ch11-calendar-navigation-views
// test-id: playwright:ch11-agenda-patient-context
// test-id: playwright:ch11-agenda-patient-context-save
// test-id: playwright:ch11-synthetic-shift-detail

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
  await expect(page.getByRole('button', { name: 'Crear turno' })).toHaveCount(0);
});

test('CH11 denies INVENTORY direct agenda navigation', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory');
  await expect(page.locator('main[role="alert"]')).toContainText('Acceso restringido para el rol INVENTORY');
  await expect(page.locator('[data-action-id="AGENDA-PATIENT-FILTER"]')).toHaveCount(0);
  await expect(page.locator('[data-action-id="AGENDA-SHIFT-DETAIL-OPEN"]')).toHaveCount(0);
});

test('CH11 lets DOCTOR inspect an existing synthetic shift without changing visit state', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor');
  const storedBefore = await page.evaluate(() => [localStorage.getItem('analiza.en.casa.workspace.v3.shifts'), localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')]);
  await page.locator('[data-action-id="AGENDA-SHIFT-DETAIL-OPEN"]').first().click();
  const dialog = page.getByRole('dialog', { name: 'Detalle del turno sintético' });
  await expect(dialog.getByText('Agenda', { exact: true })).toBeVisible();
  await expect(dialog.locator('[data-action-id="AGENDA-SHIFT-DETAIL-UPDATES"]')).toBeDisabled();
  await expect(dialog.getByText('Inicio', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Fin', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Paciente', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Recurso asignado', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Estado registrado', { exact: true })).toBeVisible();
  await dialog.locator('[data-action-id="AGENDA-SHIFT-DETAIL-CLOSE"]').click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect.poll(() => page.evaluate(() => [localStorage.getItem('analiza.en.casa.workspace.v3.shifts'), localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')])).toEqual(storedBefore);
});

test('CH11 shows factual patient context in the authorized shift form without creating a clinical visit', async ({ page }) => {
  await login(page);
  const storedBefore = await page.evaluate(() => [localStorage.getItem('analiza.en.casa.workspace.v3.shifts'), localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')]);
  await page.getByRole('button', { name: 'Crear turno' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear turno a paciente' });
  await dialog.locator('[data-action-id="AGENDA-SHIFT-PATIENT-SELECT"]').selectOption('patient-demo-001');
  await expect(dialog.getByLabel('Documento del paciente')).toHaveValue('DUI 12345678-9');
  await expect(dialog.getByLabel('Empresa del paciente')).toHaveValue('Sin empresa registrada');
  await expect(dialog.getByRole('button', { name: 'Cerrar', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Guardar' })).toBeVisible();
  await dialog.locator('[data-action-id="AGENDA-SHIFT-CLOSE"]').click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect.poll(() => page.evaluate(() => [localStorage.getItem('analiza.en.casa.workspace.v3.shifts'), localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')])).toEqual(storedBefore);
});

test('CH11 persists only the existing synthetic shift after choosing its factual patient context', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Crear turno' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear turno a paciente' });
  await dialog.locator('[data-action-id="AGENDA-SHIFT-PATIENT-SELECT"]').selectOption('patient-demo-001');
  await expect(dialog.getByLabel('Documento del paciente')).toHaveValue('DUI 12345678-9');
  await expect(dialog.getByLabel('Empresa del paciente')).toHaveValue('Sin empresa registrada');
  await dialog.getByLabel('Notas').fill('CH11 F03 turno sintético vinculado');
  await dialog.locator('[data-action-id="AGENDA-SHIFT-SAVE"]').click();
  await expect(page.getByRole('status')).toContainText('turno persistido');
  await page.reload();
  await expect(page.getByText('CH11 F03 turno sintético vinculado', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('analiza.en.casa.workspace.v3.shifts') ?? '[]').find((shift: { note?: string }) => shift.note === 'CH11 F03 turno sintético vinculado'))).toMatchObject({ patientId: 'patient-demo-001' });
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
