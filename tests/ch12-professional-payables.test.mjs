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
const migrationPath = new URL("../supabase/migrations/202608270008_ch12_professional_payables.sql", import.meta.url);

async function isolatedStore() {
  safeStorage.clear();
  const store = await createAppStore({ dataMode:"mock", notificationsMode:"mock" });
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  return store;
}

test("CH12 no simula generación ni envío de estados financieros", async () => {
  const store = await isolatedStore();
  const before = structuredClone(store.getState());
  assert.throws(() => store.generateDoctorStatements(), /bloqueado|bloqueada/i);
  assert.throws(() => store.sendDoctorStatement(before.doctorStatements[0].id), /bloqueado/i);
  const after = store.getState();
  assert.deepEqual(after.doctorStatements, before.doctorStatements);
  assert.deepEqual(after.notifications, before.notifications);
  assert.equal(after.auditLogs.filter((entry) => ["GENERATE_DOCTOR_STATEMENTS","SEND_DOCTOR_STATEMENT"].includes(entry.action)).length, 0);
});

test("CH12 reconstruye servicios y estados profesionales desde Supabase", () => {
  const mapped = mapSupabaseBootstrap({
    doctorServices:[{id:"S-1",organization_id:"O-1",doctor_id:"D-1",hospitalization_id:"H-1",patient_id:"P-1",service_date:"2026-08-21",service_name:"Visita sintética",quantity:"2",rate:"25.50",status:"APPROVED"}],
    doctorStatements:[{id:"ST-1",organization_id:"O-1",doctor_id:"D-1",period_start:"2026-08-01",period_end:"2026-08-15",gross:"51",adjustments:"0",withholdings:"0",paid:"0",status:"DRAFT",doctor_statement_items:[{doctor_service_id:"S-1",amount:"51"}]}]
  });
  assert.equal(mapped.doctorServices[0].caseId,"H-1");
  assert.equal(mapped.doctorServices[0].date,"2026-08-21");
  assert.equal(mapped.doctorServices[0].service,"Visita sintética");
  assert.equal(mapped.doctorServices[0].quantity,2);
  assert.equal(mapped.doctorServices[0].rate,25.5);
  assert.equal(mapped.doctorStatements[0].doctorId,"D-1");
  assert.equal(mapped.doctorStatements[0].periodStart,"2026-08-01");
  assert.equal(mapped.doctorStatements[0].gross,51);
  assert.deepEqual(mapped.doctorStatements[0].items,["S-1"]);
});

test("CH12 cierra DML directo, protege ítems por tenant y evita doble inclusión", async () => {
  const migration = await readFile(migrationPath, "utf8");
  for (const marker of [
    "alter table public.doctor_statement_items enable row level security",
    "doctor_statement_items_read",
    "statement.organization_id = public.current_organization_id()",
    "public.has_permission('statements:read')",
    "doctor_statement_items_one_statement_per_service_idx",
    "on public.doctor_statement_items (doctor_service_id)",
    "drop policy if exists doctor_services_write",
    "drop policy if exists doctor_statements_write",
    "revoke insert, update, delete on public.doctor_services from authenticated",
    "revoke insert, update, delete on public.doctor_statements from authenticated",
    "revoke insert, update, delete on public.doctor_statement_items from authenticated"
  ]) assert.ok(migration.includes(marker), `falta ${marker}`);
  assert.doesNotMatch(migration, /disable row level security/i);
});

test("CH12 carga la fuente productiva y expone la superficie observada con bloqueos explícitos", async () => {
  const [store, adapter, main, views] = await Promise.all([
    readFile(storePath,"utf8"), readFile(adapterPath,"utf8"), readFile(mainPath,"utf8"), readFile(viewsPath,"utf8")
  ]);
  assert.match(adapter, /\["doctorServices", "doctor_services", "\*"\]/);
  assert.match(adapter, /collections\.doctorStatements =/);
  assert.doesNotMatch(store, /GENERATE_DOCTOR_STATEMENTS/);
  assert.doesNotMatch(store, /SEND_DOCTOR_STATEMENT/);
  for (const label of ["Resumen","Pagos de Servicio","Facturas","Reclamos","Generar planilla","Restricciones","Descargar","Limpiar Tabla","Editar Grupo","Reporte Por Recurso","Fecha Visita","Est. Visita"])
    assert.ok(views.includes(label), `falta ${label}`);
  for (const label of ["Pago de servicios profesionales","Fecha","Hospitalización","Recurso","Paciente","Tarifa","Monto","Estatus","Comentarios","Conceptos","Agregar Concepto","Añadidura","Descuento","Tiempo extra","Excelencia","Mal agendado","Paciente especial","Transporte","Retraso","No asistió","Cambio del turno","Planilla","Paciente Hospitalizado","Paciente Falleció","NO CIERRE DE VISITA A TIEMPO","Cumplimiento incorrecto"])
    assert.ok(main.includes(label), `falta ${label}`);
  assert.match(main, /Operación financiera bloqueada/);
});
