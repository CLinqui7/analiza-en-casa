import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore } from "../app/store.js";
import { DEMO_PASSWORD } from "./helpers/demo-auth.mjs";
import { safeStorage } from "../app/domain.js";
import { mapSupabaseBootstrap } from "../app/supabase-adapter.js";

const storePath = new URL("../app/store.js", import.meta.url);
const adapterPath = new URL("../app/supabase-adapter.js", import.meta.url);
const viewsPath = new URL("../app/views.js", import.meta.url);
const mainPath = new URL("../app/main.js", import.meta.url);
const migrationPath = new URL("../supabase/migrations/202608270005_ch09_clinical_profile_integrity.sql", import.meta.url);

async function isolatedStore(email = "admin@analiza.demo") {
  safeStorage.clear();
  const store = await createAppStore({ dataMode: "mock", notificationsMode: "mock" });
  await store.authenticate(email, DEMO_PASSWORD);
  return store;
}

function validProfile(store, suffix = "1") {
  const state = store.getState();
  const record = state.cases.find((candidate) => candidate.patientId);
  const activeDoctors = state.doctors.filter((doctor) => doctor.status === "ACTIVE");
  return {
    caseId: record.id,
    startDate: "2026-06-01",
    endDate: "2026-06-15",
    treatingDoctorId: activeDoctors[0]?.id || "",
    otherDoctorIds: activeDoctors[1] ? [activeDoctors[1].id] : [],
    coordinatorId: activeDoctors[0]?.id || "",
    diagnosisCode: "SYN-CH09",
    diagnosisLabel: "Descripción clínica sintética para QA",
    diagnosisGroup: "Grupo configurable QA",
    triage: "Clasificación documentada QA",
    profileGroup: "Grupo perfil QA",
    profileSubgroup: "Subgrupo perfil QA",
    patientType: "Tipo configurable QA",
    supervisorName: "Supervisor sintético",
    nursingTags: "Etiqueta QA",
    supervisionFrequency: "Frecuencia documentada QA",
    physicianReportFrequency: "Frecuencia documentada QA",
    serviceType: "Servicio configurable QA",
    devices: [{deviceType: "Dispositivo sintético", date: "2026-06-02", gauge: "QA", reason: "Prueba", changeFrequency: "Documentada", observations: "Sin datos reales"}],
    shiftStartDate: "2026-06-01",
    shiftEndDate: "2026-06-15",
    shiftFrequency: "Frecuencia configurable QA",
    attentionType: "Atención configurable QA",
    idempotencyKey: `CH09-PROFILE-${suffix}`
  };
}

test("CH09 crea un borrador clínico append-only, auditable e idempotente sin activar la hospitalización", async () => {
  const store = await isolatedStore();
  const input = validProfile(store);
  const beforeStatus = store.caseById(input.caseId).status;
  const profile = store.createClinicalProfile(input);
  assert.equal(profile.clinicalStatus, "DRAFT");
  assert.equal(profile.otherDoctorIds.length, input.otherDoctorIds.length);
  assert.equal(profile.devices[0].deviceType, "Dispositivo sintético");
  assert.equal(store.createClinicalProfile(input).id, profile.id);
  assert.equal(store.getState().clinicalProfiles.filter((item) => item.idempotencyKey === input.idempotencyKey).length, 1);
  assert.equal(store.caseById(input.caseId).status, beforeStatus);
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "CREATE_CLINICAL_PROFILE" && entry.entity === profile.id));
});

test("CH09 rechaza rangos invertidos, referencias ajenas y roles sin escritura clínica", async () => {
  const store = await isolatedStore();
  const input = validProfile(store, "RANGES");
  assert.throws(() => store.createClinicalProfile({...input, endDate: "2026-05-31"}), /obligatorios|válidos/i);
  assert.throws(() => store.createClinicalProfile({...input, idempotencyKey: "CH09-SHIFT", shiftStartDate: "2026-06-16", shiftEndDate: "2026-06-15"}), /rango/i);
  assert.throws(() => store.createClinicalProfile({...input, idempotencyKey: "CH09-DOCTOR", treatingDoctorId: "DOC-ORG-AJENA"}), /organización/i);
  assert.deepEqual(store.validateHealthReportRange({caseId: input.caseId, start: "2026-06-01", end: "2026-06-15"}), {caseId: input.caseId, start: "2026-06-01", end: "2026-06-15"});
  assert.throws(() => store.validateHealthReportRange({caseId: input.caseId, start: "2026-06-16", end: "2026-06-15"}), /rango/i);
  await store.logout();
  await store.authenticate("auditoria@analiza.demo", DEMO_PASSWORD);
  assert.throws(() => store.createClinicalProfile({...input, idempotencyKey: "CH09-AUDIT"}), /permiso/i);
});

test("CH09 reconstruye perfiles clínicos estructurados desde Supabase", () => {
  const mapped = mapSupabaseBootstrap({clinicalProfiles: [{
    id: "CP-1", organization_id: "ORG-1", hospitalization_id: "HOS-1", patient_id: "PAT-1",
    start_date: "2026-06-01", end_date: "2026-06-15", treating_doctor_id: "DOC-1",
    other_doctor_ids: ["DOC-2"], diagnosis_code: "SYN", diagnosis_label: "Sintético",
    devices: [{device_type: "Dispositivo sintético", change_frequency: "Documentada"}],
    clinical_status: "DRAFT", attachment_metadata: [], idempotency_key: "IDEMP-1"
  }]});
  assert.equal(mapped.clinicalProfiles[0].caseId, "HOS-1");
  assert.deepEqual(mapped.clinicalProfiles[0].otherDoctorIds, ["DOC-2"]);
  assert.equal(mapped.clinicalProfiles[0].devices[0].deviceType, "Dispositivo sintético");
  assert.equal(mapped.clinicalProfiles[0].devices[0].changeFrequency, "Documentada");
});

test("CH09 usa confirmación remota, RLS, referencias organizacionales y superficies exactas", async () => {
  const [store, adapter, migration, views, main] = await Promise.all([
    readFile(storePath, "utf8"), readFile(adapterPath, "utf8"), readFile(migrationPath, "utf8"), readFile(viewsPath, "utf8"), readFile(mainPath, "utf8")
  ]);
  assert.match(store, /requiredSync\("CREATE_CLINICAL_PROFILE"/);
  assert.doesNotMatch(store, /function createClinicalProfile[\s\S]*?safeSync\("CREATE_CLINICAL_PROFILE"/);
  assert.match(adapter, /client\.rpc\("create_clinical_profile"/);
  assert.match(adapter, /client\.rpc\("validate_health_report_range"/);
  for (const marker of [
    "create table if not exists public.clinical_profiles", "clinical_profiles_select", "clinical_profiles_rpc_only",
    "create or replace function public.create_clinical_profile", "prevent_clinical_profile_mutation",
    "other_doctor_ids", "organization_id = v_org", "pg_advisory_xact_lock", "CREATE_CLINICAL_PROFILE",
    "set search_path = pg_catalog, public", "revoke all on function public.create_clinical_profile",
    "create or replace function public.validate_health_report_range", "revoke all on function public.validate_health_report_range"
  ]) assert.ok(migration.includes(marker), `falta ${marker}`);
  assert.match(migration, /before update or delete on public\.clinical_profiles/);
  assert.match(migration, /grant select on public\.clinical_profiles to authenticated/);
  assert.match(migration, /revoke insert, update, delete on public\.clinical_profiles from authenticated/);
  assert.doesNotMatch(migration, /grant execute on function[\s\S]*?to public/i);
  for (const label of ["Hospitalización clínica", "Activado por", "Tipo de servicio", "Tipo de atención", "Relevos", "Reingresos", "Reinfecciones", "Ulceraciones", "Near miss", "Historia clínica", "Claims", "Registro XPO", "Información Principal", "Evaluación Clínica", "Atención Médica", "Tratamientos y Órdenes", "Eventos Clínicos", "Evidencia y Documentos"])
    assert.ok(views.includes(label), `falta ${label}`);
  assert.match(views, /data-action="health-report-page"/);
  assert.match(views, /data-ui-filter="healthReportPageSize"/);
  for (const label of ["Perfiles Clínicos", "Detalles de Hospitalización", "Grupo Diagnóstico", "Dispositivos", "Rango fechas", "Configuration report", "Include attached documents", "Procesando..."])
    assert.ok(main.includes(label), `falta ${label}`);
  assert.match(main, /end\.value < start\.value/);
  assert.match(main, /shiftEnd\.value < shiftStart\.value/);
});
