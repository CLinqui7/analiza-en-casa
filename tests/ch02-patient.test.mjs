import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore } from "../app/store.js";
import { DEMO_PASSWORD } from "./helpers/demo-auth.mjs";
import { safeStorage } from "../app/domain.js";

const config = { dataMode: "mock", notificationsMode: "mock" };

test("CH02 crea y actualiza un paciente sintético dentro de la organización", async () => {
  safeStorage.clear();
  const store = await createAppStore(config);
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  const patient = store.createPatient({
    documentType: "DUI",
    document: "99999999-9",
    fullName: "Paciente Sintética CH02",
    birthDate: "1990-01-01",
    sex: "F",
    phone: "+503 7000-0000",
    company: "Empresa Demo",
    address: "Dirección sintética",
    addressComments: "Referencia sintética",
    notifyWhatsApp: false,
    contactName: "Contacto Sintético"
  });
  assert.equal(patient.fullName, "Paciente Sintética CH02");
  assert.equal(patient.notifyWhatsApp, false);
  assert.equal(patient.organizationId, store.getState().organization.id);
  store.updatePatient(patient.id, { occupation: "Ocupación sintética", fullName: "Paciente Sintética Editada" });
  assert.equal(store.patientById(patient.id).occupation, "Ocupación sintética");
  assert.equal(store.patientById(patient.id).fullName, "Paciente Sintética Editada");
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "CREATE_PATIENT" && entry.entity === patient.id));
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "UPDATE_PATIENT" && entry.entity === patient.id));
  safeStorage.clear();
});

test("CH02 bloquea duplicados, cruces organizacionales y roles sin patients:write", async () => {
  safeStorage.clear();
  const store = await createAppStore(config);
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  const input = { documentType: "Pasaporte", document: "P-SYNTH-CH02", fullName: "Paciente Sintética" };
  const patient = store.createPatient(input);
  assert.throws(() => store.createPatient(input), /Ya existe/);
  patient.organizationId = "ORG-AJENA";
  const statePatient = store.patientById(patient.id);
  statePatient.organizationId = "ORG-AJENA";
  assert.throws(() => store.updatePatient(patient.id, { occupation: "No permitido" }), /no disponible/i);

  await store.authenticate("enfermeria@analiza.demo", DEMO_PASSWORD);
  assert.throws(() => store.createPatient({ document: "X", fullName: "Sin permiso" }), /no tiene permiso/);
  safeStorage.clear();
});

test("CH02 conserva la estructura observada y placeholders seguros", async () => {
  const [views, main] = await Promise.all([
    readFile(new URL("../app/views.js", import.meta.url), "utf8"),
    readFile(new URL("../app/main.js", import.meta.url), "utf8")
  ]);
  for (const label of [
    "Datos del paciente", "Tipo de documento", "Nombre completo", "Fecha de nacimiento", "Teléfono celular",
    "Tipo de sangre", "Estado civil", "Nacionalidad", "Empresa", "Ocupación", "Información de seguro",
    "Paciente regular", "¿Paciente es el asegurado titular?", "Nro de póliza", "Certificado/Unidad",
    "Información de contactos", "Información de dirección", "Pegar enlace", "Ubicación geográfica",
    "Comentarios relevantes de la dirección", "Mapa demo", "Atrás", "Guardar"
  ]) assert.ok(views.includes(label), `Falta etiqueta CH02: ${label}`);
  assert.match(views, /Desmarcado por defecto/);
  assert.match(views, /requires rules|requiere reglas|requieren decisión/i);
  assert.match(main, /#\/pacientes\/nuevo/);
});
