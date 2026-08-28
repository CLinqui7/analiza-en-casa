import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceDir = resolve(projectRoot, "docs/parity/screenshots");

async function loginToQuotes(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#login-form input[name="email"]').fill("admin@analiza.demo");
  await page.locator('#login-form input[name="password"]').fill("Demo2026!");
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.goto("/#/hospitalizaciones");
  await page.getByRole("button", { name: "Cotizaciones", exact: true }).click();
}

test("CH07 busca por paciente o documento y expone el menú contextual observado", async ({ page }) => {
  await loginToQuotes(page);
  const search = page.locator('[data-ui-search]');
  await search.fill("Elena Morales");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText("00000000-1", { exact: true })).toBeVisible();
  await search.fill("00000000-1");
  await expect(page.getByText("Elena Morales", { exact: true })).toBeVisible();

  await page.getByLabel("Abrir acciones de QT-2026-0148").click();
  for (const label of ["Nueva versión", "Duplicar", "Versiones", "Envíos al seguro", "Historial de envíos", "Eliminar"])
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  await expect(page.locator(".quote-row-submenu > summary", { hasText: "Imprimir" })).toBeVisible();
  await expect(page.locator(".quote-row-submenu > summary", { hasText: "Enviar" })).toBeVisible();
  await page.locator(".quote-row-submenu > summary", { hasText: "Imprimir" }).click();
  for (const label of ["Excel", "Detalle de servicio", "Cotización", "Factura", "Cotización internacional", "Factura internacional"])
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: resolve(evidenceDir, "ch07-quote-row-menu-1440x900.png"), fullPage: true });
});

test("CH07 registra respuesta de seguro sin alterar la distribución financiera", async ({ page }) => {
  await loginToQuotes(page);
  await page.locator('[data-ui-search]').fill("Roberto Cáceres");
  const totalBefore = await page.locator("tbody tr").first().locator("td").last().textContent();
  await page.locator(".interactive-badge").click();
  await page.locator('#insurance-form select[name="status"]').selectOption("INFO_REQUIRED");
  await page.locator('#insurance-form input[name="approvedAmount"]').fill("125");
  await page.locator('#insurance-form textarea[name="note"]').fill("Solicitud administrativa sintética CH07.");
  await page.locator('#insurance-form input[name="claimNumber"]').fill("SYN-E2E-CH07");
  await page.getByRole("button", { name: "Guardar y notificar", exact: true }).click();
  await expect(page.getByText("Estado de seguro actualizado.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody tr").first().locator("td").last()).toHaveText(totalBefore.trim());
});

test("CH07 mantiene tabla y menú utilizables en móvil sin overflow global", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginToQuotes(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByLabel(/Abrir acciones de/).first().click();
  await expect(page.getByText("Envíos al seguro", { exact: true }).first()).toBeVisible();
});
