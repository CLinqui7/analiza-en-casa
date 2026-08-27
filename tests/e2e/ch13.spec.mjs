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
  await expect(page.getByRole("heading", {name:"Dashboard",exact:true})).toBeVisible();
}

async function prepareEvidenceScreenshot(page) {
  const closeButtons = page.locator(".toast button");
  while (await closeButtons.count()) await closeButtons.first().click();
  await page.evaluate(()=>window.scrollTo(0,0));
}

async function addLine(page, {petty = false} = {}) {
  const form = page.locator("#purchase-form");
  await form.locator('[name="catalogItemId"]').selectOption({index:1});
  if (!petty) await form.locator('[name="lineSupplierId"]').selectOption({index:1});
  await form.locator('[name="presentation"]').fill("Caja sintética CH13");
  await form.locator('[name="unitCost"]').fill("10");
  await form.locator('[name="quantity"]').fill("2");
  if (petty) {
    await form.locator('[name="taxAmount"]').fill("1.50");
    await form.locator('[name="discountAmount"]').fill("0.75");
  }
  await page.getByRole("button",{name:"Añadir",exact:true}).click();
  await expect(page.locator("#purchase-form tbody tr")).toContainText("Caja sintética CH13");
}

test("CH13 reproduce listado, dos modalidades, detalle y acciones seguras", async ({page}) => {
  await login(page);
  await page.goto("/#/compras");
  await expect(page.getByRole("heading",{name:"Compras",exact:true,level:1})).toBeVisible();
  for (const heading of ["Acciones","Tipo","Número","Proveedor","Total","# Factura","Fecha","Estado","Registro PT"])
    await expect(page.getByRole("columnheader",{name:heading,exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Excel",exact:true})).toBeVisible();
  await expect(page.locator('[data-input="purchase-search"]')).toBeVisible();

  await page.getByRole("button",{name:"Nuevo",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("heading",{name:"¿Qué quieres crear?",exact:true})).toBeVisible();
  await page.getByRole("button",{name:/Orden de compra/}).click();
  await expect(page.getByRole("dialog").getByRole("heading",{name:"Nueva compra",exact:true})).toBeVisible();
  const orderForm = page.locator("#purchase-form");
  await orderForm.locator('[name="invoiceNumber"]').fill("FAC-SINTETICA-ORDEN-13");
  await orderForm.locator('[name="observations"]').fill("Orden sintética CH13");
  await addLine(page);
  await page.getByRole("button",{name:"Guardar borrador",exact:true}).click();
  await expect(page.getByText(/Borrador de compra confirmado y auditado/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody tr").first()).toContainText("FAC-SINTETICA-ORDEN-13");

  await page.locator('button.table-link-button[data-action="open-purchase-details"]').first().click();
  await expect(page.getByRole("dialog").getByRole("heading",{name:"Detalles de compra",exact:true})).toBeVisible();
  for (const label of ["# Orden","# Factura","Categoría","Proveedor","Observaciones","Archivos adjuntos"])
    await expect(page.getByRole("dialog").getByText(label,{exact:true})).toBeVisible();
  await page.getByRole("dialog").getByRole("button",{name:"Cerrar",exact:true}).click();

  await page.getByRole("button",{name:"Nuevo",exact:true}).click();
  await page.getByRole("button",{name:/Caja menuda/}).click();
  await expect(page.getByRole("dialog").getByRole("heading",{name:"Nueva compra caja menuda",exact:true})).toBeVisible();
  const pettyForm = page.locator("#purchase-form");
  await pettyForm.locator('[name="headerSupplierId"]').selectOption({index:1});
  await pettyForm.locator('[name="invoiceNumber"]').fill("FAC-SINTETICA-CAJA-13");
  await expect(pettyForm.locator('[type="file"]')).toBeDisabled();
  await addLine(page,{petty:true});
  await pettyForm.locator('[name="extraAmount"]').fill("2.25");
  await expect(page.locator('[data-purchase-total="total"]')).toContainText("23.00");
  await prepareEvidenceScreenshot(page);
  await page.waitForTimeout(250);
  await page.locator(".modal-body").evaluate((element)=>{ element.scrollTop=0; });
  await page.screenshot({path:resolve(evidenceDir,"ch13-purchase-composer-1440x900.png"),fullPage:true});
  await pettyForm.locator('[name="extraAmount"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(evidenceDir,"ch13-purchase-totals-1440x900.png"),fullPage:true});
  await page.getByRole("button",{name:"Guardar borrador",exact:true}).click();
  await expect(page.locator("tbody tr").first()).toContainText("Caja menuda");

  const rowMenu = page.locator(".purchase-row-menu").first();
  await rowMenu.locator("summary").click();
  for (const label of ["Ver","Editar detalles","Copiar","Imprimir PDF","Imprimir con montos","Imprimir en Excel","Anular"])
    await expect(rowMenu.getByRole("button",{name:label,exact:true})).toBeVisible();
  await rowMenu.getByRole("button",{name:"Anular",exact:true}).click();
  await expect(page.getByText(/Anular permanece bloqueada/)).toBeVisible();

  await page.locator('[data-input="purchase-search"]').fill("FAC-SINTETICA-CAJA-13");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await prepareEvidenceScreenshot(page);
  await page.screenshot({path:resolve(evidenceDir,"ch13-purchases-1440x900.png"),fullPage:true});
});

test("CH13 mantiene tabla y formularios utilizables sin overflow global en móvil", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await login(page);
  await page.goto("/#/compras");
  await expect(page.locator(".purchase-table-tools")).toBeVisible();
  expect(await page.locator(".table-wrap").first().evaluate((wrap)=>wrap.scrollWidth>wrap.clientWidth)).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button",{name:"Nuevo",exact:true}).click();
  await expect(page.locator(".purchase-kind-grid")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await prepareEvidenceScreenshot(page);
  await page.screenshot({path:resolve(evidenceDir,"ch13-purchases-mobile-390x844.png"),fullPage:true});
});
