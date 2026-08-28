import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore } from "../app/store.js";
import { safeStorage } from "../app/domain.js";
import { DEMO_PASSWORD } from "./helpers/demo-auth.mjs";

async function isolatedStore() {
  safeStorage.clear();
  const store = await createAppStore({ dataMode: "mock", notificationsMode: "mock" });
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  return store;
}

test("CH17 valida el rango del reporte sin cambiar la hospitalización", async () => {
  const store = await isolatedStore();
  const range = store.validateHealthReportRange({ caseId: "HOS-2026-0190", start: "2026-06-01", end: "2026-06-15" });
  assert.deepEqual(range, { caseId: "HOS-2026-0190", start: "2026-06-01", end: "2026-06-15" });
  assert.throws(() => store.validateHealthReportRange({ caseId: "HOS-2026-0190", start: "2026-06-16", end: "2026-06-15" }), /rango/i);
  assert.throws(() => store.validateHealthReportRange({ caseId: "HOS-OTHER", start: "2026-06-01", end: "2026-06-15" }), /no disponible|hospitalización/i);
  safeStorage.clear();
});

test("CH17 conserva la nota firmada y registra una corrección auditada", async () => {
  const store = await isolatedStore();
  const note = store.addNursingNote({ caseId: "HOS-2026-0190", text: "Nota sintética para el reporte.", sign: true });
  const original = structuredClone(store.getState().nursingNotes.find((item) => item.id === note.id));
  const correction = store.createClinicalCorrection("NURSING_NOTE", note.id, {
    kind: "ERRATA",
    reason: "Corrección ortográfica sintética.",
    content: { text: "Aclaración sintética." }
  });
  assert.equal(store.clinicalRecordStatus("NURSING_NOTE", note.id), "CORRECTED");
  assert.deepEqual(store.getState().nursingNotes.find((item) => item.id === note.id), original);
  assert.equal(correction.previousVersionId, note.id);
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "CREATE_CLINICAL_CORRECTION" && entry.entity === correction.id));
  safeStorage.clear();
});

test("CH17 mantiene la notificación de nota fuera del contenido clínico", async () => {
  const store = await isolatedStore();
  const note = store.addNursingNote({ caseId: "HOS-2026-0190", text: "Texto clínico sintético que no debe salir del portal.", sign: true });
  store.shareNursingNote(note.id);
  const notification = store.getState().notifications.find((item) => item.relatedEntityId === note.id);
  assert.equal(notification.templateCode, "NURSING_NOTE_AVAILABLE");
  assert.doesNotMatch(notification.safePreview, /Texto clínico sintético|diagnóstico|tratamiento|medicación/i);
  assert.equal(store.getState().nursingNotes.find((item) => item.id === note.id).shareStatus, "SHARED_WITH_DOCTOR");
  safeStorage.clear();
});

test("CH17 expone secciones, búsqueda, selección de impresión y resguardos documentales", async () => {
  const [views, main, store] = await Promise.all([
    readFile(new URL("../app/views.js", import.meta.url), "utf8"),
    readFile(new URL("../app/main.js", import.meta.url), "utf8"),
    readFile(new URL("../app/store.js", import.meta.url), "utf8")
  ]);
  for (const marker of [
    "Antecedentes y evaluaciones", "Signos vitales", "Perfiles clínicos", "Notas de evolución",
    "Interconsultas", "Notas de enfermería", "Bitácoras", "Registros clínicos de signos vitales",
    "Signos cargados por el paciente", "Buscar nota, turno o profesional", "Corrección auditada",
    "Compartir enlace seguro", "toggle-health-report-insurance-print"
  ]) assert.ok(views.includes(marker), `falta ${marker}`);
  for (const marker of [
    "set-health-report-assessment-tab", "health-report-nursing-page", "toggle-health-report-note-print",
    "printInsuranceIds", "printNoteIds", "validateHealthReportRange"
  ]) assert.ok(main.includes(marker), `falta ${marker}`);
  assert.match(store, /createClinicalCorrection/);
  assert.match(store, /voidClinicalRecord/);
  assert.match(store, /APPLICATION_SIGNATURE_METADATA/);
});
