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
  for (const close of await page.locator(".toast button").all()) await close.click().catch(()=>{});
  await page.waitForTimeout(150);
}

test("CH14 reproduce inventario, historial, acuses, cierres y catálogos seguros", async ({page}) => {
  await login(page);
  await page.goto("/#/inventario");
  await expect(page.getByRole("heading",{name:"Gestión de inventario",exact:true})).toBeVisible();
  for (const label of ["Items","Movimientos","Comprometido","Lotes"])
    await expect(page.getByRole("link",{name:label,exact:true})).toBeVisible();
  for (const label of ["Acciones","Tipo","Código","Nombre","Disp","Comp","Total"])
    await expect(page.getByRole("columnheader",{name:label,exact:true})).toBeVisible();
  await page.locator(".inventory-row-menu summary").first().click();
  await page.getByRole("button",{name:"Ver movimientos",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("heading",{name:"Movimientos de item",exact:true})).toBeVisible();
  for (const label of ["Rango de fechas","Lote / Serie","Origen","Destino","Cantidad","Movimiento","Estado"])
    await expect(page.getByRole("dialog").getByText(label,{exact:true})).toBeVisible();
  await page.getByRole("dialog").getByRole("button",{name:"Cerrar",exact:true}).click();

  await page.goto("/#/inventario/comprometidos");
  for (const label of ["Pacientes","Recursos","No disponible","Solicitudes","Tareas"])
    await expect(page.getByRole("button",{name:new RegExp(`^${label}`)})).toBeVisible();
  await page.locator("tbody details summary").first().click();
  await page.getByRole("button",{name:"Nuevo",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("heading",{name:"Acuse nuevo",exact:true})).toBeVisible();
  for (const label of ["Información del Acuse","Información del Items a entregar"])
    await expect(page.getByRole("dialog").getByText(label,{exact:true})).toBeVisible();
  for (const label of ["Paciente","Fecha","Hospitalización","Bodega","Item","Cantidad disponible","Cantidad a asignar"])
    await expect(page.getByRole("dialog").locator("label",{hasText:label}).first()).toBeVisible();
  for (const label of ["Vaciar","Plantilla","Añadir"])
    await expect(page.getByRole("dialog").getByRole("button",{name:label,exact:true})).toBeVisible();
  await page.getByRole("dialog").getByRole("button",{name:"Cerrar",exact:true}).click();

  await page.goto("/#/inventario/cierres");
  for (const label of ["Pendientes","Cierres totales","Cerrados","Recursos"])
    await expect(page.getByRole("button",{name:new RegExp(`^${label}`)})).toBeVisible();
  await page.locator('button[data-action="open-closure-warning"]').first().click();
  await expect(page.getByRole("dialog").getByRole("heading",{name:"Advertencia",exact:true})).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button",{name:"Cancelar",exact:true})).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button",{name:"Aceptar",exact:true})).toBeVisible();
  await page.getByRole("dialog").getByRole("button",{name:"Cancelar",exact:true}).click();

  for (const [path,heading] of [["proveedores","Inventario / Proveedores"],["bodegas","Items / Bodegas"],["lotes","Inventario: Lotes y números de serie"],["kits","Inventario / Kit de insumos"]]) {
    await page.goto(`/#/inventario/${path}`);
    await expect(page.getByRole("heading",{name:heading,exact:true})).toBeVisible();
  }
  await page.goto("/#/inventario");
  await prepareEvidenceScreenshot(page);
  await page.screenshot({path:resolve(evidenceDir,"ch14-inventory-1440x900.png"),fullPage:true});
});

test("CH14 mantiene tablas y pestañas sin overflow global en móvil", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await login(page);
  await page.goto("/#/inventario/comprometidos");
  await expect(page.locator(".inventory-subtabs")).toBeVisible();
  expect(await page.locator(".table-wrap").first().evaluate((wrap)=>wrap.scrollWidth>wrap.clientWidth)).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await prepareEvidenceScreenshot(page);
  await page.screenshot({path:resolve(evidenceDir,"ch14-acknowledgements-mobile-390x844.png"),fullPage:true});
});
