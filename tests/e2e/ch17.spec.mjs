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

test("CH17 recorre el reporte detallado, sus secciones y selección de impresión", async ({ page }) => {
  await login(page);
  await page.goto("/#/clinica/reportes");
  await expect(page.getByRole("heading", { name: "Reporte de salud", exact: true })).toBeVisible();
  await page.locator('[data-input="health-report-search"]').fill("HOS-2026-0190");
  await page.getByRole("link", { name: "HOS-2026-0190", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Reporte de salud del/ })).toBeVisible();

  await page.getByRole("button", { name: "Información Principal", exact: true }).click();
  const insurance = page.getByLabel(/Incluir seguro .* al imprimir/);
  if (await insurance.count()) await insurance.check();

  await page.getByRole("button", { name: "Evaluación Clínica", exact: true }).click();
  for (const name of ["Antecedentes y evaluaciones", "Signos vitales", "Perfiles clínicos", "Notas de evolución", "Interconsultas", "Notas de enfermería", "Bitácoras"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Signos vitales", exact: true }).click();
  await expect(page.getByText("Registros clínicos de signos vitales", { exact: true })).toBeVisible();
  await expect(page.getByText("Signos cargados por el paciente", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Notas de enfermería", exact: true }).click();
  await expect(page.locator('[data-input="health-report-nursing-search"]')).toBeVisible();
  await page.locator('[data-input="health-report-nursing-search"]').fill("sin coincidencia");
  await expect(page.getByRole("heading", { name: "Sin resultados", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Imprimir", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Configuration report", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bajar Información principal y seguros", exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: resolve(evidenceDir, "ch17-health-report-1440x900.png"), fullPage: true });
});
