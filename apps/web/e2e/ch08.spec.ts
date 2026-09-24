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

test('CH08 stores an execution administrative profile and keeps cancellation non-persistent', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'Nueva hospitalización' }).click();
  const create = page.getByRole('dialog', { name: 'Nueva hospitalización' });
  await create.getByLabel('Paciente').selectOption('patient-demo-001');
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
  await page.goto(`/hospitalizations/${caseId}`);
  await expect(
    page.getByRole('heading', { name: 'Perfil administrativo · Ejecución de cotización' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Editar perfil administrativo' }).click();
  const profile = page.getByRole('dialog', {
    name: `Ejecución de cotización: ${caseId}`,
  });
  await expect(profile.getByLabel('Visitador médico')).toBeVisible();
  await expect(profile.getByLabel('Referido por')).toBeVisible();
  await expect(profile.getByLabel('Tipo', { exact: true })).toBeVisible();
  await profile.getByLabel('Visitador médico').fill('Coordinación CH08');
  await profile.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Coordinación CH08', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Editar perfil administrativo' }).click();
  const saved = page.getByRole('dialog', { name: `Ejecución de cotización: ${caseId}` });
  await saved.getByLabel('Visitador médico').fill('Coordinación CH08');
  await expect(saved.getByLabel('Referido por')).toHaveValue('');
  await saved.getByLabel('Tipo', { exact: true }).fill('Normal');
  await saved.getByLabel('Fecha de inicio').fill('2026-10-08');
  await saved.getByLabel('Días de duración').fill('5');
  await saved.getByLabel('Forma de pago').fill('Aseguradora');
  await saved.getByLabel('Hospital de origen').fill('Origen sintético');
  await saved.getByLabel('Clase de paciente').fill('Regular');
  await saved.getByRole('button', { name: 'Guardar' }).click();
  await expect(
    page.getByText('Perfil de ejecución de cotización guardado.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Coordinación CH08', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Editar perfil administrativo' }).click();
  const reopened = page.getByRole('dialog', {
    name: `Ejecución de cotización: ${caseId}`,
  });
  await expect(reopened.getByLabel('Visitador médico')).toHaveValue('Coordinación CH08');
  await expect(reopened.getByLabel('Días de duración')).toHaveValue('5');
  await expect(reopened.getByLabel('Hospital de origen')).toHaveValue('Origen sintético');
});

test('CH08 ADMIN can open the administrative profile on a direct hospitalization detail route', async ({
  page,
}) => {
  await loginToDetail(page, 'admin@demo.local', 'demo-admin');
  await page.getByRole('button', { name: 'Editar perfil administrativo' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Ejecución de cotización: case-demo-001' }),
  ).toBeVisible();
  await expect(page.locator('[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"]')).toBeVisible();
});

test('CH08 DOCTOR can open the administrative profile on a direct hospitalization detail route', async ({
  page,
}) => {
  await loginToDetail(page, 'doctor@demo.local', 'demo-doctor');
  await page.getByRole('button', { name: 'Editar perfil administrativo' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Ejecución de cotización: case-demo-001' }),
  ).toBeVisible();
  await expect(page.locator('[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"]')).toBeVisible();
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
