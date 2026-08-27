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
  await expect(page.getByRole("heading", { name:"Dashboard", exact:true })).toBeVisible();
  await page.goto("/#/cotizaciones/nueva");
}

async function addFirstItem(page, category, quantity = "1") {
  await page.getByRole("button", { name:category, exact:true }).click();
  const option = await page.locator("#quote-item-options option").first().getAttribute("value");
  await page.locator("#quote-item-search").fill(option);
  await page.locator("#quote-item-search").dispatchEvent("change");
  await page.locator("#quote-item-qty").fill(quantity);
  await page.getByRole("button", { name:/Añadir/ }).click();
  await expect(page.getByText("Procesando...", { exact:true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name:category, exact:true })).toBeVisible();
}

test("CH06 añade Insumos, Estudios Dx y Honorarios con catálogo enriquecido", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name:"Insumos", exact:true }).click();
  await expect(page.locator("#quote-item-options option").first()).toHaveAttribute("value", /Fabricante sintético/);
  await addFirstItem(page, "Insumos", "2");
  await addFirstItem(page, "Estudios Dx", "1");
  await page.getByRole("button", { name:"Honorarios", exact:true }).click();
  await expect(page.locator("#quote-item-options option").first()).toHaveAttribute("value", /Dra\. Valeria Núñez/);
  await addFirstItem(page, "Honorarios", "1");
  await expect(page.locator(".quote-ledger tbody tr:not(.quote-ledger-group)")).toHaveCount(3);
  await page.screenshot({ path:resolve(evidenceDir, "ch06-quote-categories-1440x900.png"), fullPage:true });
});

test("CH06 recalcula descuentos por categoría y guarda tras validación", async ({ page }) => {
  await login(page);
  await addFirstItem(page, "Servicios", "1");
  await addFirstItem(page, "Estudios Dx", "1");
  await page.locator('select[name="discountGroupId"]').selectOption("DISC-002");
  await page.locator('input[name="discountReason"]').fill("Motivo sintético autorizado");
  await page.locator('input[name="discountReason"]').dispatchEvent("change");
  await expect(page.locator('input[disabled][value*="Servicios 10%"]')).toBeVisible();
  await expect(page.locator(".quote-ledger tbody tr:not(.quote-ledger-group)").first().getByText("10.00%", { exact:true })).toBeVisible();
  await page.getByTitle("Agregar referencia provisional").click();
  await page.locator('#quote-referral-form input[name="label"]').fill("Referencia sintética CH06");
  await page.getByRole("button", { name:"Agregar", exact:true }).click();
  await page.locator('textarea[name="comments"]').fill("Comentario administrativo sintético CH06");
  const saveButton = page.getByRole("button", { name:"Guardar cotización", exact:true }).first();
  await saveButton.click();
  await expect(page).toHaveURL(/#\/cotizaciones\/QT-/);
  await expect(page.getByRole("heading", { name:/^QT-\d{4}-\d{4} · versión 1$/ })).toBeVisible();
});

test("CH06 mantiene categorías y ledger sin overflow global en móvil", async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await login(page);
  await addFirstItem(page, "Insumos", "1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name:"Extras", exact:true })).toBeVisible();
});
