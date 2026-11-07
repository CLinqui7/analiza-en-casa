import { expect, test } from '@playwright/test';

// test-id: playwright:cr005-independent-doctor-resource
// test-id: playwright:cr006-doctor-save-reload-edit
// test-id: playwright:cr007-professional-specialties
// test-id: playwright:b2-doctors-admin-only

async function login(
  page: import('@playwright/test').Page,
  email = 'admin@demo.local',
  password = 'demo-admin',
) {
  await page.goto('/login?next=%2Fdoctors');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/doctors$/);
}

test('B2 keeps doctor and resource creation independent and persists the doctor edit', async ({
  page,
}) => {
  await login(page);
  await expect(page.getByRole('link', { name: 'Nuevo recurso' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo médico' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo médico' });
  await dialog.getByLabel('Nombre completo').fill('Médica B2 QA');
  await dialog.getByLabel('JVPM').fill('JVPM-B2-001');
  await dialog.getByLabel('DUI').fill('DUI-B2-001');
  await dialog.getByLabel('Relación del médico').selectOption('NEW');
  await dialog.getByLabel('Especialidad o profesión').fill('Nutri');
  await dialog.getByRole('option', { name: 'Nutricionista' }).click();
  await dialog.getByLabel('Teléfono celular (opcional)').fill('7000-0200');
  await dialog.getByLabel('Teléfono fijo (obligatorio)').fill('2222-0200');
  await dialog.getByLabel('Correo').fill('medica.b2@example.test');
  await dialog.getByLabel('Dirección').fill('Dirección sintética B2');
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'credencial-b2.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('archivo sintético B2'),
  });
  await expect(dialog.getByRole('list', { name: 'Archivos seleccionados' })).toContainText(
    'credencial-b2.txt',
  );
  await dialog.getByRole('button', { name: 'Guardar médico' }).click();
  await expect(page.getByRole('status')).toContainText('Médica B2 QA registrado');
  await page.reload();
  await expect(page.getByRole('cell', { name: 'JVPM-B2-001' })).toBeVisible();
  await expect(page.getByText('credencial-b2.txt', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Editar médico' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Editar médico' });
  await expect(
    editDialog.getByRole('combobox', { name: 'Especialidad o profesión' }),
  ).toHaveAttribute('placeholder', 'Nutricionista');
  await expect(editDialog.getByLabel('Dirección')).toHaveValue('Dirección sintética B2');
  await editDialog.getByLabel('Dirección').fill('Dirección sintética B2 editada');
  await editDialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Editar médico' }).click();
  const reopenedDialog = page.getByRole('dialog', { name: 'Editar médico' });
  await expect(reopenedDialog.getByLabel('Dirección')).toHaveValue(
    'Dirección sintética B2 editada',
  );
  await expect(reopenedDialog.getByRole('list', { name: 'Archivos seleccionados' })).toContainText(
    'credencial-b2.txt',
  );
  await reopenedDialog.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('link', { name: 'Nuevo recurso' }).click();
  await expect(page).toHaveURL(/\/clinical\/nursing$/);
  await page.getByRole('button', { name: 'Nuevo recurso' }).click();
  const resourceDialog = page.getByRole('dialog', { name: 'Nuevo recurso de enfermería' });
  await resourceDialog.getByLabel('Número de Junta / registro profesional').fill('REG-B2-001');
  await resourceDialog.getByLabel('Nombre visible').fill('Recurso B2 QA');
  await resourceDialog.getByLabel('Territorio').fill('Zona sintética B2');
  await resourceDialog.getByLabel('Capacidad disponible').fill('2');
  await resourceDialog.getByRole('button', { name: 'Guardar recurso' }).click();
  await page.reload();
  await expect(page.getByText('Recurso B2 QA', { exact: true })).toBeVisible();
});

// test-id: playwright:feedback-doctor-optional-profile
test('a new doctor saves without DUI or address and keeps optional profile fields', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'Nuevo médico' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo médico' });
  await dialog.getByLabel('Nombre completo').fill('Médica B2 Opcional');
  await dialog.getByLabel('Especialidad o profesión').fill('Nutri');
  await dialog.getByRole('option', { name: 'Nutricionista' }).click();
  await dialog.getByLabel('Relación del médico').selectOption('NEW');
  await dialog.getByRole('button', { name: 'Guardar médico' }).click();
  await expect(dialog.getByText('Ingrese el teléfono fijo.')).toBeVisible();
  await dialog.getByLabel('Teléfono fijo (obligatorio)').fill('2222-0300');
  await dialog.getByLabel('Clínica (nombre, opcional)').fill('Clínica sintética B2');
  await dialog.getByLabel('NIT (opcional)').fill('NIT-B2-SYN');
  await dialog.getByLabel('Zona (opcional)').fill('Zona sintética B2');
  await dialog.getByRole('button', { name: 'Guardar médico' }).click();
  await expect(page.getByRole('status')).toContainText('Médica B2 Opcional registrado');
  await page.reload();
  await expect(page.getByRole('cell', { name: '2222-0300' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'No registrado' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Editar médico' }).click();
  const edited = page.getByRole('dialog', { name: 'Editar médico' });
  await expect(edited.getByLabel('DUI (opcional)')).toHaveValue('');
  await expect(edited.getByLabel('Dirección (opcional)')).toHaveValue('');
  await expect(edited.getByLabel('Clínica (nombre, opcional)')).toHaveValue('Clínica sintética B2');
  await expect(edited.getByLabel('NIT (opcional)')).toHaveValue('NIT-B2-SYN');
  await expect(edited.getByLabel('Zona (opcional)')).toHaveValue('Zona sintética B2');
});

for (const role of [
  { name: 'DOCTOR', email: 'doctor@demo.local', password: 'demo-doctor' },
  { name: 'NURSE', email: 'nurse@demo.local', password: 'demo-nurse' },
  { name: 'INVENTORY', email: 'inventory@demo.local', password: 'demo-inventory' },
  { name: 'FINANCE', email: 'finance@demo.local', password: 'demo-finance' },
  { name: 'AUDITOR', email: 'auditor@demo.local', password: 'demo-auditor' },
]) {
  test(`B2 denies ${role.name} direct access to doctor administration`, async ({ page }) => {
    await page.goto('/login?next=%2Fdoctors');
    await page.getByLabel('Usuario o correo').fill(role.email);
    await page.getByLabel('Clave').fill(role.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page).toHaveURL(/\/doctors$/);
    await expect(page.locator('main[role="alert"]')).toHaveText(
      `Acceso restringido para el rol ${role.name}.`,
    );
    await expect(page.getByRole('button', { name: 'Nuevo médico' })).toHaveCount(0);
    await expect(page.getByText('Médicos y recursos', { exact: true })).toHaveCount(0);
  });
}
