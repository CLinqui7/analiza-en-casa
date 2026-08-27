import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore, DEMO_PASSWORD } from "../app/store.js";
import { safeStorage } from "../app/domain.js";
import { mapSupabaseBootstrap } from "../app/supabase-adapter.js";
import { medicalOrderDocument, medicationCardDocument } from "../app/templates.js";

const storePath = new URL("../app/store.js", import.meta.url);
const adapterPath = new URL("../app/supabase-adapter.js", import.meta.url);
const viewsPath = new URL("../app/views.js", import.meta.url);
const mainPath = new URL("../app/main.js", import.meta.url);
const migrationPath = new URL("../supabase/migrations/202608270006_ch10_medical_orders_medication_cards.sql", import.meta.url);

async function isolatedStore() {
  safeStorage.clear();
  const store = await createAppStore({ dataMode: "mock", notificationsMode: "mock" });
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  return store;
}

function cardInput(store, key = "CH10-CARD-1") {
  const state = store.getState();
  const record = state.cases.find((item) => item.status === "ACTIVE") || state.cases[0];
  const doctors = state.doctors.filter((item) => item.status === "ACTIVE");
  return {
    caseId: record.id,
    treatingDoctorId: doctors[0]?.id || "",
    otherDoctorIds: doctors[1] ? [doctors[1].id] : [],
    diagnosis: "Diagnóstico sintético documentado para QA",
    idempotencyKey: key,
    items: [{
      medication: "Medicamento sintético CH10", doctorId: doctors[0]?.id || "", route: "VO", dose: "Dato QA",
      frequency: "Cada 8 horas", durationDays: 3, startDate: "2026-08-27", endDate: "2026-08-29",
      chronic: false, schedule: ["08:00", "16:00", "PRN"], indications: "Indicación sintética documentada",
      dilutions: "Dilución sintética documentada", administrationStatus: "PENDING"
    }]
  };
}

test("CH10 crea orden médica estructurada, auditable e idempotente", async () => {
  const store = await isolatedStore();
  const state = store.getState();
  const record = state.cases[0];
  const doctor = state.doctors.find((item) => item.status === "ACTIVE");
  const input = {
    caseId: record.id, type: "MEDICAL_ORDER", title: "Orden médica sintética CH10", summary: "Dieta, Cuidados de Enfermería",
    content: { treatingDoctorId: doctor?.id || "", otherDoctorIds: [], diagnosis: "Diagnóstico sintético", sections: [
      {key: "diet", label: "Dieta", content: "Contenido sintético"},
      {key: "nursingCare", label: "Cuidados de Enfermería", content: "Contenido sintético"}
    ] }, idempotencyKey: "CH10-ORDER-1"
  };
  const document = store.createClinicalDocument(input);
  assert.equal(document.status, "DRAFT");
  assert.equal(document.content.sections.length, 2);
  assert.equal(store.createClinicalDocument(input).id, document.id);
  assert.throws(() => store.createClinicalDocument({...input, idempotencyKey:"CH10-ORDER-NO-DOCTOR", content:{...input.content,treatingDoctorId:""}}), /médico tratante/i);
  assert.equal(store.getState().clinicalDocuments.filter((item) => item.idempotencyKey === input.idempotencyKey).length, 1);
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "CREATE_CLINICAL_DOCUMENT" && entry.entity === document.id));
  const html = medicalOrderDocument({document, patient: store.patientById(document.patientId), recordCase: record});
  assert.match(html, /Dieta/);
  assert.match(html, /Cuidados de Enfermería/);
});

test("CH10 crea tarjeta multi-tratamiento completa e idempotente y valida calendario/organización", async () => {
  const store = await isolatedStore();
  const input = cardInput(store);
  input.items.push({...input.items[0], medication: "Segundo medicamento sintético", schedule: ["20:00"]});
  const card = store.createMedicationCard(input);
  assert.equal(card.items.length, 2);
  assert.equal(card.items[0].doctorId, input.treatingDoctorId);
  assert.equal(card.items[0].durationDays, 3);
  assert.equal(store.createMedicationCard(input).id, card.id);
  assert.equal(store.getState().medicationCards.filter((item) => item.idempotencyKey === input.idempotencyKey).length, 1);
  assert.throws(() => store.createMedicationCard({...cardInput(store,"CH10-BAD-DATE"), items:[{...input.items[0],startDate:"2026-08-30",endDate:"2026-08-29"}]}), /calendario/i);
  assert.throws(() => store.createMedicationCard({...cardInput(store,"CH10-BAD-DOCTOR"), treatingDoctorId:"DOC-OTHER-ORG"}), /organización/i);
  assert.throws(() => store.createMedicationCard({...cardInput(store,"CH10-NO-DOCTOR"), treatingDoctorId:""}), /médico tratante/i);
  const complete = medicationCardDocument({card, patient: store.patientById(card.patientId), recordCase: store.caseById(card.caseId), variant:"complete"});
  const simple = medicationCardDocument({card, patient: {}, recordCase: {}, variant:"simple"});
  const count = medicationCardDocument({card, patient: {}, recordCase: {}, variant:"count"});
  assert.match(complete, /Diagnóstico sintético documentado/);
  assert.match(complete, /Indicación sintética documentada/);
  assert.match(simple, /Tarjeta de medicamentos simple/);
  assert.match(count, /Formato provisional/);
});

test("CH10 reconstruye órdenes, tarjetas e ítems anidados desde Supabase", () => {
  const mapped = mapSupabaseBootstrap({
    clinicalDocuments:[{id:"D-1",hospitalization_id:"H-1",patient_id:"P-1",document_type:"MEDICAL_ORDER",version:2,content:{sections:[]}}],
    medicationCards:[{id:"M-1",hospitalization_id:"H-1",patient_id:"P-1",document_status:"DRAFT",version:1,other_doctor_ids:["DR-2"],medication_card_items:[{id:"I-1",medication_name:"Medicamento QA",prescribing_doctor_id:"DR-1",schedule:["08:00"]}]}]
  });
  assert.equal(mapped.clinicalDocuments[0].caseId,"H-1");
  assert.equal(mapped.clinicalDocuments[0].type,"MEDICAL_ORDER");
  assert.equal(mapped.medicationCards[0].caseId,"H-1");
  assert.equal(mapped.medicationCards[0].items[0].medication,"Medicamento QA");
  assert.equal(mapped.medicationCards[0].items[0].doctorId,"DR-1");
});

test("CH10 usa confirmación remota, RPC cerradas y superficies observadas", async () => {
  const [store, adapter, migration, views, main] = await Promise.all([
    readFile(storePath,"utf8"), readFile(adapterPath,"utf8"), readFile(migrationPath,"utf8"), readFile(viewsPath,"utf8"), readFile(mainPath,"utf8")
  ]);
  for (const action of ["CREATE_CLINICAL_DOCUMENT","CREATE_MEDICATION_CARD","SIGN_MEDICATION_CARD","CREATE_CLINICAL_CORRECTION","VOID_CLINICAL_RECORD"])
    assert.match(store, new RegExp(`requiredSync\\(\"${action}`), `falta confirmación remota ${action}`);
  assert.match(adapter,/client\.rpc\("create_clinical_document_draft"/);
  assert.match(adapter,/client\.rpc\("create_medication_card_draft"/);
  for (const marker of ["pg_advisory_xact_lock","organization_id = v_org","CREATE_MEDICATION_CARD","CREATE_CLINICAL_DOCUMENT","set search_path = pg_catalog, public","revoke all on function public.create_medication_card_draft","revoke insert on public.medication_cards"])
    assert.ok(migration.includes(marker),`falta ${marker}`);
  for (const label of ["Activos","Inactivos","Tratamientos con cambios","Actualizaciones","Orden Médica","Tarjeta de medicamentos","Historial de tratamientos","Tarjeta completa","Tarjeta simple","Conteo presencial"])
    assert.ok(views.includes(label) || main.includes(label),`falta ${label}`);
  for (const label of ["¿Qué quieres crear?","Configuración de tratamientos","Médico tratante","Vía de administración","Duración (días)","Medicamento crónico","Mostrar diluciones","Dieta","Cuidados de Enfermería"])
    assert.ok(main.includes(label),`falta ${label}`);
  assert.match(main,/date\.setUTCDate\(date\.getUTCDate\(\) \+ days - 1\)/);
  assert.doesNotMatch(main,/Administración registrada en modo demo/);
});
