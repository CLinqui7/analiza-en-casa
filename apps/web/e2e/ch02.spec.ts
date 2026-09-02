import { expect, test } from '@playwright/test';

// test-id: playwright:ch02-authenticated-route
// test-id: playwright:ch02-list-surfaces
// test-id: playwright:ch02-form-required-document-demographics
// test-id: playwright:ch02-botmaker-insurance-insurer-holder-coverage
// test-id: playwright:ch02-contacts-address-map-back-save
// test-id: playwright:ch02-mobile-form-modal-map
// test-id: playwright:cr002-resident-card

async function login(page: import('@playwright/test').Page, path = '/patients') {
  await page.goto(`/login?next=${encodeURIComponent(path)}`);
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`));
}

async function openForm(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Agregar paciente' }).click();
  return page.getByRole('dialog', { name: 'Agregar paciente' });
}

async function fillRequired(
  dialog: ReturnType<import('@playwright/test').Page['getByRole']>,
  suffix: string,
) {
  await dialog.getByLabel('Tipo de documento').selectOption('OTHER');
  await dialog.getByLabel('Número de documento').fill(`CH02-${suffix}`);
  await dialog.getByLabel('Nombre completo').fill(`Paciente CH02 ${suffix}`);
  await dialog.getByLabel('Fecha de nacimiento').fill('1990-01-01');
  await dialog.getByLabel('Femenino').check();
  await dialog.getByLabel('Teléfono celular').fill('7000-0000');
  await dialog.getByLabel('Empresa').fill('Empresa demo');
  await dialog.getByRole('option', { name: 'Empresa demo' }).click();
  await dialog
    .getByRole('textbox', { name: 'Dirección obligatorio', exact: true })
    .fill('Dirección sintética CH02');
  await dialog
    .getByLabel('Comentarios relevantes de la dirección')
    .fill('Referencia sintética CH02');
}

test('CH02-F001-F005 route, list, sections, required markers, and primary document choices', async ({
  page,
}) => {
  await page.goto('/patients');
  await expect(page).toHaveURL(/\/login\?next=%2Fpatients/);
  await login(page);
  for (const label of ['Activos', 'Inactivos', 'Carga masiva'])
    await expect(page.getByRole('tab', { name: new RegExp(label) })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar Excel' })).toBeVisible();
  const dialog = await openForm(page);
  for (const section of ['Datos generales', 'Información del seguro', 'Contactos', 'Dirección'])
    await expect(dialog.getByRole('group', { name: section })).toBeVisible();
  await expect(dialog.locator('.required-marker')).toHaveCount(9);
  await expect(dialog.getByLabel('Tipo de documento')).toContainText('Cédula');
  await expect(dialog.getByLabel('Tipo de documento')).toContainText('Pasaporte');
  await expect(dialog.getByLabel('Fecha de nacimiento')).toHaveAttribute('type', 'date');
});

test('CH02-F006-F012 searchable demographics, consent, insurer holder modal and coverage work', async ({
  page,
}) => {
  await login(page);
  const dialog = await openForm(page);
  await dialog.getByLabel('Nacionalidad').fill('guatem');
  await expect(dialog.getByRole('option', { name: 'Guatemalteca (demo)' })).toBeVisible();
  await dialog.getByLabel('Nacionalidad').press('Enter');
  const consent = dialog.getByLabel('Autoriza notificaciones operativas por WhatsApp');
  await expect(consent).toBeChecked();
  await consent.uncheck();
  await dialog.getByLabel('Tipo de paciente').selectOption('INSURED');
  await dialog.getByLabel('Aseguradora demo').fill('cobertura');
  await dialog.getByRole('option', { name: 'Cobertura sintética QA' }).click();
  const holder = page.getByRole('dialog', { name: '¿El paciente es el titular del seguro?' });
  await expect(holder).toBeVisible();
  await holder.getByRole('button', { name: 'Sí' }).click();
  await expect(dialog.getByLabel('Número de póliza')).toBeVisible();
  await dialog.getByLabel('Número de póliza').fill('POL-CH02');
  await dialog.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Cobertura única preparada');
});

test('CR-002 admits a resident-card identifier without inventing its format', async ({ page }) => {
  await login(page);
  const dialog = await openForm(page);
  await dialog.getByLabel('Tipo de documento').selectOption('RESIDENT_CARD');
  await dialog.getByLabel('Número de documento').fill('RES-QA-001');
  await expect(dialog.getByText(/Formato oficial pendiente/)).toBeVisible();
});

test('CH02-F013-F016 contacts, safe link import, map, back and persistence', async ({ page }) => {
  await login(page);
  const dialog = await openForm(page);
  await fillRequired(dialog, 'PERSIST');
  await dialog.getByRole('button', { name: 'Agregar contacto' }).click();
  const contact = dialog.getByRole('group', { name: 'Contacto 1' });
  await contact.getByLabel('Nombre', { exact: true }).fill('Contacto CH02');
  await contact.getByLabel('Teléfono', { exact: true }).fill('7000-0001');
  await contact.getByLabel('Correo', { exact: true }).fill('contacto@example.test');
  await contact.getByLabel('Parentesco').fill('Demo');
  await contact.getByLabel('Rol').fill('Contacto');
  await contact.getByLabel('País').fill('Demo');
  await dialog
    .getByRole('textbox', { name: 'Pegar enlace', exact: true })
    .fill('https://maps.example/?q=13.692900,-89.218200');
  await dialog.getByRole('button', { name: 'Importar enlace' }).click();
  await expect(dialog.getByLabel('Ubicación geográfica')).toHaveValue('13.692900, -89.218200');
  await expect(dialog.getByLabel('Mapa de ubicación')).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await page.reload();
  await page.getByLabel('Buscar paciente').fill('CH02-PERSIST');
  await expect(page.getByRole('row', { name: /Paciente CH02 PERSIST/ })).toBeVisible();
  await page.getByRole('button', { name: 'Agregar paciente' }).click();
  await page
    .getByRole('dialog', { name: 'Agregar paciente' })
    .getByRole('button', { name: 'Atrás' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Agregar paciente' })).toHaveCount(0);
});

test('CH02 mobile form, holder modal and map have no viewport overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const dialog = await openForm(page);
  await dialog.getByLabel('Tipo de paciente').selectOption('INSURED');
  await dialog.getByLabel('Aseguradora demo').fill('cobertura');
  await dialog.getByRole('option', { name: 'Cobertura sintética QA' }).click();
  await expect(
    page.getByRole('dialog', { name: '¿El paciente es el titular del seguro?' }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
