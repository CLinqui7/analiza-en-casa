import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill('admin@demo.local');
  await page.getByLabel('Contraseña').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
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

test('patient duplicate validation and individual vital registration are usable', async ({
  page,
}) => {
  await login(page);
  await page.goto('/patients');
  await page.getByRole('button', { name: 'Agregar paciente' }).click();
  await page.getByLabel('Nombre completo').fill('Paciente Demo Repetido');
  await page.getByLabel('Número de documento').fill('123456789');
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByText('Ya existe un registro con este documento')).toBeVisible();

  await page.goto('/clinical/reports');
  await page.getByRole('button', { name: 'Registrar medición individual' }).click();
  await page.getByLabel('Fecha y hora').fill('2026-08-28T10:30');
  await page.getByLabel('Pulso (lpm)').fill('70');
  await page.getByRole('button', { name: 'Guardar medición' }).click();
  await expect(page.getByRole('status')).toContainText('Medición individual registrada');
  await expect(page.getByText('Pulso: 70 lpm')).toBeVisible();
});

test('patient detail edits persist after refresh', async ({ page }) => {
  await login(page);
  await page.goto('/patients');
  await page.locator('[data-action-id="PATIENT-DETAIL-NAVIGATE"]').first().click();
  await page.getByRole('button', { name: 'Editar paciente' }).click();
  await page.getByLabel('Teléfono de demo').fill('2222 3333');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toContainText('actualizado y persistido');
  await page.reload();
  await expect(page.getByText('2222 3333')).toBeVisible();
});

test('hospitalization creation persists after refresh', async ({ page }) => {
  await login(page);
  await page.goto('/hospitalizations');
  await page.getByRole('button', { name: 'Nueva hospitalización' }).click();
  await page.getByLabel('Tipo de cuenta').fill('Coordinación de prueba');
  await page.getByLabel('Siguiente acción (opcional)').fill('Confirmar visita de QA');
  await page.getByRole('button', { name: 'Guardar hospitalización' }).click();
  await expect(page.getByRole('status')).toContainText('persistida');
  await page.reload();
  await expect(page.getByText('Confirmar visita de QA')).toBeVisible();
});

test('quote draft becomes an immutable sent version', async ({ page }) => {
  await login(page);
  await page.goto('/quotes');
  await page.getByRole('button', { name: 'Nueva cotización' }).click();
  await page.getByLabel('Resumen operativo').fill('Coordinación sintética para prueba de inmutabilidad.');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('status')).toContainText('Borrador de cotización persistido');
  await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await page.getByRole('button', { name: 'Enviar enlace seguro' }).click();
  await expect(page.getByRole('status')).toContainText('quedó inmutable');
  await page.reload();
  await expect(page.getByText('Enviada e inmutable')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar enlace seguro' })).toHaveCount(0);
});

test('payment application is idempotent and reversal preserves its reason', async ({ page }) => {
  await login(page);
  await page.goto('/quotes');
  await page.getByRole('button', { name: 'Nueva cotización' }).click();
  await page.getByLabel('Resumen operativo').fill('Flujo sintético para validar pago idempotente.');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await page.getByRole('button', { name: 'Enviar enlace seguro' }).click();

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
  await expect(page.getByText('La clave ya fue aplicada; la operación no se duplicó.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).first().click();

  await page.getByRole('button', { name: 'Reversar' }).click();
  await page.getByLabel('Motivo').fill('Corrección de QA sintética.');
  await page.getByRole('button', { name: 'Confirmar reversión' }).click();
  await expect(page.getByRole('status')).toContainText('Pago reversado con motivo');
  await page.reload();
  await expect(page.getByText('Reversado')).toBeVisible();
  await expect(page.getByText('Corrección de QA sintética.')).toBeVisible();
});

test('signed clinical documents remain immutable and corrections create a new version', async ({ page }) => {
  await login(page);
  await page.goto('/clinical/care-plans');
  await page.getByRole('button', { name: 'Nuevo plan de cuidado' }).click();
  await page.getByLabel('Título').fill('Plan sintético de QA');
  await page.getByLabel('Resumen sintético').fill('Resumen sintético para verificar la inmutabilidad.');
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

test('inventory movements persist and cannot make the derived balance negative', async ({ page }) => {
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

test('dashboard has no automatically detectable serious accessibility violations', async ({
  page,
}) => {
  await login(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
