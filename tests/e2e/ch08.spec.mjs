import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceDir = resolve(projectRoot, "docs/parity/screenshots");

async function login(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#login-form input[name="email"]').fill("admin@analiza.demo");
  await page.locator('#login-form input[name="password"]').fill("Demo2026!");
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
}

test("CH08 ofrece cuentas, búsqueda, menú por hospitalización y generador de estado", async ({ page }) => {
  await login(page);
  await page.goto("/#/cuentas-por-cobrar");
  await expect(page.getByRole("heading", { name: "Cuentas por cobrar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cuentas/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pagos/ })).toBeVisible();
  for (const label of ["Excel con filtros", "Reporte", "Excel"])
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();

  const search = page.getByPlaceholder("Paciente, documento u hospitalización");
  await search.fill("Elena Morales");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel(/Acciones de/).click();
  for (const label of ["Ver cotizaciones", "Estados de cuenta", "Ver pagos", "Archivar", "Registro XPO"])
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: resolve(evidenceDir, "ch08-receivables-menu-1440x900.png"), fullPage: true });

  await page.getByRole("button", { name: "Reporte", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Estado de cuenta", exact: true })).toBeVisible();
  await expect(page.locator('#account-statement-form select[name="statementType"]')).toContainText("Paciente");
  await page.getByRole("button", { name: "Vista previa", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Cuentas por cobrar", exact: true })).toBeVisible();
  for (const label of ["Cotizaciones", "Pagos", "Documentos"])
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen del pago", exact: true })).toBeVisible();
  await expect(page.getByText("Total pendientes", { exact: true })).toBeVisible();
});

test("CH08 crea perfil administrativo desde Poner en ejecución", async ({ page }) => {
  await login(page);
  await page.goto("/#/hospitalizaciones");
  await page.getByRole("button", { name: "Cotizaciones", exact: true }).click();
  await page.getByLabel(/Abrir acciones de/).first().click();
  await page.locator('[data-action="open-administrative-execution"]').first().click();
  await expect(page.getByRole("heading", { name: "Perfil administrativo de ejecución", exact: true })).toBeVisible();
  await page.locator('input[name="referredBy"]').fill("Referencia sintética CH08");
  await page.locator('input[name="revenueType"]').fill("Catálogo sintético CH08");
  await page.locator('input[name="paymentForm"]').fill("Forma sintética CH08");
  await page.locator('input[name="requestType"]').fill("Solicitud sintética CH08");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Perfil administrativo de ejecución creado y auditado.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("CH08 revierte un pago con motivo, conserva el registro y funciona en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/#/cuentas-por-cobrar");
  await page.getByRole("button", { name: /^Pagos/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const appliedRow = page.locator("tbody tr", { hasText: "Aplicado" }).first();
  await appliedRow.getByLabel(/Acciones del pago/).click();
  await expect(appliedRow.getByText("Editar pago", { exact: true })).toBeVisible();
  await expect(appliedRow.getByText("Eliminar pagos", { exact: true })).toBeVisible();
  await appliedRow.getByRole("button", { name: "Revertir pago", exact: true }).click();
  await page.locator('#reverse-payment-form textarea[name="reason"]').fill("Corrección financiera sintética CH08");
  await page.getByRole("button", { name: "Revertir y conservar historial", exact: true }).click();
  await expect(page.getByText("Pago revertido; el comprobante original se conservó.", { exact: true })).toBeVisible();
  await expect(page.getByText("Reversado", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: resolve(evidenceDir, "ch08-receivables-payments-390x844.png"), fullPage: true });
});
