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
  await page.goto("/#/cotizaciones/nueva");
}

test("CH05 busca servicio, recupera sin resultados y añade con procesamiento", async ({ page }) => {
  await login(page);
  const search = page.locator("#quote-item-search");
  await search.fill("Sin coincidencia sintética");
  await search.dispatchEvent("change");
  await expect(page.getByText("No results found", { exact: true })).toBeVisible();
  const option = await page.locator("#quote-item-options option").first().getAttribute("value");
  await page.locator("#quote-item-search").fill(option);
  await page.locator("#quote-item-search").dispatchEvent("change");
  await expect(page.locator("#quote-item-price")).not.toHaveValue("");
  await page.locator("#quote-item-qty").fill("2");
  await page.getByRole("button", { name: /Añadir/ }).click();
  await expect(page.getByText("Procesando...", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Servicios", exact: true })).toBeVisible();
  for (const heading of ["Tipo", "Código", "Item", "Cantidad", "Precio", "Subtotal", "Desc. %", "Desc. $", "Impuesto", "Total"])
    await expect(page.getByRole("columnheader", { name: heading, exact: true })).toBeVisible();
  await expect(page.locator("#quote-item-search")).toHaveValue("");
  const secondOption = await page.locator("#quote-item-options option").nth(1).getAttribute("value");
  await page.locator("#quote-item-search").fill(secondOption);
  await page.locator("#quote-item-search").dispatchEvent("change");
  await page.locator("#quote-item-qty").fill("1");
  await page.getByRole("button", { name: /Añadir/ }).click();
  await expect(page.locator(".quote-ledger tbody tr:not(.quote-ledger-group)")).toHaveCount(2);
  const itemFilter = page.getByLabel("Filtrar por Item");
  await expect(itemFilter.locator("option")).toHaveCount(3);
  await itemFilter.selectOption({ index: 1 });
  await expect(page.locator(".quote-ledger tbody tr:not(.quote-ledger-group)")).toHaveCount(1);
});

test("CH05 compone medicamento sin convertir conteos o dosis en reglas", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Medicamentos", exact: true }).click();
  const option = await page.locator("#quote-item-options option").first().getAttribute("value");
  await page.locator("#quote-item-search").fill(option);
  await page.locator("#quote-item-search").dispatchEvent("change");
  await page.locator("#quote-item-qty").fill("1");
  await page.getByRole("button", { name: /Añadir/ }).click();
  await expect(page.getByText("Procesando...", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Medicamentos", exact: true })).toBeVisible();
  await expect(page.getByText("Impuesto", { exact: true }).last()).toBeVisible();
  await page.locator(".toast").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: resolve(evidenceDir, "ch05-quote-medications-1440x900.png"), fullPage: true });
});

test("CH05 mantiene compositor y ledger dentro del ancho móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Medicamentos", exact: true })).toBeVisible();
});
