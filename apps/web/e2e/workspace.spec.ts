import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function login(page: import('@playwright/test').Page) {
  await loginAs(page, 'admin@demo.local', 'demo-admin');
}

async function openPatientDetail(page: import('@playwright/test').Page, fullName: string) {
  const row = page.getByRole('row').filter({ hasText: fullName });
  await expect(row).toHaveCount(1);
  await row.getByRole('link', { name: 'Detalle' }).click();
}

async function fillRequiredPatientData(
  dialog: import('@playwright/test').Locator,
  values: { documentId: string; fullName: string; phone: string; email?: string },
) {
  await dialog.getByLabel('Número de documento').fill(values.documentId);
  await dialog.getByLabel('Nombre completo').fill(values.fullName);
  await dialog.getByLabel('Fecha de nacimiento').fill('1985-04-20');
  await dialog.getByLabel('Femenino').check();
  await dialog.getByLabel('Teléfono celular').fill(values.phone);
  await dialog.getByLabel('Empresa').fill('Empresa QA Sintética');
  await dialog.getByLabel('Correo').fill(values.email ?? 'paciente.qa@example.test');
  await dialog.locator('input[name="address.line"]').fill('Calle sintética 123');
  await dialog.locator('input[name="address.comments"]').fill('Referencia sintética para QA');
}

test('sidebar accordions preserve stable clinical and inventory routes', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Clínico' }).click();
  await page.getByRole('link', { name: 'Reporte de salud' }).click();
  await expect(page).toHaveURL(/\/clinical\/reports$/);
  await expect(page.getByRole('heading', { name: 'Reporte de salud' })).toBeVisible();
  await page.getByRole('button', { name: 'Inventario' }).click();
  await page.getByRole('link', { name: 'Kárdex' }).click();
  await expect(page).toHaveURL(/\/inventory\/kardex$/);
  await expect(page.getByRole('heading', { name: 'Movimientos' })).toBeVisible();
});

test('primary navigation requires a session and hides patient access for inventory', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);

  await login(page);
  await page.locator('[data-action-id="PATIENT-NAVIGATE"]').click();
  await expect(page).toHaveURL(/\/patients$/);
  await page.locator('[data-action-id="DASHBOARD-NAVIGATE"]').first().click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'inventory@demo.local', 'demo-inventory');
  await expect(page.locator('[data-action-id="PATIENT-NAVIGATE"]')).toHaveCount(0);
  await page.goto('/patients');
  await expect(page.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol INVENTORY',
  );
});

test('dashboard presents unclassified measurements and opens authorized operational actions', async ({
  page,
}) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Sin clasificar')).toBeVisible();
  await expect(page.getByText('normalmente', { exact: false })).toHaveCount(0);

  await page.locator('[data-action-id="DASHBOARD-PATIENT-CREATE"]').click();
  await expect(page).toHaveURL(/\/patients\?create=1$/);
  await expect(page.getByRole('dialog', { name: 'Agregar paciente' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar diálogo' }).click();

  await page.goto('/dashboard');
  await page.locator('[data-action-id="DASHBOARD-QUOTE-CREATE"]').click();
  await expect(page).toHaveURL(/\/quotes\?create=1$/);
  await expect(page.getByRole('dialog', { name: 'Nueva cotización' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar diálogo' }).click();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'nurse@demo.local', 'demo-nurse');
  await expect(page.locator('[data-action-id="DASHBOARD-PATIENT-CREATE"]')).toBeVisible();
  await expect(page.locator('[data-action-id="DASHBOARD-QUOTE-CREATE"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'finance@demo.local', 'demo-finance');
  await expect(page.locator('[data-action-id="DASHBOARD-PATIENT-CREATE"]')).toHaveCount(0);
  await expect(page.locator('[data-action-id="DASHBOARD-QUOTE-CREATE"]')).toBeVisible();
});

test('patient duplicate validation and health-report data boundary are enforced', async ({
  page,
}) => {
  await login(page);
  await page.goto('/patients');
  await page.getByRole('button', { name: 'Agregar paciente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Agregar paciente' });
  await fillRequiredPatientData(dialog, {
    documentId: '123456789',
    fullName: 'Paciente Demo Repetido',
    phone: '7000-9911',
  });
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Ya existe un registro con este documento')).toBeVisible();

  await page.goto('/clinical/reports');
  await expect(page.getByText('Sin registros autorizados para mostrar')).toBeVisible();
  await expect(page.locator('[data-action-id^="CLINICAL-VITAL"]')).toHaveCount(0);
});

test('patient registration persists complete administrative, insurance, contacts, and address data', async ({
  page,
}) => {
  await login(page);
  await page.goto('/patients');
  await page.getByRole('button', { name: 'Agregar paciente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Agregar paciente' });
  await dialog.getByLabel('Tipo de documento').selectOption('OTHER');
  await fillRequiredPatientData(dialog, {
    documentId: 'QA-REG-001',
    fullName: 'Paciente QA Integral',
    phone: '7000-1111',
  });
  await dialog.getByLabel('Teléfono de casa').fill('2200-1111');
  await dialog.getByLabel('Jubilado').check();
  await dialog.getByLabel('Tipo de sangre').selectOption('O+');
  await dialog.getByLabel('Estado civil').selectOption('Soltero/a (demo)');
  await dialog.getByLabel('Nacionalidad').fill('Nacionalidad sintética');
  await dialog.getByLabel('Ocupación').fill('Ocupación sintética');
  await dialog.getByLabel('Tipo de paciente').selectOption('INSURED');
  await dialog.getByRole('combobox', { name: 'Aseguradora demo' }).fill('Aseguradora demo A');
  await dialog.getByRole('option', { name: 'Aseguradora demo A' }).click();
  await page
    .getByRole('dialog', { name: '¿El paciente es el titular del seguro?' })
    .getByRole('button', { name: 'No' })
    .click();
  await dialog.getByLabel('Número de póliza').fill('POL-QA-001');
  await dialog.getByLabel('Certificado / Unidad').fill('CERT-QA-001');
  await dialog.getByLabel('DUI / NIT del titular').fill('HOLDER-QA-001');
  await dialog.getByLabel('Nombre del titular').fill('Titular QA Integral');
  await dialog.getByLabel('Fecha de nacimiento del titular').fill('1970-01-02');
  await dialog.getByLabel('Fecha efectiva').fill('2026-08-28');
  await dialog.getByRole('button', { name: 'Agregar contacto' }).click();
  await dialog.locator('input[name="contacts.0.fullName"]').fill('Contacto QA Uno');
  await dialog.locator('input[name="contacts.0.phone"]').fill('7000-2001');
  await dialog.locator('input[name="contacts.0.email"]').fill('contacto.uno@example.test');
  await dialog.locator('input[name="contacts.0.relationship"]').fill('Parentesco QA');
  await dialog.locator('input[name="contacts.0.role"]').fill('Rol QA');
  await dialog.locator('input[name="contacts.0.country"]').fill('País QA');
  await dialog.getByRole('button', { name: 'Agregar contacto' }).click();
  await dialog.locator('input[name="contacts.1.fullName"]').fill('Contacto QA Dos');
  await dialog.locator('input[name="contacts.1.phone"]').fill('7000-2002');
  await dialog.getByRole('button', { name: 'Definir principal' }).nth(1).click();
  await dialog.getByRole('button', { name: 'Agregar contacto' }).click();
  await dialog.getByRole('button', { name: 'Eliminar contacto' }).last().click();
  await dialog
    .locator('input[name="address.locationUrl"]')
    .fill('https://example.test/ubicacion-qa');
  await dialog.locator('input[name="address.coordinates"]').fill('13.7000,-89.2000');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('status')).toContainText('Paciente QA Integral');
  await page.reload();
  await page.getByLabel('Buscar paciente').fill('Paciente QA Integral');
  await openPatientDetail(page, 'Paciente QA Integral');
  await expect(page.getByText('Empresa QA Sintética')).toBeVisible();
  await expect(page.getByText('POL-QA-001')).toBeVisible();
  await expect(page.getByText('Contacto QA Uno')).toBeVisible();
  await expect(page.getByText('Contacto QA Dos')).toBeVisible();
  await expect(page.getByText('Principal')).toBeVisible();
  await expect(page.getByText('Calle sintética 123')).toBeVisible();
  await expect(page.getByText('https://example.test/ubicacion-qa')).toBeVisible();
});

test('patient detail uses the complete shared editor and persists edits', async ({ page }) => {
  await login(page);
  await page.goto('/patients');
  await page.getByRole('button', { name: 'Agregar paciente' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Agregar paciente' });
  await createDialog.getByLabel('Tipo de documento').selectOption('OTHER');
  await fillRequiredPatientData(createDialog, {
    documentId: 'EDIT-QA-001',
    fullName: 'Paciente QA Editable',
    phone: '7000-4001',
  });
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByLabel('Buscar paciente').fill('Paciente QA Editable');
  await openPatientDetail(page, 'Paciente QA Editable');
  await expect(page.locator('dt', { hasText: /^Estado$/ }).locator('+ dd')).toHaveText('Activo');
  await page.getByRole('button', { name: 'Editar paciente' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Editar paciente' });
  await editDialog.getByLabel('Nombre completo').fill('Paciente QA Editado');
  await editDialog.getByLabel('Teléfono celular').fill('7000-4999');
  await editDialog.getByLabel('Tipo de paciente').selectOption('INSURED');
  await editDialog
    .getByRole('combobox', { name: 'Aseguradora demo' })
    .fill('Cobertura sintética QA');
  await editDialog.getByRole('option', { name: 'Cobertura sintética QA' }).click();
  await page
    .getByRole('dialog', { name: '¿El paciente es el titular del seguro?' })
    .getByRole('button', { name: 'No' })
    .click();
  await editDialog.getByLabel('Número de póliza').fill('POL-EDIT-QA');
  await editDialog.getByLabel('DUI / NIT del titular').fill('HOLDER-EDIT');
  await editDialog.getByLabel('Nombre del titular').fill('Titular Editado');
  await editDialog.getByLabel('Fecha de nacimiento del titular').fill('1975-02-03');
  await editDialog.getByRole('button', { name: 'Agregar contacto' }).click();
  await editDialog.locator('input[name="contacts.0.fullName"]').fill('Contacto Editado');
  await editDialog.locator('input[name="contacts.0.phone"]').fill('7000-4555');
  await editDialog.locator('input[name="address.line"]').fill('Dirección editada QA');
  await editDialog.locator('input[name="address.comments"]').fill('Referencia editada QA');
  await editDialog.locator('input[name="address.coordinates"]').fill('13.7,-89.2');
  await editDialog
    .locator('input[name="address.locationUrl"]')
    .fill('https://example.test/editada');
  await editDialog.locator('select[name="documentType"]').selectOption('PASSPORT');
  await editDialog.locator('input[name="documentId"]').fill('PASS-EDIT-QA');
  await editDialog.locator('select[name="documentType"]').selectOption('DUI');
  await expect(editDialog.locator('input[name="documentId"]')).toHaveValue('');
  await expect(editDialog.getByLabel('Nombre completo')).toHaveValue('Paciente QA Editado');
  await editDialog.locator('select[name="documentType"]').selectOption('OTHER');
  await editDialog.locator('input[name="documentId"]').fill('EDIT-QA-001');
  await editDialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.getByLabel('Buscar paciente').fill('Paciente QA Editado');
  await openPatientDetail(page, 'Paciente QA Editado');
  await expect(page.getByText('POL-EDIT-QA')).toBeVisible();
  await expect(page.getByText('Contacto Editado')).toBeVisible();
  await expect(page.getByText('Dirección editada QA')).toBeVisible();
  await page.reload();
  await expect(page.getByText('7000-4999')).toBeVisible();
  await expect(page.getByText('https://example.test/editada')).toBeVisible();
  await page.getByRole('button', { name: 'Editar paciente' }).click();
  const duplicateEditDialog = page.getByRole('dialog', { name: 'Editar paciente' });
  await duplicateEditDialog.locator('select[name="documentType"]').selectOption('DUI');
  await duplicateEditDialog.locator('input[name="documentId"]').fill('123456789');
  await duplicateEditDialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(
    duplicateEditDialog.getByText('Ya existe un registro con este documento'),
  ).toBeVisible();
});

test('patient import validates CSV rows, persists valid rows, and exports filtered results', async ({
  page,
}) => {
  await login(page);
  await page.goto('/patients');
  await page.getByRole('button', { name: 'Importar CSV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Importar pacientes' });
  await dialog.locator('[data-action-id="PATIENT-IMPORT-FILE"]').setInputFiles({
    name: 'invalido.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('document,firstName,lastName\n,Sin,Documento'),
  });
  await expect(dialog.getByRole('alert')).toContainText('Fila 2');
  await dialog.locator('[data-action-id="PATIENT-IMPORT-FILE"]').setInputFiles({
    name: 'pacientes-validos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'document,firstName,lastName,documentType,phone,email,company,status\nIMPORT-001,Importado,Uno,OTHER,7000-5001,uno.import@example.test,Empresa Importada,ACTIVE\nIMPORT-002,Importado,Dos,OTHER,7000-5002,dos.import@example.test,Empresa Importada,INACTIVE',
    ),
  });
  await expect(dialog.locator('[data-action-id="PATIENT-IMPORT-PREVIEW"]')).toContainText(
    '2 filas válidas',
  );
  await dialog.getByRole('button', { name: 'Importar pacientes' }).click();
  await page.reload();
  await page.getByLabel('Buscar paciente').fill('Importado Uno');
  await expect(page.getByText('Importado Uno')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const content = await (await download).createReadStream();
  let csv = '';
  for await (const chunk of content!) csv += chunk.toString();
  expect(csv).toContain('Nombre completo');
  expect(csv).toContain('Importado Uno');
  expect(csv).not.toContain('Importado Dos');
});

test('patient detail keeps auditor read-only and inventory denied', async ({ page }) => {
  await loginAs(page, 'auditor@demo.local', 'demo-auditor');
  await page.goto('/patients/patient-demo-001');
  await expect(page.getByRole('heading', { name: 'Paciente Demo Aurora' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar paciente' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'inventory@demo.local', 'demo-inventory');
  await page.goto('/patients/patient-demo-001');
  await expect(page.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol INVENTORY',
  );
});

test('patient document switches clear only document state and form validation is enforced', async ({
  page,
}) => {
  await login(page);
  await page.goto('/patients');
  await page.getByRole('button', { name: 'Agregar paciente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Agregar paciente' });
  await dialog.getByLabel('Tipo de documento').selectOption('PASSPORT');
  await dialog.getByLabel('Número de documento').fill('PAS-QA-001');
  await dialog.getByLabel('Nombre completo').fill('Paciente Cambio QA');
  await dialog.getByLabel('Teléfono celular').fill('7000-3001');
  await dialog.getByLabel('Correo').fill('cambio.qa@example.test');
  await dialog.getByLabel('Tipo de documento').selectOption('DUI');
  await expect(dialog.getByLabel('Número de documento')).toHaveValue('');
  await expect(dialog.getByLabel('Nombre completo')).toHaveValue('Paciente Cambio QA');
  await expect(dialog.getByLabel('Teléfono celular')).toHaveValue('7000-3001');
  await dialog.getByLabel('Número de documento').fill('876543210');
  await dialog.getByLabel('Tipo de documento').selectOption('PASSPORT');
  await expect(dialog.getByLabel('Número de documento')).toHaveValue('');
  await expect(dialog.getByLabel('Nombre completo')).toHaveValue('Paciente Cambio QA');

  await fillRequiredPatientData(dialog, {
    documentId: 'PAS-QA-VALIDATION',
    fullName: 'Paciente Cambio QA',
    phone: '7000-3001',
    email: 'correo-invalido',
  });
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog.getByText('Ingrese un correo electrónico válido.')).toBeVisible();
  await dialog.getByLabel('Correo').fill('cambio.qa@example.test');
  await dialog.getByLabel('Número de documento').fill('12345678-9');
  await dialog.getByLabel('Tipo de documento').selectOption('DUI');
  await dialog.getByLabel('Número de documento').fill('123456789');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog.getByText('Ya existe un registro con este documento')).toBeVisible();
});

test('patient list supports tabs, search, sorting, pagination, persisted status changes, roles, and mobile', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page);
  await page.goto('/patients');

  await page.getByRole('tab', { name: /Activos/ }).click();
  await expect(page.getByText('8 visibles')).toBeVisible();
  await page.getByLabel('Buscar paciente').fill('Celeste');
  await expect(page.getByRole('row', { name: /Paciente Demo Celeste/ })).toBeVisible();
  await page.getByLabel('Buscar paciente').fill('DEMO-005');
  await expect(page.getByRole('row', { name: /Paciente Demo Estela/ })).toBeVisible();
  await page.getByLabel('Buscar paciente').fill('7000 0003');
  await expect(page.getByRole('row', { name: /Paciente Demo Celeste/ })).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await expect(page.getByLabel('Buscar paciente')).toHaveValue('');

  const nameHeader = page
    .locator('th')
    .filter({ has: page.locator('[data-action-id="PATIENT-SORT-NAME"]') });
  await page.locator('[data-action-id="PATIENT-SORT-NAME"]').click();
  await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  await page.locator('[data-action-id="PATIENT-SORT-NAME"]').click();
  await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  const documentHeader = page
    .locator('th')
    .filter({ has: page.locator('[data-action-id="PATIENT-SORT-DOCUMENT"]') });
  await page.locator('[data-action-id="PATIENT-SORT-DOCUMENT"]').click();
  await expect(documentHeader).toHaveAttribute('aria-sort', 'ascending');

  await page.locator('[data-action-id="PATIENT-PAGE-SIZE"]').selectOption('5');
  await page.locator('[data-action-id="PATIENT-PAGE-NEXT"]').click();
  await expect(page.locator('[data-action-id="PATIENT-PAGINATE"][aria-current="page"]')).toHaveText(
    '2',
  );
  await page.locator('[data-action-id="PATIENT-PAGE-PREVIOUS"]').click();
  await expect(page.locator('[data-action-id="PATIENT-PAGINATE"][aria-current="page"]')).toHaveText(
    '1',
  );

  await page.getByLabel('Buscar paciente').fill('sin coincidencia de QA');
  await expect(page.getByRole('status').filter({ hasText: 'Sin resultados' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await page
    .getByRole('row', { name: /Paciente Demo Aurora/ })
    .getByRole('button', { name: 'Inactivar' })
    .click();
  await page.getByRole('tab', { name: /Inactivos/ }).click();
  await expect(page.getByRole('row', { name: /Paciente Demo Aurora/ })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: /Inactivos/ }).click();
  await expect(page.getByRole('row', { name: /Paciente Demo Aurora/ })).toBeVisible();
  await page
    .getByRole('row', { name: /Paciente Demo Aurora/ })
    .getByRole('button', { name: 'Reactivar' })
    .click();
  await page.getByRole('tab', { name: /Activos/ }).click();
  await page.reload();
  await expect(page.getByRole('row', { name: /Paciente Demo Aurora/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();

  await loginAs(page, 'auditor@demo.local', 'demo-auditor');
  await page.goto('/patients');
  await expect(
    page.locator('[data-action-id="PATIENT-INACTIVATE"], [data-action-id="PATIENT-REACTIVATE"]'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'inventory@demo.local', 'demo-inventory');
  await page.goto('/patients');
  await expect(page.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol INVENTORY',
  );
  await context.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await login(mobilePage);
  await mobilePage.goto('/patients');
  await expect
    .poll(() =>
      mobilePage.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await mobileContext.close();
});

test('patient detail edits persist after refresh', async ({ page }) => {
  await login(page);
  await page.goto('/patients');
  await page.getByRole('button', { name: 'Agregar paciente' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Agregar paciente' });
  await createDialog.getByLabel('Tipo de documento').selectOption('OTHER');
  await fillRequiredPatientData(createDialog, {
    documentId: 'PATIENT-PLAYWRIGHT-EDIT-001',
    fullName: 'Paciente Playwright Editable',
    phone: '7000-9001',
  });
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByLabel('Buscar paciente').fill('PATIENT-PLAYWRIGHT-EDIT-001');
  await openPatientDetail(page, 'Paciente Playwright Editable');
  await page.getByRole('button', { name: 'Editar paciente' }).click();
  await page.getByLabel('Teléfono celular').fill('2222 3333');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toContainText('actualizado y persistido');
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const patients = JSON.parse(
          localStorage.getItem('analiza.en.casa.workspace.v3.patients') ?? '[]',
        );
        return patients.find(
          (patient: { documentId?: string }) =>
            patient.documentId === 'PATIENT-PLAYWRIGHT-EDIT-001',
        )?.phone;
      }),
    )
    .toBe('2222 3333');
});

test('hospitalization route provides legacy listing controls, persistence, detail and edit', async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto('/hospitalizations');
  await expect(page.getByRole('columnheader', { name: 'Identificador' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Paciente' })).toBeVisible();
  await page.getByLabel('Buscar hospitalización').fill('1234 56789');
  await expect(page.getByText('Paciente Demo Aurora')).toBeVisible();
  await page.locator('[data-action-id="HOSPITALIZATION-SEARCH-CLEAR"]').click();
  await expect(page.getByText('Paciente Demo Aurora')).toBeVisible();
  await page.getByLabel('Estado administrativo').selectOption('ACTIVE');
  await page.locator('[data-action-id="HOSPITALIZATION-FILTER-DATE"]').fill('2026-08-28');
  await page.getByLabel('Tipo de cuenta').first().selectOption('Referencia sintética');
  await expect(page.getByText('case-demo-001')).toBeVisible();
  await page.locator('[data-action-id="HOSPITALIZATION-FILTER-CLEAR"]').click();
  await page.getByRole('button', { name: 'Nueva hospitalización' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Nueva hospitalización' });
  await createDialog.getByLabel('Paciente').selectOption('');
  await page.getByRole('button', { name: 'Guardar hospitalización' }).click();
  await expect(createDialog.getByText('Seleccione un paciente.')).toBeVisible();
  await createDialog.getByLabel('Paciente').selectOption('patient-demo-001');
  await createDialog.getByLabel('Tipo de cuenta').selectOption('EMPRESA');
  await createDialog.getByLabel('Responsable administrativo').fill('Responsable QA');
  await createDialog.getByLabel('Próxima acción').fill('Confirmar visita de QA');
  await page.getByRole('button', { name: 'Guardar hospitalización' }).click();
  await expect(page.getByRole('status')).toContainText('persistida');
  await page.reload();
  const createdDetailLink = page.locator(
    'a[data-action-id="HOSPITALIZATION-DETAIL-NAVIGATE"][href^="/hospitalizations/HOS-"]',
  );
  await expect(createdDetailLink).toHaveCount(2);
  const createdPath = await createdDetailLink.first().getAttribute('href');
  expect(createdPath).not.toBeNull();
  const createdId = createdPath!.split('/').at(-1)!;
  await page.goto(createdPath!);
  await expect(page).toHaveURL(new RegExp(`${createdPath}$`));
  await expect(page.getByText('Responsable QA')).toBeVisible();
  await page.getByRole('button', { name: 'Editar hospitalización' }).click();
  await expect(page.getByRole('dialog', { name: `Editar ${createdId}` })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(createdPath!);
  await page.getByRole('button', { name: 'Editar hospitalización' }).click();
  const editDialog = page.getByRole('dialog', { name: `Editar ${createdId}` });
  await editDialog.getByLabel('Responsable administrativo').fill('Responsable QA actualizado');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.goto(createdPath!);
  await expect(page.getByText('Responsable QA actualizado')).toBeVisible();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await login(mobilePage);
  await mobilePage.goto('/hospitalizations');
  await expect
    .poll(() =>
      mobilePage.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await mobileContext.close();
});

test('hospitalization permissions preserve read-only roles and deny inventory', async ({
  page,
}) => {
  await loginAs(page, 'nurse@demo.local', 'demo-nurse');
  await page.goto('/hospitalizations');
  await expect(page.getByRole('heading', { name: 'Hospitalización' })).toBeVisible();
  await expect(
    page.locator(
      '[data-action-id="HOSPITALIZATION-CREATE"], [data-action-id="HOSPITALIZATION-EDIT"]',
    ),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'doctor@demo.local', 'demo-doctor');
  await page.goto('/hospitalizations');
  await expect(page.locator('[data-action-id="HOSPITALIZATION-CREATE"]')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'finance@demo.local', 'demo-finance');
  await page.goto('/hospitalizations');
  await expect(
    page.locator(
      '[data-action-id="HOSPITALIZATION-CREATE"], [data-action-id="HOSPITALIZATION-EDIT"]',
    ),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'auditor@demo.local', 'demo-auditor');
  await page.goto('/hospitalizations');
  await expect(
    page.locator(
      '[data-action-id="HOSPITALIZATION-CREATE"], [data-action-id="HOSPITALIZATION-EDIT"], [data-action-id="HOSPITALIZATION-DETAIL-EDIT"]',
    ),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'inventory@demo.local', 'demo-inventory');
  await page.goto('/hospitalizations');
  await expect(page.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol INVENTORY',
  );
});

test('agenda rejects invalid intervals and persists scheduled shifts', async ({ page }) => {
  await login(page);
  await page.goto('/agenda');
  await page.getByRole('button', { name: 'Crear turno' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear turno a paciente' });
  await dialog.getByLabel('Inicio').fill('12:00');
  await dialog.getByLabel('Fin').fill('08:00');
  await dialog.getByLabel('Notas').fill('Turno inválido de QA.');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog.getByText('El fin debe ser posterior al inicio.')).toBeVisible();

  await dialog.locator('input[name="startTime"]').fill('08:00');
  await dialog.locator('input[name="endTime"]').fill('12:00');
  await dialog.getByLabel('Notas').fill('Turno programado de QA.');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('status')).toContainText('turno persistido');
  await page.reload();
  await expect(page.getByText('Turno programado de QA.')).toBeVisible();
});

test('nurse-hours report filters scheduled shifts and exports planned-hour data', async ({
  page,
}) => {
  await login(page);
  await page.goto('/agenda');
  await page.getByRole('button', { name: 'Crear turno' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear turno a paciente' });
  const scheduledDate = await dialog.getByLabel('Fecha 1').inputValue();
  await dialog.getByLabel('Inicio').fill('08:00');
  await dialog.getByLabel('Fin').fill('12:00');
  await dialog.getByLabel('Notas').fill('Turno para reporte de QA.');
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  await page.goto('/reports/nurse-hours');
  await page.getByLabel('Desde').fill(scheduledDate);
  await page.getByLabel('Hasta').fill(scheduledDate);
  await page.getByLabel('Estado').selectOption('SCHEDULED');
  await expect(page.getByText('Turno para reporte de QA.')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: '4', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver' }).click();
  await expect(page.getByText('no hay evidencia de check-in/out')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  await expect((await download).suggestedFilename()).toBe('reporte-horas-programadas.csv');
  await page.getByRole('button', { name: 'Restablecer' }).click();
  await expect(page.getByText('Turnos', { exact: true })).toBeVisible();
});

test('nursing resources require professional registration, persist, and honor role guards', async ({
  page,
}) => {
  await login(page);
  await page.goto('/clinical/nursing');
  await page.getByRole('button', { name: 'Nuevo recurso' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo recurso de enfermería' });
  await dialog.getByLabel('Nombre visible').fill('Recurso sin registro de QA');
  await dialog.getByRole('button', { name: 'Guardar recurso' }).click();
  await expect(
    dialog.getByText('Ingrese el número de Junta o registro profesional.'),
  ).toBeVisible();

  await dialog.getByLabel('Número de Junta / registro profesional').fill('JUNTA-QA-001');
  await dialog.getByLabel('Nombre visible').fill('Recurso de enfermería QA');
  await dialog.getByLabel('Territorio').fill('Zona sintética de QA');
  await dialog.getByLabel('Capacidad disponible').fill('3');
  await dialog.getByRole('button', { name: 'Guardar recurso' }).click();
  await expect(page.getByRole('status')).toContainText('Recurso de enfermería QA registrado');
  await page.reload();
  await expect(page.getByText('JUNTA-QA-001')).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'nurse@demo.local', 'demo-nurse');
  await page.goto('/clinical/nursing');
  await expect(page.getByRole('button', { name: 'Nuevo recurso' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'doctor@demo.local', 'demo-doctor');
  await page.goto('/clinical/nursing');
  await expect(page.getByRole('button', { name: 'Nuevo recurso' })).toHaveCount(0);
});

test('medical-order factual search is normalized and document choice is limited to authorized roles', async ({
  page,
}) => {
  await login(page);
  await page.goto('/clinical/orders');
  await page.getByLabel('Buscar orden médica').fill('123456789');
  await expect(page.getByText('Paciente Demo Aurora')).toBeVisible();
  await page.getByLabel('Buscar orden médica').fill('sin coincidencia QA');
  await expect(page.getByText('No hay registros disponibles')).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'doctor@demo.local', 'demo-doctor');
  await page.goto('/clinical/orders');
  await page.getByRole('button', { name: 'Acciones para Paciente Demo Aurora' }).click();
  await expect(page.getByRole('button', { name: 'Nuevo' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'nurse@demo.local', 'demo-nurse');
  await page.goto('/clinical/orders');
  await page.getByRole('button', { name: 'Acciones para Paciente Demo Aurora' }).click();
  await expect(page.getByRole('button', { name: 'Nuevo' })).toHaveCount(0);
});

test('quote draft becomes an immutable sent version', async ({ page }) => {
  await login(page);
  await page.goto('/quotes');
  await page.getByRole('button', { name: '+ Nuevo', exact: true }).click();
  await page.locator('[data-action-id="QUOTE-PATIENT-SELECT"]').selectOption('patient-demo-001');
  await page.getByLabel('Referido por').fill('Amigos');
  await page.getByRole('option', { name: 'Amigos & Familia' }).click();
  await page
    .getByLabel('Resumen operativo')
    .fill('Coordinación sintética para prueba de inmutabilidad.');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('status')).toContainText('Borrador de cotización persistido');
  await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await page.getByRole('button', { name: 'Enviar versión' }).click();
  await expect(page.getByRole('status')).toContainText('enviada e inmutable');
  await page.reload();
  await expect(page.getByText('Enviada e inmutable', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar enlace seguro' })).toHaveCount(0);
});

test('payment application is idempotent and reversal preserves its reason', async ({ page }) => {
  await login(page);
  await page.goto('/quotes');
  await page.getByRole('button', { name: '+ Nuevo', exact: true }).click();
  await page.locator('[data-action-id="QUOTE-PATIENT-SELECT"]').selectOption('patient-demo-001');
  await page.getByLabel('Referido por').fill('Amigos');
  await page.getByRole('option', { name: 'Amigos & Familia' }).click();
  await page.getByLabel('Resumen operativo').fill('Flujo sintético para validar pago idempotente.');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await page.getByRole('button', { name: 'Enviar versión' }).click();

  await page.goto('/payments');
  await page.getByRole('button', { name: 'Aplicar pago' }).click();
  await page.getByLabel('Monto ingresado').fill('125.50');
  await page.getByLabel('Referencia').fill('REF-PAGO-E2E');
  await page.getByLabel('Clave idempotente').fill('payment-e2e-key');
  await page.getByRole('button', { name: 'Aplicar pago' }).last().click();
  await expect(page.getByRole('status')).toContainText('Pago aplicado una sola vez');
  await page.reload();
  await expect(page.getByText('REF-PAGO-E2E')).toBeVisible();

  await page.getByRole('button', { name: 'Aplicar pago' }).click();
  await page.getByLabel('Referencia').fill('REF-PAGO-E2E-DUPLICADO');
  await page.getByLabel('Clave idempotente').fill('payment-e2e-key');
  await page.getByRole('button', { name: 'Aplicar pago' }).last().click();
  await expect(
    page.getByText('La clave ya fue aplicada; la operación no se duplicó.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).first().click();

  await page.getByRole('button', { name: 'Reversar' }).click();
  await page.getByLabel('Motivo').fill('Corrección de QA sintética.');
  await page.getByRole('button', { name: 'Confirmar reversión' }).click();
  await expect(page.getByRole('status')).toContainText('Pago reversado con motivo');
  await page.reload();
  await expect(page.getByText('Reversado')).toBeVisible();
  await expect(page.getByText('Corrección de QA sintética.')).toBeVisible();
});

test('signed clinical documents remain immutable and corrections create a new version', async ({
  page,
}) => {
  await login(page);
  await page.goto('/clinical/care-plans');
  await page.getByRole('button', { name: 'Nuevo plan de cuidado' }).click();
  await page.getByLabel('Título').fill('Plan sintético de QA');
  await page
    .getByLabel('Resumen sintético')
    .fill('Resumen sintético para verificar la inmutabilidad.');
  await page.getByLabel('Autor responsable').fill('Profesional de QA');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('status')).toContainText('persistido como borrador');
  await page.getByRole('button', { name: 'Firmar' }).click();
  await expect(page.getByRole('status')).toContainText('firmado e inmutable');
  await page.getByRole('button', { name: 'Corregir' }).click();
  await page.getByLabel('Motivo de corrección').fill('Ajuste sintético de QA.');
  await page.getByLabel('Nuevo resumen sintético').fill('Resumen sintético corregido para QA.');
  await page.getByRole('button', { name: 'Crear corrección' }).click();
  await expect(page.getByRole('status')).toContainText('versión firmada original se conserva');
  await page.reload();
  await expect(page.getByText('Resumen sintético para verificar la inmutabilidad.')).toBeVisible();
  await expect(page.getByText('Resumen sintético corregido para QA.')).toBeVisible();
  await expect(page.getByText('Motivo: Ajuste sintético de QA.')).toBeVisible();
});

test('inventory movements persist and cannot make the derived balance negative', async ({
  page,
}) => {
  await login(page);
  await page.goto('/inventory/movements');
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  const movementDialog = page.getByRole('dialog', { name: 'Registrar movimiento de inventario' });
  await movementDialog.getByLabel('Tipo de movimiento').selectOption('EXIT');
  await movementDialog.getByLabel('Cantidad').fill('9999');
  await movementDialog.getByLabel('Motivo').fill('Prueba de saldo negativo.');
  await page.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(page.getByText('El movimiento dejaría un saldo negativo')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  await movementDialog.getByLabel('Referencia').fill('INV-E2E-ENTRY');
  await movementDialog.getByLabel('Motivo').fill('Entrada sintética de QA.');
  await page.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(page.getByRole('status')).toContainText('Movimiento persistido');
  await page.reload();
  await expect(page.getByText('INV-E2E-ENTRY')).toBeVisible();
});

test('audit export is restricted to the audit role set', async ({ page }) => {
  await login(page);
  await page.goto('/audit');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar auditoría' }).click();
  await expect((await download).suggestedFilename()).toBe('auditoria-sintetica.csv');

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByLabel('Usuario o correo').fill('doctor@demo.local');
  await page.getByLabel('Clave').fill('demo-doctor');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.goto('/audit');
  await expect(page.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol DOCTOR',
  );
});

test('help search gives deterministic local results and a safe empty state', async ({ page }) => {
  await login(page);
  await page.goto('/help');
  await page.getByLabel('¿Qué necesitas hacer?').fill('movimiento');
  await expect(page.getByRole('heading', { name: '¿Cómo hago un movimiento?' })).toBeVisible();
  await page.getByLabel('¿Qué necesitas hacer?').fill('consulta inexistente de QA');
  await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible();
  await expect(page.getByText('no se muestra ni inventa un número')).toBeVisible();
});

test('all six demo roles enforce their route matrix', async ({ browser }) => {
  const roles = [
    { email: 'admin@demo.local', password: 'demo-admin', allowed: '/audit' },
    {
      email: 'doctor@demo.local',
      password: 'demo-doctor',
      allowed: '/clinical',
      denied: '/payments',
    },
    { email: 'nurse@demo.local', password: 'demo-nurse', allowed: '/agenda', denied: '/audit' },
    {
      email: 'inventory@demo.local',
      password: 'demo-inventory',
      allowed: '/inventory',
      denied: '/patients',
    },
    {
      email: 'finance@demo.local',
      password: 'demo-finance',
      allowed: '/payments',
      denied: '/clinical',
    },
    { email: 'auditor@demo.local', password: 'demo-auditor', allowed: '/audit' },
  ];
  for (const role of roles) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, role.email, role.password);
    await page.goto(role.allowed);
    await expect(page.locator('main[role="alert"]')).toHaveCount(0);
    if (role.denied) {
      await page.goto(role.denied);
      await expect(page.locator('main[role="alert"]')).toContainText('Acceso restringido');
    } else if (role.email === 'auditor@demo.local') {
      await page.goto('/quotes');
      await expect(page.getByRole('button', { name: 'Nueva cotización' })).toHaveCount(0);
    }
    await context.close();
  }
});

test('catalog items require a unique SKU and persist after refresh', async ({ page }) => {
  await login(page);
  await page.goto('/catalogs');
  await page.getByRole('button', { name: 'Nuevo ítem' }).click();
  await page.getByLabel('SKU').fill('KIT-DEMO-001');
  await page.getByLabel('Nombre').fill('Duplicado de QA');
  await page.getByRole('button', { name: 'Guardar ítem' }).click();
  await expect(page.getByText('Ya existe un ítem con este SKU.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('button', { name: 'Nuevo ítem' }).click();
  await page.getByLabel('SKU').fill('QA-CATALOG-001');
  await page.getByLabel('Nombre').fill('Ítem sintético de QA');
  await page.getByRole('button', { name: 'Guardar ítem' }).click();
  await expect(page.getByRole('status')).toContainText('Ítem de catálogo persistido');
  await page.reload();
  await expect(page.getByText('QA-CATALOG-001')).toBeVisible();
});

test('purchase drafts persist without changing inventory', async ({ page }) => {
  await login(page);
  await page.goto('/purchases');
  await page.getByRole('button', { name: 'Nueva compra' }).click();
  await page.getByLabel('Referencia de compra').fill('PURCHASE-QA-001');
  await page.getByLabel('Nota (opcional)').fill('Borrador sintético de QA.');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('status')).toContainText('guardada como borrador');
  await page.reload();
  await expect(page.getByText('PURCHASE-QA-001')).toBeVisible();
  await expect(page.getByText('Borrador sintético de QA.')).toBeVisible();
});

test('patient portal requires a second factor and keeps invalid access generic', async ({
  page,
}) => {
  await page.route('**/api/portal-request-code', async (route) =>
    route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Si el enlace es válido, enviamos un código al canal registrado.',
      }),
    }),
  );
  await page.route('**/api/portal-status', async (route) => {
    const body = route.request().postDataJSON() as { verificationCode?: string };
    if (body.verificationCode === '12345678')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          quote_id: 'Q-PORTAL-QA',
          status: 'SENT',
          updated_at: '2026-08-28T12:00:00.000Z',
        }),
      });
    return route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'No fue posible validar el acceso.' }),
    });
  });
  await page.goto(`/portal/${'x'.repeat(64)}`);
  await page.getByRole('button', { name: 'Solicitar código' }).click();
  await expect(page.getByRole('status')).toContainText('Si el enlace es válido');
  await page.getByLabel('Código de verificación').fill('00000000');
  await page.getByRole('button', { name: 'Verificar código' }).click();
  await expect(page.getByRole('status')).toContainText('No fue posible validar el acceso.');
  await page.getByLabel('Código de verificación').fill('12345678');
  await page.getByRole('button', { name: 'Verificar código' }).click();
  await expect(page.getByRole('heading', { name: 'Acceso verificado' })).toBeVisible();
  await expect(page.getByText('Q-PORTAL-QA')).toBeVisible();
});

test('insurance search is normalized and unavailable to nurse role', async ({ page }) => {
  await login(page);
  await page.goto('/insurance');
  await page.getByLabel('Buscar solicitudes').fill('123456789');
  await expect(page.getByText('Paciente Demo Aurora')).toBeVisible();
  await page.getByLabel('Buscar solicitudes').fill('no existe en QA');
  await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'nurse@demo.local', 'demo-nurse');
  await page.goto('/insurance');
  await expect(page.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol NURSE',
  );
});

test('health report does not expose vital records without the approved report-data contract', async ({
  page,
}) => {
  await login(page);
  await page.goto('/clinical/reports');
  await expect(page.getByText('Sin registros autorizados para mostrar')).toBeVisible();
  await expect(page.locator('[data-action-id="HEALTH-REPORT-SEARCH"]')).toBeDisabled();
  await expect(page.locator('#health-report-data-boundary')).toContainText('CH16-Q008');
});

test('dashboard has no automatically detectable serious accessibility violations', async ({
  page,
}) => {
  await login(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
