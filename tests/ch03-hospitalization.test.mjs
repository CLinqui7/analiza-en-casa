import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore, DEMO_PASSWORD } from "../app/store.js";
import { safeStorage } from "../app/domain.js";

const config = { dataMode: "mock", notificationsMode: "mock" };

test("CH03 crea y actualiza hospitalizaciones sólo dentro de la organización", async () => {
  safeStorage.clear();
  const store = await createAppStore(config);
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  const patient = store.getState().patients[0];
  const record = store.createCase({ patientId: patient.id, accountType: "PARTICULAR", startDate: "2026-08-27" });
  assert.equal(record.organizationId, store.getState().organization.id);
  store.updateCase(record.id, { manager: "Responsable Sintético" });
  assert.equal(store.caseById(record.id).manager, "Responsable Sintético");
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "CREATE_CASE" && entry.entity === record.id));
  const catalogItem = store.getState().catalogItems[0];
  const quote = store.createQuote({
    caseId: record.id,
    items: [{ catalogItemId: catalogItem.id, category: catalogItem.category, name: catalogItem.name, quantity: 1, unitPrice: catalogItem.price }],
    invoiceDate: "2026-08-27",
    discountGroupId: "REGULAR",
    referredBy: "Referencia sintética",
    giftcard: "",
    comments: "Comentario administrativo sintético"
  });
  assert.equal(quote.patientId, patient.id);
  assert.equal(quote.invoiceDate, "2026-08-27");
  assert.equal(quote.discountGroupId, "REGULAR");
  assert.equal(quote.referredBy, "Referencia sintética");
  assert.equal(quote.comments, "Comentario administrativo sintético");
  record.organizationId = "ORG-AJENA";
  store.caseById(record.id).organizationId = "ORG-AJENA";
  assert.throws(() => store.updateCase(record.id, { manager: "Cruce" }), /no disponible/i);
  safeStorage.clear();
});

test("CH03 bloquea hospitalizaciones ajenas al cotizar y roles sin escritura", async () => {
  safeStorage.clear();
  const store = await createAppStore(config);
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  const record = store.getState().cases[0];
  record.organizationId = "ORG-AJENA";
  assert.throws(() => store.createQuote({
    caseId: record.id,
    items: [{ category: "SERVICES", name: "Servicio sintético", quantity: 1, unitPrice: 1 }]
  }), /no disponible/i);
  await store.authenticate("auditoria@analiza.demo", DEMO_PASSWORD);
  assert.throws(() => store.createCase({ patientId: store.getState().patients[0].id }), /no tiene permiso/i);
  safeStorage.clear();
});

test("CH03 conserva estructura, filtros, columnas y datos iniciales de cotización observados", async () => {
  const [views, main] = await Promise.all([
    readFile(new URL("../app/views.js", import.meta.url), "utf8"),
    readFile(new URL("../app/main.js", import.meta.url), "utf8")
  ]);
  for (const label of [
    "Relación de pacientes por empresa", "Activos", "Cotizaciones", "PIC Ejecución",
    "Estado Administrativo", "Fecha de inicio", "Tipo de cuenta", "Aplicar", "Limpiar",
    "Hospitalización", "DUI/NIT", "Paciente", "Empresa", "Tipo Cuenta", "Administrativo", "Duración",
    "Envío preautorización", "Respuesta seguro", "Envío de reclamo", "Creación", "Total"
  ]) assert.ok(views.includes(label), `Falta requisito CH03: ${label}`);
  for (const label of ["Datos del paciente", "Datos de la factura", "Grupo de descuento", "Referido por", "Giftcard", "Comentarios"])
    assert.ok(main.includes(label), `Falta dato de cotización CH03: ${label}`);
  for (const label of ["patientSearch", "patientId", "patientDocument", "patientPhone", "patientEmail", "cotizaciones/nueva"])
    assert.ok(main.includes(label), `Falta contrato de página de cotización CH03: ${label}`);
  assert.doesNotMatch(views, /sentToInsurer/);
  assert.match(views, /preauthorizationSentAt/);
  assert.match(views, /Regla pendiente/);
  assert.match(views, /CH03-Q003/);
  assert.match(main, /CH03-Q007/);
});
