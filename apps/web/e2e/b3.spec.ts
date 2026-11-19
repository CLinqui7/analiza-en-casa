import { expect, test } from '@playwright/test';

// test-id: playwright:cr009-admission-periods
// test-id: playwright:cr008-private-attachment-blocked
// test-id: playwright:cr017-multi-day-shifts
// test-id: playwright:cr018-shift-presets

async function login(
  page: import('@playwright/test').Page,
  next: string,
  email = 'admin@demo.local',
  password = 'demo-admin',
) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

test('B3 persists multiple admission and discharge periods without accepting attachment bytes', async ({
  page,
}) => {
  await login(page, '/hospitalizations');
  await page.evaluate(() =>
    localStorage.setItem(
      'analiza.en.casa.workspace.v3.doctors',
      JSON.stringify([
        {
          id: 'doctor-b3-qa',
          fullName: 'Médico B3 QA',
          documentId: 'DUI-B3',
          specialty: 'General',
          address: 'Dirección sintética',
          attachments: [],
        },
      ]),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Nueva hospitalización' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva hospitalización' });
  await dialog.getByLabel('Paciente').selectOption('patient-demo-001');
  await dialog.getByLabel('Médico tratante principal').selectOption({ index: 1 });
  await dialog.getByLabel('Fecha de ingreso').fill('2026-09-10');
  await dialog.getByLabel('Fecha de egreso (opcional)').fill('2026-09-12');
  await dialog.getByRole('button', { name: 'Agregar período' }).click();
  await dialog.getByLabel('Ingreso adicional 1').fill('2026-09-20');
  await dialog.getByLabel('Egreso adicional 1').fill('2026-09-21');
  await dialog.getByRole('button', { name: 'Agregar período' }).click();
  await dialog.getByLabel('Ingreso adicional 2').fill('2026-09-25');
  await dialog.getByLabel('Egreso adicional 2').fill('2026-09-26');
  await dialog.getByRole('button', { name: 'Quitar período 1' }).click();
  await expect(dialog.getByLabel('Ingreso adicional 1')).toHaveValue('2026-09-25');
  await expect(dialog.getByLabel('Egreso adicional 1')).toHaveValue('2026-09-26');
  await expect(dialog.getByLabel('Ingreso adicional 2')).toHaveCount(0);
  await expect(
    dialog.getByText('Los archivos demo no se almacenan como archivos privados', { exact: false }),
  ).toBeVisible();
  await expect(dialog.locator('input[type=file]')).toHaveCount(0);
  await dialog.getByLabel('Próxima acción').fill('B3 admission periods');
  await dialog.getByRole('button', { name: 'Guardar hospitalización' }).click();
  await page.reload();
  const row = page.locator('tbody tr').last();
  await row.getByRole('button', { name: 'Editar' }).click();
  const reopened = page.getByRole('dialog');
  await expect(reopened.getByLabel('Fecha de ingreso')).toHaveValue('2026-09-10');
  await expect(reopened.getByLabel('Fecha de egreso (opcional)')).toHaveValue('2026-09-12');
  await expect(reopened.getByLabel('Ingreso adicional 1')).toHaveValue('2026-09-25');
  await expect(reopened.getByLabel('Egreso adicional 1')).toHaveValue('2026-09-26');
  await expect(reopened.getByLabel('Ingreso adicional 2')).toHaveCount(0);
  await reopened.getByRole('button', { name: 'Cancelar' }).click();

  const hospitalizationId = (await row.locator('td').nth(1).getByRole('link').innerText())
    .trim()
    .replace(/^Consultar\s+/, '');
  await page.goto(`/hospitalizations?edit=${encodeURIComponent(hospitalizationId)}`);
  const directEdit = page.getByRole('dialog', { name: `Editar ${hospitalizationId}` });
  await expect(directEdit.getByLabel('Fecha de ingreso')).toHaveValue('2026-09-10');
  await expect(directEdit.getByLabel('Ingreso adicional 1')).toHaveValue('2026-09-25');
  await expect(directEdit.getByLabel('Egreso adicional 1')).toHaveValue('2026-09-26');
});

test('B3 schedules a multi-day 6h shift from clinical attention and omits undefined Puntual action', async ({
  page,
}) => {
  await login(page, '/clinical/hospitalizations');
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
  await page.reload();
  await page.getByRole('button', { name: 'Atención' }).first().click();
  const dialog = page.getByRole('dialog', { name: /Atención clínica/ });
  await dialog.locator('[data-action-id="CLINICAL-SCHEDULE-NURSE"]').selectOption('nurse-demo-001');
  await dialog.getByLabel('Fecha 1').fill('2026-11-01');
  await dialog.getByRole('button', { name: 'Agregar fecha' }).click();
  await dialog.getByLabel('Fecha 2', { exact: true }).fill('2026-11-02');
  await dialog.getByRole('button', { name: 'Quitar fecha 2' }).click();
  await expect(dialog.getByLabel('Fecha 1')).toHaveValue('2026-11-01');
  await expect(dialog.getByLabel('Fecha 2', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Agregar fecha' }).click();
  await dialog.getByLabel('Fecha 2', { exact: true }).fill('2026-11-02');
  await dialog.getByLabel('Inicio').fill('20:00');
  await dialog.locator('[data-action-id="CLINICAL-SCHEDULE-PRESET"]').selectOption('SIX_HOURS');
  await expect(dialog.getByLabel('Fin')).toHaveValue('02:00');
  await expect(dialog.getByLabel('Termina al día siguiente')).toBeChecked();
  await expect(
    dialog.getByRole('button', { name: 'Puntual (pendiente de definición)' }),
  ).toHaveCount(0);
  await dialog.getByLabel('Notas del turno').fill('B3 multi-day 6h');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.goto('/agenda');
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('analiza.en.casa.workspace.v3.shifts') ?? '[]').filter(
      (shift: { note?: string }) => shift.note === 'B3 multi-day 6h',
    ),
  );
  expect(persisted).toHaveLength(2);
  expect(persisted[0].id).not.toBe(persisted[1].id);
  expect(new Date(persisted[0].endsAt).getTime() - new Date(persisted[0].startsAt).getTime()).toBe(
    6 * 60 * 60 * 1000,
  );
});

test('B3 removes direct turn creation from the nurse agenda', async ({ page }) => {
  await login(page, '/agenda', 'nurse@demo.local', 'demo-nurse');
  await expect(page.getByRole('button', { name: 'Crear turno' })).toHaveCount(0);
});

async function expectAgendaWriteDenied(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await login(page, '/agenda', email, password);
  const before = await page.evaluate(() => [
    localStorage.getItem('analiza.en.casa.workspace.v3.shifts'),
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  ]);
  await expect(page.getByRole('button', { name: 'Crear turno' })).toHaveCount(0);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => [
        localStorage.getItem('analiza.en.casa.workspace.v3.shifts'),
        localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
      ]),
    )
    .toEqual(before);
}

test('B3 prevents DOCTOR from altering shifts or audit entries', async ({ page }) => {
  await expectAgendaWriteDenied(page, 'doctor@demo.local', 'demo-doctor');
});
test('B3 prevents INVENTORY from altering shifts or audit entries', async ({ page }) => {
  await expectAgendaWriteDenied(page, 'inventory@demo.local', 'demo-inventory');
});
test('B3 prevents FINANCE from altering shifts or audit entries', async ({ page }) => {
  await expectAgendaWriteDenied(page, 'finance@demo.local', 'demo-finance');
});
test('B3 prevents AUDITOR from altering shifts or audit entries', async ({ page }) => {
  await expectAgendaWriteDenied(page, 'auditor@demo.local', 'demo-auditor');
});
