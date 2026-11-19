import { expect, test } from '@playwright/test';

// test-id: playwright:ch08-administrative-profile
// test-id: playwright:ch08-administrative-profile-permissions

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login?next=%2Fhospitalizations');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/hospitalizations$/);
}

async function loginToDetail(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  const detailRoute = '/hospitalizations/case-demo-001';
  await page.goto(`/login?next=${encodeURIComponent(detailRoute)}`);
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(`${detailRoute}$`));
}

async function expectReadOnlyProfile(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await loginToDetail(page, email, password);
  await expect(page.getByRole('heading', { name: 'case-demo-001' })).toBeVisible();
  const before = await page.evaluate(() => [
    localStorage.getItem('analiza.en.casa.workspace.v3.hospitalizations'),
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  ]);
  await expect(page.locator('[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-OPEN"]')).toHaveCount(
    0,
  );
  await expect(page.locator('[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"]')).toHaveCount(
    0,
  );
  await expect(page.locator('[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-CANCEL"]')).toHaveCount(
    0,
  );
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => [
        localStorage.getItem('analiza.en.casa.workspace.v3.hospitalizations'),
        localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
      ]),
    )
    .toEqual(before);
}

test('CH08 keeps the execution profile visible and limits case editing to clinical fields', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() =>
    localStorage.setItem(
      'analiza.en.casa.workspace.v3.doctors',
      JSON.stringify([
        {
          id: 'doctor-ch08-qa',
          fullName: 'Médico CH08 QA',
          documentId: 'DUI-CH08',
          specialty: 'General',
          address: 'Dirección sintética',
          attachments: [],
        },
      ]),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Nueva hospitalización' }).click();
  const create = page.getByRole('dialog', { name: 'Nueva hospitalización' });
  await create.getByLabel('Paciente').selectOption('patient-demo-001');
  await create.getByLabel('Médico tratante principal').selectOption({ index: 1 });
  await create.getByLabel('Fecha de ingreso').fill('2026-10-08');
  await create.getByLabel('Próxima acción').fill('CH08 perfil administrativo');
  await create.getByRole('button', { name: 'Guardar hospitalización' }).click();
  const caseId = await page.evaluate(() => {
    const records = JSON.parse(
      localStorage.getItem('analiza.en.casa.workspace.v3.hospitalizations') ?? '[]',
    );
    return records.find(
      (item: { nextAction?: string }) => item.nextAction === 'CH08 perfil administrativo',
    )?.id as string;
  });
  expect(caseId).toBeTruthy();
  await page.evaluate((id) => {
    const key = 'analiza.en.casa.workspace.v3.hospitalizations';
    const records = JSON.parse(localStorage.getItem(key) ?? '[]');
    const record = records.find((item: { id: string }) => item.id === id);
    record.administrativeProfile = {
      healthManager: 'Coordinación CH08',
      type: 'Normal',
      startDate: '2026-10-08',
      durationDays: '5',
      paymentMethod: 'Tarjeta',
      originatingHospital: 'Origen sintético',
      patientClass: 'Regular',
    };
    localStorage.setItem(key, JSON.stringify(records));
  }, caseId);
  await page.goto(`/hospitalizations/${caseId}`);
  await expect(
    page.getByRole('heading', { name: 'Perfil administrativo · Ejecución de cotización' }),
  ).toBeVisible();

  await expect(page.getByText('Coordinación CH08', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar perfil administrativo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar caso' }).first().click();
  const edit = page.getByRole('dialog', { name: 'Editar caso' });
  await expect(edit.getByLabel('Resumen diagnóstico')).toBeVisible();
  await expect(edit.getByLabel('Médico tratante principal')).toBeVisible();
  await expect(edit.getByLabel('Visitador médico')).toHaveCount(0);
  await edit.getByRole('button', { name: 'Cancelar' }).click();
  await page.reload();
  await expect(page.getByText('Coordinación CH08', { exact: true })).toBeVisible();
});

test('CH08 ADMIN sees profile read-only and can open limited case editing', async ({ page }) => {
  await loginToDetail(page, 'admin@demo.local', 'demo-admin');
  await expect(
    page.getByRole('heading', { name: 'Perfil administrativo · Ejecución de cotización' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar perfil administrativo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar caso' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Editar caso' })).toBeVisible();
});

test('CH08 DOCTOR sees profile read-only and can open limited case editing', async ({ page }) => {
  await loginToDetail(page, 'doctor@demo.local', 'demo-doctor');
  await expect(
    page.getByRole('heading', { name: 'Perfil administrativo · Ejecución de cotización' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar perfil administrativo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar caso' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Editar caso' })).toBeVisible();
});

test('CH08 NURSE reads the direct detail without profile controls or mutation', async ({
  page,
}) => {
  await expectReadOnlyProfile(page, 'nurse@demo.local', 'demo-nurse');
});

test('CH08 FINANCE reads the direct detail without profile controls or mutation', async ({
  page,
}) => {
  await expectReadOnlyProfile(page, 'finance@demo.local', 'demo-finance');
});

test('CH08 AUDITOR reads the direct detail without profile controls or mutation', async ({
  page,
}) => {
  await expectReadOnlyProfile(page, 'auditor@demo.local', 'demo-auditor');
});

test('CH08 INVENTORY is denied the direct hospitalization detail route', async ({ page }) => {
  await loginToDetail(page, 'inventory@demo.local', 'demo-inventory');
  await expect(page.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol INVENTORY',
  );
  await expect(page.locator('[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-OPEN"]')).toHaveCount(
    0,
  );
});
