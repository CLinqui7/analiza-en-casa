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

test("CH11 filtra la agenda, crea una visita y confirma la asignación", async ({page}) => {
  await login(page);
  await page.goto("/#/agenda");
  await expect(page.getByRole("heading",{name:"Agenda",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Detalles de visitas",exact:true})).toBeVisible();
  for (const label of ["Mes","Semana","Lista por semana","Lista por día"])
    await expect(page.getByRole("button",{name:label,exact:true})).toBeVisible();
  await page.locator("[data-agenda-patient]").selectOption({index:1});
  await page.getByRole("button",{name:"Crear",exact:true}).click();
  const form=page.locator("#shift-form");
  await expect(page.getByRole("dialog").getByRole("heading",{name:"Crear turno a paciente",exact:true})).toBeVisible();
  await expect(form.locator('[name="patientName"]')).not.toHaveValue("—");
  await form.locator('[name="start"]').fill("2026-08-28T06:00");
  await form.locator('[name="end"]').fill("2026-08-28T18:00");
  await form.locator('[name="classification"]').selectOption("TURNO");
  await form.locator('[name="type"]').selectOption("NURSING_CARE");
  await page.getByRole("button",{name:"Guardar",exact:true}).click();
  await expect(page.getByText("Visita guardada en agenda.",{exact:true})).toBeVisible();
  const event=page.locator('button[data-action="open-visit-detail"]').filter({hasText:"Elena Morales"}).first();
  await expect(event).toBeVisible();
  await event.click();
  const detail=page.locator("#visit-detail-form");
  await expect(page.getByRole("dialog").getByText("Actualizaciones",{exact:true})).toBeVisible();
  await detail.locator('[name="resourceId"]').selectOption({index:1});
  await detail.locator('[name="internalObservations"]').fill("Observación sintética CH11 E2E");
  await page.getByRole("button",{name:"Guardar",exact:true}).click();
  await expect(page.getByText("Asignación de visita guardada y auditada.",{exact:true})).toBeVisible();
  await prepareEvidenceScreenshot(page);
  await page.screenshot({path:resolve(evidenceDir,"ch11-agenda-1440x900.png"),fullPage:true});
});

test("CH11 mantiene controles utilizables y sin overflow global en móvil", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await login(page);
  await page.goto("/#/agenda");
  await page.getByRole("button",{name:"Lista por semana",exact:true}).click();
  await expect(page.locator('.agenda-list[data-view="week-list"]')).toBeVisible();
  await expect(page.getByRole("button",{name:"Eliminar visitas",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Eliminar visitas",exact:true}).click();
  await expect(page.getByText(/permanece deshabilitado/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await prepareEvidenceScreenshot(page);
  await page.screenshot({path:resolve(evidenceDir,"ch11-agenda-mobile-390x844.png"),fullPage:true});
});
