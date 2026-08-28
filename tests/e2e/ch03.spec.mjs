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

test("CH03 reproduce panel, pestañas, filtros y tabla de hospitalizaciones", async ({ page }) => {
  await login(page);
  await page.goto("/#/hospitalizaciones");
  await expect(page.getByRole("heading", { level: 1, name: "Hospitalización", exact: true })).toBeVisible();
  await expect(page.getByText("Relación de pacientes por empresa", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activos", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: /PIC Ejecución/ })).toContainText("—");
  for (const heading of ["Hospitalización", "DUI/NIT", "Paciente", "Empresa", "Tipo Cuenta", "Administrativo", "Duración"])
    await expect(page.getByRole("columnheader", { name: heading, exact: true })).toBeVisible();
  await page.locator('select[data-ui-filter="caseAccountType"]').selectOption("SEGURO");
  await page.getByRole("button", { name: /Aplicar/, exact: false }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator(".toast button").click().catch(() => {});
  await page.screenshot({ path: resolve(evidenceDir, "ch03-hospitalizations-1440x900.png"), fullPage: true });
});

test("CH03 muestra seguimiento de cotizaciones y datos iniciales al crear", async ({ page }) => {
  await login(page);
  await page.goto("/#/hospitalizaciones");
  await page.getByRole("button", { name: "Cotizaciones", exact: true }).click();
  for (const heading of ["Paciente", "DUI/NIT", "Nro.", "Estado", "Envío preautorización", "Respuesta seguro", "Envío de reclamo", "Creación", "Total"])
    await expect(page.getByRole("columnheader", { name: heading, exact: true })).toBeVisible();
  await expect(page.getByText("Regla pendiente", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Nuevo", exact: true }).click();
  await expect(page).toHaveURL(/#\/cotizaciones\/nueva$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Nueva cotización", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Datos del paciente", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Datos de la factura", exact: true })).toBeVisible();
  for (const selector of ['input[name="patientSearch"]', 'input[name="patientDocument"]', 'input[name="patientPhone"]', 'input[name="patientEmail"]', 'input[name="invoiceDate"]', 'select[name="discountGroupId"]', 'input[name="referralCandidate"]', 'input[name="giftcard"]', 'textarea[name="comments"]'])
    await expect(page.locator(selector)).toBeVisible();
  for (const selector of ['input[name="patientDocument"]', 'input[name="patientPhone"]', 'input[name="patientEmail"]'])
    await expect(page.locator(selector)).toBeDisabled();
  await expect(page.locator('input[name="invoiceDate"]')).not.toHaveValue("");
  await expect(page.locator('select[name="discountGroupId"]')).toHaveValue("REGULAR");
  await page.locator(".toast button").click().catch(() => {});
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: resolve(evidenceDir, "ch03-new-quote-1440x900.png"), fullPage: true });
});

test("CH03 mantiene panel y pestañas utilizables en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/#/hospitalizaciones");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Activos", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cotizaciones", exact: true })).toBeVisible();
  await page.locator(".toast button").click().catch(() => {});
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: resolve(evidenceDir, "ch03-hospitalizations-mobile-390x844.png"), fullPage: true });
});
