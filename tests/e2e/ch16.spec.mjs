import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceDir = resolve(projectRoot, "docs/parity/screenshots");

async function login(page, email = "admin@analiza.demo") {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#login-form input[name="email"]').fill(email);
  await page.locator('#login-form input[name="password"]').fill("Demo2026!");
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.getByRole("heading", { name:"Dashboard", exact:true })).toBeVisible();
}

test("CH16 administra perfiles de descuento con búsqueda, matriz y auditoría", async ({ page }) => {
  await login(page);
  await page.goto("/#/catalogos/descuentos");
  await expect(page.getByRole("heading", { name:"Descuentos y convenios", exact:true })).toBeVisible();
  for (const label of ["Perfil", "Cálculo", "Servicios", "Estudios Dx", "Medicamentos", "Insumos", "Equipos", "Honorarios", "Extras", "Elegibilidad", "Vigencia", "Control", "Estado", "Acciones"])
    await expect(page.getByRole("columnheader", { name:label, exact:true })).toBeVisible();

  await page.getByRole("button", { name:"Nuevo perfil", exact:true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('[name="name"]').fill("Perfil sintético E2E CH16");
  await dialog.locator('[name="description"]').fill("Perfil de prueba trazable");
  await dialog.locator('[name="cat-SERVICES"]').fill("12.5");
  await dialog.locator('[name="requiresApproval"]').check();
  await dialog.locator('[name="approverId"]').selectOption("USR-006");
  await dialog.getByRole("button", { name:"Crear perfil", exact:true }).click();
  await expect(page.getByRole("row", { name:/Perfil sintético E2E CH16/ })).toBeVisible();

  const search = page.locator('[data-input="discount-search"]');
  await search.fill("Perfil sintético E2E CH16");
  await expect(page.getByRole("row", { name:/Perfil sintético E2E CH16/ })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name:"Excel", exact:true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("descuentos_sinteticos.csv");
  await page.screenshot({ path:resolve(evidenceDir, "ch16-discounts-1440x900.png"), fullPage:true });

  page.once("dialog", async (prompt) => { await prompt.accept("Fin de prueba sintética"); });
  await page.getByRole("row", { name:/Perfil sintético E2E CH16/ }).getByRole("button", { name:"Inactivar", exact:true }).click();
  await expect(page.getByRole("row", { name:/Perfil sintético E2E CH16/ }).getByText("Inactivo", { exact:true })).toBeVisible();
});

test("CH16 no ofrece mutaciones a AUDITOR ni desborda en móvil", async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await login(page, "auditoria@analiza.demo");
  await page.goto("/#/catalogos/descuentos");
  await expect(page.getByRole("button", { name:"Nuevo perfil", exact:true })).toHaveCount(0);
  await expect(page.getByRole("button", { name:"Editar", exact:true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path:resolve(evidenceDir, "ch16-discounts-mobile-390x844.png"), fullPage:true });
});
