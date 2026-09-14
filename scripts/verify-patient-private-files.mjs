import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const base='http://localhost:3110';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const documentId=`QA-FILES-${Date.now()}`;
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function login(target) {
  await target.goto(`${base}/login`);
  await target.getByLabel('Usuario o correo').fill(process.env.MONGODB_INITIAL_ADMIN_EMAIL);
  await target.getByLabel('Clave',{exact:true}).fill(process.env.MONGODB_INITIAL_ADMIN_PASSWORD);
  await target.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
  await target.waitForURL('**/dashboard');
}
try {
  await login(page); await page.goto(`${base}/patients`); await page.waitForLoadState('networkidle');
  await page.locator('[data-action-id="PATIENT-CREATE"]').click();
  const dialog=page.getByRole('dialog',{name:'Agregar paciente'});
  await dialog.getByLabel('Tipo de documento').selectOption('OTHER');
  await dialog.getByLabel('Número de documento').fill(documentId);
  await dialog.getByLabel('Nombre completo').fill('Paciente QA Documentos Privados');
  await dialog.getByLabel('Fecha de nacimiento').fill('1990-01-01');
  await dialog.getByLabel('Femenino').check();
  await dialog.getByLabel('Teléfono celular').fill('7000-0000');
  await dialog.getByLabel('Empresa').fill('Empresa demo');
  await dialog.getByRole('option',{name:'Empresa demo',exact:true}).click();
  await dialog.getByRole('textbox',{name:'Dirección obligatorio',exact:true}).fill('Dirección ficticia QA');
  await dialog.getByLabel('Comentarios relevantes de la dirección').fill('QA documentos sintéticos, imágenes de un píxel.');
  await dialog.locator('[data-action-id="PATIENT-IDENTITY-ATTACHMENTS"]').setInputFiles({name:'QA-identidad-pixel.png',mimeType:'image/png',buffer:bytes});
  await dialog.locator('[data-action-id="PATIENT-RESPONSIBLE-ATTACHMENTS"]').setInputFiles({name:'QA-responsable-pixel.png',mimeType:'image/png',buffer:bytes});
  await dialog.locator('[data-action-id="PATIENT-SAVE"]').click();
  await dialog.waitFor({state:'hidden'});
  await page.getByText('Paciente Paciente QA Documentos Privados registrado.',{exact:true}).waitFor();
  const { patients }=await (await context.request.get(`${base}/api/workspace`)).json();
  const patient=patients.find(row=>row.documentId===documentId); assert.ok(patient);
  const another=await browser.newContext(); await login(await another.newPage());
  const files=await (await another.request.get(`${base}/api/files?ownerType=patient&ownerId=${patient.id}`)).json();
  assert.equal(files.length,2); assert.ok(files.some(f=>f.name.startsWith('Responsable - ')));
  for(const file of files) {
    const download=await another.request.get(`${base}/api/files/${file.id}`);
    assert.equal(download.status(),200); assert.deepEqual(await download.body(),bytes);
  }
  await another.close(); assert.deepEqual(errors,[]);
  const report={verifiedAt:new Date().toISOString(),provider:'mongodb',documentId,files:2,createdThroughReact:true,privateBytesReadFromFreshSession:true,browserErrors:errors};
  await writeFile('.local/mongo-verification/patient-files-browser-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
} finally {await browser.close();}
