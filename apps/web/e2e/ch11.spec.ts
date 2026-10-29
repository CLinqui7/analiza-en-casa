import { expect, test } from '@playwright/test';

// test-id: playwright:ch11-agenda-patient-filter
// test-id: playwright:ch11-calendar-navigation-views
// test-id: playwright:ch11-agenda-patient-context
// test-id: playwright:ch11-agenda-patient-context-save
// test-id: playwright:ch11-synthetic-shift-detail
// test-id: playwright:ch11-observed-classification-type-labels

async function login(
  page: import('@playwright/test').Page,
  email = 'admin@demo.local',
  password = 'demo-admin',
) {
  await page.goto('/login?next=%2Fagenda');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/agenda$/);
}
async function showAugustFixture(page: import('@playwright/test').Page) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (await page.getByLabel('Calendario de agosto de 2026').count()) return;
    await page.locator('[data-action-id="AGENDA-CALENDAR-PREV"]').click();
  }
  throw new Error('No se pudo navegar al mes de los turnos sintéticos.');
}
async function openAttention(page: import('@playwright/test').Page) {
  await page.evaluate(() =>
    localStorage.setItem(
      'analiza.en.casa.workspace.v3.nursingResources',
      JSON.stringify([
        {
          id: 'nurse-demo-001',
          userId: 'nurse-user-qa',
          displayName: 'Enfermería Demo Norte',
          territory: 'Zona demo norte',
          shift: 'MORNING',
          availability: 'AVAILABLE',
          capacity: 3,
          boardRegistrationNumber: 'REG-DEMO-001',
        },
      ]),
    ),
  );
  await page.goto('/clinical/hospitalizations');
  await page.getByRole('button', { name: 'Atención' }).first().click();
  return page.getByRole('dialog', { name: /Atención clínica/ });
}

test('CH11 filters the factual agenda and colored calendar by selected patient', async ({
  page,
}) => {
  await login(page);
  await showAugustFixture(page);
  await expect(page.getByRole('heading', { name: 'Agenda por paciente' })).toBeVisible();
  await page.getByLabel('Buscar paciente').fill('Aurora');
  await page.locator('[data-action-id="AGENDA-PATIENT-FILTER"]').selectOption('patient-demo-001');
  await expect(page.getByRole('status')).toContainText('Paciente Demo Aurora');
  await expect(page.getByLabel('Calendario de agosto de 2026')).toContainText(
    'Paciente Demo Aurora',
  );
  await expect(page.getByLabel('Calendario de agosto de 2026')).not.toContainText(
    'Paciente Demo Brisa',
  );
  await page.locator('[data-action-id="AGENDA-PATIENT-FILTER"]').selectOption('');
  await expect(page.getByLabel('Calendario de agosto de 2026')).toContainText(
    'Paciente Demo Brisa',
  );
});

test('CH11 permits DOCTOR to use the factual agenda filter', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor');
  await showAugustFixture(page);
  await page.locator('[data-action-id="AGENDA-PATIENT-FILTER"]').selectOption('patient-demo-002');
  await expect(page.getByLabel('Calendario de agosto de 2026')).toContainText(
    'Paciente Demo Brisa',
  );
  await page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-WEEK"]').click();
  await expect(page.locator('.agenda-period-label')).toContainText('Semana del');
  await expect(page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-WEEK"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Crear turno' })).toHaveCount(0);
});

test('CH11 denies INVENTORY direct agenda navigation', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory');
  await expect(page.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol INVENTORY',
  );
  await expect(page.locator('[data-action-id="AGENDA-PATIENT-FILTER"]')).toHaveCount(0);
  await expect(page.locator('[data-action-id="AGENDA-SHIFT-DETAIL-OPEN"]')).toHaveCount(0);
});

test('CH11 lets DOCTOR inspect an existing synthetic shift without changing visit state', async ({
  page,
}) => {
  await login(page, 'doctor@demo.local', 'demo-doctor');
  await showAugustFixture(page);
  const storedBefore = await page.evaluate(() => [
    localStorage.getItem('analiza.en.casa.workspace.v3.shifts'),
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  ]);
  await page.locator('[data-action-id="AGENDA-SHIFT-DETAIL-OPEN"]').first().click();
  const dialog = page.getByRole('dialog', { name: 'Detalle del turno' });
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
  await expect
    .poll(() =>
      page.evaluate(() => [
        localStorage.getItem('analiza.en.casa.workspace.v3.shifts'),
        localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
      ]),
    )
    .toEqual(storedBefore);
});

test('CH11 opens the authorized clinical attention form without creating a visit', async ({
  page,
}) => {
  await login(page);
  const storedBefore = await page.evaluate(() => [
    localStorage.getItem('analiza.en.casa.workspace.v3.shifts'),
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  ]);
  const dialog = await openAttention(page);
  await expect(dialog.getByLabel('Paciente ya cuenta con:')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Guardar atención' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => [
        localStorage.getItem('analiza.en.casa.workspace.v3.shifts'),
        localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
      ]),
    )
    .toEqual(storedBefore);
});

test('CH11 persists an assigned shift from the clinical case', async ({ page }) => {
  await login(page);
  const dialog = await openAttention(page);
  await dialog.locator('[data-action-id="CLINICAL-SCHEDULE-NURSE"]').selectOption('nurse-demo-001');
  await dialog.locator('[data-action-id="CLINICAL-SCHEDULE-DATE"]').fill('2026-11-03');
  await dialog.getByLabel('Notas del turno').fill('CH11 F03 turno sintético vinculado');
  await dialog.getByRole('button', { name: 'Guardar atención' }).click();
  await page.goto('/agenda');
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem('analiza.en.casa.workspace.v3.shifts') ?? '[]').find(
          (shift: { note?: string }) => shift.note === 'CH11 F03 turno sintético vinculado',
        ),
      ),
    )
    .toMatchObject({ patientId: 'patient-demo-001' });
});

test('CH11 keeps Puntual disabled in clinical scheduling without a visit mutation', async ({
  page,
}) => {
  await login(page);
  const storedBefore = await page.evaluate(() => [
    localStorage.getItem('analiza.en.casa.workspace.v3.shifts'),
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  ]);
  const dialog = await openAttention(page);
  await dialog.locator('[data-action-id="CLINICAL-SCHEDULE-NURSE"]').selectOption('nurse-demo-001');
  await expect(
    dialog.getByRole('button', { name: 'Puntual (pendiente de definición)' }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => [
        localStorage.getItem('analiza.en.casa.workspace.v3.shifts'),
        localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
      ]),
    )
    .toEqual(storedBefore);
});

test('CH11 navigates and changes read-only calendar views without mutating shifts', async ({
  page,
}) => {
  await login(page);
  const storedBefore = await page.evaluate(() => [
    localStorage.getItem('analiza.en.casa.workspace.v3.shifts'),
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  ]);
  const currentMonth = new RegExp(await page.locator('.agenda-period-label').innerText(), 'i');
  await page.locator('[data-action-id="AGENDA-CALENDAR-PREV"]').click();
  await expect(page.locator('.agenda-period-label')).not.toHaveText(currentMonth);
  await page.locator('[data-action-id="AGENDA-CALENDAR-NEXT"]').click();
  await expect(page.locator('.agenda-period-label')).toHaveText(currentMonth);
  await page.locator('[data-action-id="AGENDA-CALENDAR-TODAY"]').click();
  await expect(page.locator('.agenda-period-label')).toHaveText(currentMonth);
  await page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-WEEK"]').click();
  await expect(page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-WEEK"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[aria-label^="Calendario de Semana del"]')).toBeVisible();
  await page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-MONTH"]').click();
  await expect(page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-MONTH"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-LIST-WEEK"]').click();
  await expect(page.getByRole('heading', { name: /Lista por semana/ })).toBeVisible();
  await page.locator('[data-action-id="AGENDA-CALENDAR-VIEW-LIST-DAY"]').click();
  await expect(page.getByRole('heading', { name: /Lista por día/ })).toBeVisible();
  await expect(page.locator('[data-action-id="AGENDA-VISITS-DELETE"]')).toBeDisabled();
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => [
        localStorage.getItem('analiza.en.casa.workspace.v3.shifts'),
        localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
      ]),
    )
    .toEqual(storedBefore);
});
