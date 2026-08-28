import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore } from "../app/store.js";
import { DEMO_PASSWORD } from "./helpers/demo-auth.mjs";
import { safeStorage } from "../app/domain.js";
import { mapSupabaseBootstrap } from "../app/supabase-adapter.js";

const storePath = new URL("../app/store.js", import.meta.url);
const adapterPath = new URL("../app/supabase-adapter.js", import.meta.url);
const mainPath = new URL("../app/main.js", import.meta.url);
const viewsPath = new URL("../app/views.js", import.meta.url);
const migrationPath = new URL("../supabase/migrations/202608270007_ch11_agenda_visits.sql", import.meta.url);

async function isolatedStore() {
  safeStorage.clear();
  const store = await createAppStore({ dataMode:"mock", notificationsMode:"mock" });
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  return store;
}

function visitInput(key="CH11-VISIT-1") {
  return {
    caseId:"HOS-2026-0190", start:"2026-08-28T06:00:00-06:00", end:"2026-08-28T18:00:00-06:00",
    type:"NURSING_CARE", classification:"TURNO", frequency:"Cada 8 horas", occurrenceCount:1, idempotencyKey:key
  };
}

test("CH11 crea una visita organizacional, idempotente y sin simular recurrencia", async () => {
  const store = await isolatedStore();
  const visit = store.createShift(visitInput());
  assert.equal(visit.status,"PENDING");
  assert.equal(visit.resourceName,"Sin asignar");
  assert.equal(visit.classification,"TURNO");
  assert.equal(store.createShift(visitInput()).id,visit.id);
  assert.equal(store.getState().shifts.filter((item)=>item.idempotencyKey==="CH11-VISIT-1").length,1);
  assert.throws(()=>store.createShift({...visitInput("CH11-BAD-RANGE"),end:"2026-08-28T05:00:00-06:00"}),/intervalo/i);
  assert.throws(()=>store.createShift({...visitInput("CH11-BAD-TYPE"),type:"UNDEFINED_SERVICE"}),/clasificación, tipo/i);
  assert.throws(()=>store.createShift({...visitInput("CH11-RECURRENCE"),occurrenceCount:2}),/recurrencia/i);
  store.getState().cases.find((item)=>item.id==="HOS-2026-0190").organizationId="ORG-OTHER";
  assert.throws(()=>store.createShift(visitInput("CH11-OTHER-ORG")),/no disponible/i);
});

test("CH11 asigna sólo recursos activos y conserva auditoría sin ejecutar liquidación", async () => {
  const store = await isolatedStore();
  const visit = store.createShift(visitInput("CH11-ASSIGN"));
  const resource = store.getState().users.find((item)=>item.status==="ACTIVE"&&item.role==="NURSE");
  const assigned = store.updateShiftAssignment(visit.id,{resourceId:resource.id,internalObservations:"Observación sintética de coordinación",idempotencyKey:"CH11-ASSIGN-1"});
  const auditCount = store.getState().auditLogs.filter((entry)=>entry.action==="ASSIGN_SHIFT_RESOURCE"&&entry.entity===visit.id).length;
  store.updateShiftAssignment(visit.id,{resourceId:resource.id,internalObservations:"Observación sintética de coordinación",idempotencyKey:"CH11-ASSIGN-1"});
  assert.equal(assigned.resourceId,resource.id);
  assert.equal(assigned.resourceName,resource.name);
  assert.ok(store.getState().auditLogs.some((entry)=>entry.action==="ASSIGN_SHIFT_RESOURCE"&&entry.entity===visit.id));
  assert.equal(store.getState().auditLogs.filter((entry)=>entry.action==="ASSIGN_SHIFT_RESOURCE"&&entry.entity===visit.id).length,auditCount);
  assert.throws(()=>store.updateShiftAssignment(visit.id,{resourceId:"USR-UNKNOWN"}),/recurso activo/i);
  store.getState().shifts.find((item)=>item.id===visit.id).status="COMPLETED";
  assert.throws(()=>store.updateShiftAssignment(visit.id,{resourceId:resource.id}),/finalizada o cancelada/i);
});

test("CH11 reconstruye visitas desde Supabase con nombres de columnas correctos", () => {
  const mapped = mapSupabaseBootstrap({shifts:[{
    id:"S-1",organization_id:"O-1",hospitalization_id:"H-1",patient_id:"P-1",resource_user_id:"U-1",
    resource_name:"Recurso QA",starts_at:"2026-08-28T12:00:00Z",ends_at:"2026-08-28T13:00:00Z",
    shift_type:"MEDICAL_VISIT",classification:"PUNTUAL",frequency:"Única",occurrence_count:1,status:"PENDING"
  }]});
  assert.equal(mapped.shifts[0].caseId,"H-1");
  assert.equal(mapped.shifts[0].resourceId,"U-1");
  assert.equal(mapped.shifts[0].start,"2026-08-28T12:00:00Z");
  assert.equal(mapped.shifts[0].type,"MEDICAL_VISIT");
});

test("CH11 usa confirmación remota, RPC cerradas y superficies observadas", async () => {
  const [store,adapter,main,views,migration] = await Promise.all([
    readFile(storePath,"utf8"),readFile(adapterPath,"utf8"),readFile(mainPath,"utf8"),readFile(viewsPath,"utf8"),readFile(migrationPath,"utf8")
  ]);
  for (const action of ["CREATE_SHIFT","ASSIGN_SHIFT_RESOURCE"]) assert.match(store,new RegExp(`requiredSync\\(\"${action}`));
  assert.match(adapter,/client\.rpc\("create_shift_visit"/);
  assert.match(adapter,/client\.rpc\("assign_shift_resource"/);
  for (const marker of ["pg_advisory_xact_lock","organization_id = v_org","event_type = 'RESOURCE_ASSIGNED'","unique (organization_id, event_type, idempotency_key)","CREATE_SHIFT","ASSIGN_SHIFT_RESOURCE","set search_path = pg_catalog, public","r.code in ('NURSE','DOCTOR')","revoke insert, update, delete on public.shifts"])
    assert.ok(migration.includes(marker),`falta ${marker}`);
  for (const label of ["Detalles de visitas","Eliminar visitas","Mes","Semana","Lista por semana","Lista por día","Crear turno a paciente","Puntual","Turno","Aplicar descuento","finalizada","Actualizaciones","Editar pago de servicios profesionales"])
    assert.ok(main.includes(label)||views.includes(label),`falta ${label}`);
  assert.doesNotMatch(store,/safeSync\("CREATE_SHIFT"/);
});
