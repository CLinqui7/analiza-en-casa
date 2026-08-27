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
  await expect(page.getByRole("heading", {name:"Dashboard",exact:true})).toBeVisible();
}

test("CH15 crea, edita, inactiva e importa catálogos reales", async ({page}) => {
  await login(page);
  await page.goto("/#/catalogos/insumos");
  await expect(page.getByRole("heading",{name:"Insumos",exact:true})).toBeVisible();
  for (const label of ["SKU","Descripción","Tipo / categoría","Unidad","Costo","Precio","Impuesto","Descuento","Trazabilidad","Estado","Acciones"])
    await expect(page.getByRole("columnheader",{name:label,exact:true})).toBeVisible();

  await page.getByRole("button",{name:"Nuevo ítem",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.locator('[name="sku"]').fill("CH15-E2E-001");
  await dialog.locator('[name="name"]').fill("Insumo sintético E2E");
  await dialog.locator('[name="description"]').fill("Descripción sintética E2E");
  await dialog.locator('[name="manufacturer"]').fill("Fabricante sintético");
  await dialog.getByRole("button",{name:"Crear ítem",exact:true}).click();
  await expect(page.getByText("Insumo sintético E2E",{exact:true})).toBeVisible();

  const row=page.getByRole("row",{name:/CH15-E2E-001/});
  await row.getByRole("button",{name:"Editar",exact:true}).click();
  await dialog.locator('[name="name"]').fill("Insumo sintético actualizado");
  await dialog.getByRole("button",{name:"Guardar cambios",exact:true}).click();
  await expect(page.getByText("Insumo sintético actualizado",{exact:true})).toBeVisible();

  page.once("dialog", async (prompt) => { await prompt.accept("Fin de vigencia sintética"); });
  await page.getByRole("row",{name:/CH15-E2E-001/}).getByRole("button",{name:"Inactivar",exact:true}).click();
  await expect(page.getByRole("row",{name:/CH15-E2E-001/}).getByText("Inactivo",{exact:true})).toBeVisible();

  await page.getByRole("button",{name:"Importar CSV",exact:true}).click();
  await dialog.locator("#catalog-import-file").setInputFiles({name:"catalogo-sintetico.csv",mimeType:"text/csv",buffer:Buffer.from("sku,name,unit,description\nCH15-CSV-E2E,Insumo CSV sintético,unidad,Descripción CSV")});
  await expect(dialog.getByText(/1 válidas de 1/)).toBeVisible();
  await dialog.getByRole("button",{name:"Confirmar importación",exact:true}).click();
  await expect(page.getByText("Insumo CSV sintético",{exact:true})).toBeVisible();
  await page.screenshot({path:resolve(evidenceDir,"ch15-catalogs-1440x900.png"),fullPage:true});
});

test("CH15 oculta mutaciones de catálogo a AUDITOR y no desborda móvil", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await login(page,"auditoria@analiza.demo");
  await page.goto("/#/catalogos/insumos");
  await expect(page.getByRole("button",{name:"Nuevo ítem",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Importar CSV",exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:resolve(evidenceDir,"ch15-catalogs-mobile-390x844.png"),fullPage:true});
});
