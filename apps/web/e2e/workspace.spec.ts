import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function login(page: import('@playwright/test').Page) {
  await loginAs(page, 'admin@demo.local', 'demo-admin');
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

test('primary navigation requires a session and hides patient access for inventory', async ({ page }) => {
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
  await expect(page.locator('main[role="alert"]')).toContainText('Acceso restringido para el rol INVENTORY');
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

test('agenda rejects invalid intervals and persists scheduled shifts', async ({ page }) => {
  await login(page);
  await page.goto('/agenda');
  await page.getByRole('button', { name: 'Nuevo turno' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo turno' });
  await dialog.locator('input[name="startsAt"]').fill('2026-08-30T12:00');
  await dialog.locator('input[name="endsAt"]').fill('2026-08-30T08:00');
  await dialog.getByLabel('Notas').fill('Turno inválido de QA.');
  await dialog.getByRole('button', { name: 'Guardar turno' }).click();
  await expect(dialog.getByText('El fin debe ser posterior al inicio.')).toBeVisible();

  await dialog.locator('input[name="startsAt"]').fill('2026-08-30T08:00');
  await dialog.locator('input[name="endsAt"]').fill('2026-08-30T12:00');
  await dialog.getByLabel('Notas').fill('Turno programado de QA.');
  await dialog.getByRole('button', { name: 'Guardar turno' }).click();
  await expect(page.getByRole('status')).toContainText('Turno persistido');
  await page.reload();
  await expect(page.getByText('Turno programado de QA.')).toBeVisible();
});

test('nurse-hours report filters scheduled shifts and exports planned-hour data', async ({ page }) => {
  await login(page);
  await page.goto('/agenda');
  await page.getByRole('button', { name: 'Nuevo turno' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo turno' });
  await dialog.getByLabel('Inicio').fill('2026-08-31T08:00');
  await dialog.getByLabel('Fin').fill('2026-08-31T12:00');
  await dialog.getByLabel('Notas').fill('Turno para reporte de QA.');
  await dialog.getByRole('button', { name: 'Guardar turno' }).click();

  await page.goto('/reports/nurse-hours');
  await page.getByLabel('Desde').fill('2026-08-31');
  await page.getByLabel('Hasta').fill('2026-08-31');
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

test('nursing resources require professional registration, persist, and honor role guards', async ({ page }) => {
  await login(page);
  await page.goto('/clinical/nursing');
  await page.getByRole('button', { name: 'Registrar recurso' }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar recurso de enfermería' });
  await dialog.getByLabel('Nombre visible').fill('Recurso sin registro de QA');
  await dialog.getByRole('button', { name: 'Guardar recurso' }).click();
  await expect(dialog.getByText('Ingrese el número de Junta o registro profesional.')).toBeVisible();

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
  await expect(page.getByRole('button', { name: 'Registrar recurso' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'doctor@demo.local', 'demo-doctor');
  await page.goto('/clinical/nursing');
  await expect(page.getByRole('button', { name: 'Registrar recurso' })).toHaveCount(0);
});

test('clinical action search is normalized and creation is limited to authorized roles', async ({ page }) => {
  await login(page);
  await page.goto('/clinical/orders');
  await page.getByLabel('Buscar por paciente').fill('123456789');
  await expect(page.getByText('1 paciente(s) coinciden.')).toBeVisible();
  await page.getByLabel('Buscar por paciente').fill('sin coincidencia QA');
  await expect(page.getByText('Sin pacientes coincidentes.')).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'doctor@demo.local', 'demo-doctor');
  await page.goto('/clinical/orders');
  await expect(page.getByRole('button', { name: 'Nueva acción' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'nurse@demo.local', 'demo-nurse');
  await page.goto('/clinical/orders');
  await expect(page.getByRole('button', { name: 'Nueva acción' })).toHaveCount(0);
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

test('audit export is restricted to the audit role set', async ({ page }) => {
  await login(page);
  await page.goto('/audit');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar auditoría' }).click();
  await expect((await download).suggestedFilename()).toBe('auditoria-sintetica.csv');

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByLabel('Correo').fill('doctor@demo.local');
  await page.getByLabel('Contraseña').fill('demo-doctor');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.goto('/audit');
  await expect(page.locator('main[role="alert"]')).toContainText('Acceso restringido para el rol DOCTOR');
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
    { email: 'doctor@demo.local', password: 'demo-doctor', allowed: '/clinical', denied: '/payments' },
    { email: 'nurse@demo.local', password: 'demo-nurse', allowed: '/agenda', denied: '/audit' },
    { email: 'inventory@demo.local', password: 'demo-inventory', allowed: '/inventory', denied: '/patients' },
    { email: 'finance@demo.local', password: 'demo-finance', allowed: '/payments', denied: '/clinical' },
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

test('patient portal requires a second factor and keeps invalid access generic', async ({ page }) => {
  await page.route('**/api/portal-request-code', async (route) => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ message: 'Si el enlace es válido, enviamos un código al canal registrado.' }) }));
  await page.route('**/api/portal-status', async (route) => {
    const body = route.request().postDataJSON() as { verificationCode?: string };
    if (body.verificationCode === '12345678') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quote_id: 'Q-PORTAL-QA', status: 'SENT', updated_at: '2026-08-28T12:00:00.000Z' }) });
    return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'No fue posible validar el acceso.' }) });
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
  await page.getByLabel('Buscar por paciente').fill('123456789');
  await expect(page.getByText('Paciente Demo Aurora')).toBeVisible();
  await page.getByLabel('Buscar por paciente').fill('no existe en QA');
  await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await loginAs(page, 'nurse@demo.local', 'demo-nurse');
  await page.goto('/insurance');
  await expect(page.locator('main[role="alert"]')).toContainText('Acceso restringido para el rol NURSE');
});

test('health report search filters individual vital records without interpretation', async ({ page }) => {
  await login(page);
  await page.goto('/clinical/reports');
  await page.getByRole('tab', { name: 'Signos vitales' }).click();
  await page.getByLabel('Buscar paciente en reportes').fill('123456789');
  await expect(page.getByText('Paciente Demo Aurora')).toBeVisible();
  await page.getByLabel('Buscar paciente en reportes').fill('no existe en QA');
  await expect(page.getByText('Sin mediciones', { exact: true })).toBeVisible();
  await expect(page.getByText('sin clasificación automática')).toBeVisible();
});

test('dashboard has no automatically detectable serious accessibility violations', async ({
  page,
}) => {
  await login(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
