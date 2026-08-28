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
const migrationPath = new URL("../supabase/migrations/202608270010_ch14_inventory_boundaries.sql", import.meta.url);

async function isolatedStore(email = "admin@analiza.demo") {
  safeStorage.clear();
  const store = await createAppStore({ dataMode:"mock", notificationsMode:"mock" });
  await store.authenticate(email, DEMO_PASSWORD);
  return store;
}

test("CH14 aplica un movimiento local idempotente y auditable sin duplicar existencias", async () => {
  const store = await isolatedStore();
  const state = store.getState();
  const item = state.inventoryItems.find((candidate) => !state.catalogItems.find((catalog) => catalog.id === candidate.catalogItemId)?.requiresLot);
  assert.ok(item,"se requiere un ítem sintético sin control de lote");
  const before = item.stock;
  const input = { inventoryItemId:item.id, type:"POSITIVE_ADJUSTMENT", quantity:2, reference:"CH14-SYN-1", idempotencyKey:"CH14-SYN-1" };
  const first = store.createInventoryMovement(input);
  const second = store.createInventoryMovement(input);
  assert.equal(first.id, second.id);
  assert.equal(store.getState().inventoryItems.find((candidate)=>candidate.id===item.id).stock,before+2);
  assert.equal(store.getState().inventoryMovements.filter((movement)=>movement.idempotencyKey==="CH14-SYN-1").length,1);
  assert.ok(store.getState().auditLogs.some((entry)=>entry.action==="CREATE_INVENTORY_MOVEMENT"&&entry.entity===first.id));
});

test("CH14 no simula movimientos locales de ítems trazables sin transacción de lote", async () => {
  const store = await isolatedStore();
  const state = store.getState();
  const item = state.inventoryItems.find((candidate) => state.catalogItems.find((catalog) => catalog.id === candidate.catalogItemId)?.requiresLot);
  const before = structuredClone({item, lots:state.inventoryLots, movements:state.inventoryMovements, audits:state.auditLogs});
  assert.throws(()=>store.createInventoryMovement({inventoryItemId:item.id,type:"NEGATIVE_ADJUSTMENT",quantity:1,reference:"CH14-LOT-GUARD",idempotencyKey:"CH14-LOT-GUARD",lotId:state.inventoryLots.find((lot)=>lot.inventoryItemId===item.id)?.id}),/movimientos locales.*lote o serie.*bloqueados/i);
  const after = store.getState();
  assert.deepEqual(after.inventoryItems.find((candidate)=>candidate.id===item.id),before.item);
  assert.deepEqual(after.inventoryLots,before.lots);
  assert.deepEqual(after.inventoryMovements,before.movements);
  assert.deepEqual(after.auditLogs,before.audits);
});

test("CH14 bloquea cierres y kits cuando faltan reglas de estado, consumo y reversión", async () => {
  const store = await isolatedStore();
  assert.throws(()=>store.createInventoryClosure({caseId:"HOS-2026-0190",type:"TOTAL",items:[]}),/permanece bloqueado/i);
  assert.throws(()=>store.approveInventoryClosure("CLOSE-001"),/permanece bloqueado/i);
  assert.throws(()=>store.createKit({name:"Kit sintético",code:"KIT-SYN",items:[{catalogItemId:"CAT-INS-001",quantity:1}]}),/permanece bloqueado/i);
});

test("CH14 reconstruye todas las colecciones de inventario desde Supabase", () => {
  const mapped = mapSupabaseBootstrap({
    catalogItems:[{id:"C-1",organization_id:"O-1",sku:"SYN-1",name:"Ítem sintético",category:"SUPPLIES",unit:"unidad",status:"ACTIVE"}],
    warehouses:[{id:"W-1",organization_id:"O-1",name:"Bodega sintética",status:"ACTIVE"}],
    inventoryItems:[{id:"I-1",organization_id:"O-1",catalog_item_id:"C-1",warehouse_id:"W-1",stock:"7",committed:"2",minimum_stock:"1"}],
    inventoryLots:[{id:"L-1",organization_id:"O-1",inventory_item_id:"I-1",lot_number:"LOT-SYN",quantity:"7",status:"AVAILABLE"}],
    inventoryMovements:[{id:"M-1",organization_id:"O-1",inventory_item_id:"I-1",hospitalization_id:"H-1",movement_type:"PATIENT_COMMITMENT",quantity:"2",warehouse_from_id:"W-1",created_at:"2026-08-27T12:00:00Z"}],
    inventoryReservations:[{id:"R-1",organization_id:"O-1",hospitalization_id:"H-1",inventory_item_id:"I-1",quantity:"2",delivered:"1",consumed:"0",returned:"0",status:"OPEN"}],
    inventoryClosures:[{id:"X-1",organization_id:"O-1",hospitalization_id:"H-1",closure_type:"PARTIAL",status:"PENDING_REVIEW",inventory_closure_items:[{inventory_item_id:"I-1",delivered:"1",consumed:"0",returned:"0",difference:"1"}]}],
    kits:[{id:"K-1",organization_id:"O-1",code:"KIT-SYN",name:"Kit sintético",status:"INACTIVE",supply_kit_items:[{catalog_item_id:"C-1",quantity:"3"}]}]
  });
  assert.equal(mapped.inventoryItems[0].name,"Ítem sintético");
  assert.equal(mapped.inventoryItems[0].minimum,1);
  assert.equal(mapped.inventoryLots[0].quantity,7);
  assert.equal(mapped.inventoryMovements[0].type,"PATIENT_COMMITMENT");
  assert.equal(mapped.inventoryMovements[0].caseId,"H-1");
  assert.equal(mapped.inventoryReservations[0].delivered,1);
  assert.equal(mapped.inventoryClosures[0].items[0].difference,1);
  assert.equal(mapped.kits[0].items[0].name,"Ítem sintético");
});

test("CH14 exige confirmación remota y cierra DML directo con lecturas tenant-safe", async () => {
  const [store,adapter,migration] = await Promise.all([readFile(storePath,"utf8"),readFile(adapterPath,"utf8"),readFile(migrationPath,"utf8")]);
  assert.match(store,/requiredSync\("CREATE_INVENTORY_MOVEMENT"/);
  assert.doesNotMatch(store,/safeSync\("CREATE_INVENTORY_MOVEMENT"/);
  assert.match(adapter,/\["inventoryLots", "inventory_lots", "\*"\]/);
  assert.match(adapter,/\["inventoryClosures", "inventory_closures", "\*, inventory_closure_items\(\*\)"\]/);
  assert.match(adapter,/return \{ ok:true, movementId:data \}/);
  for (const marker of [
    "alter table public.supply_kit_items enable row level security",
    "drop policy if exists inventory_items_write",
    "drop policy if exists inventory_lots_write",
    "drop policy if exists suppliers_write",
    "drop policy if exists warehouses_write",
    "inventory_movements.organization_id = item.organization_id",
    "inventory_reservations.organization_id = hospitalization.organization_id",
    "inventory_closure_items.organization_id = closure.organization_id",
    "catalog.organization_id = kit.organization_id",
    "revoke insert, update, delete on public.inventory_items from authenticated",
    "revoke insert, update, delete on public.suppliers from authenticated",
    "revoke insert, update, delete on public.warehouses from authenticated",
    "revoke insert, update, delete on public.inventory_closures from authenticated",
    "revoke insert, update, delete on public.supply_kit_items from authenticated"
  ]) assert.ok(migration.includes(marker),`falta ${marker}`);
  assert.doesNotMatch(migration,/disable row level security/i);
});

test("CH14 expone Items, movimientos, acuses, cierres, proveedores, bodegas, lotes y kits", async () => {
  const [main,views] = await Promise.all([readFile(mainPath,"utf8"),readFile(viewsPath,"utf8")]);
  for (const label of ["Movimientos de item","Rango de fechas","Lote / Serie","ENTRADA","SALIDA","Inventario comprometido","Acuse nuevo","Información del Acuse","Información del Items a entregar","Cantidad disponible","Cantidad a asignar","Vaciar","Plantilla","Añadir","Advertencia","Cancelar","Aceptar"])
    assert.ok(main.includes(label),`falta ${label}`);
  for (const label of ["Gestión de inventario","Items","Movimientos","Comprometido","Lotes","Bodega: Todos","Excel","Traslados","Disp","Comp","Total","Pacientes","Recursos","No disponible","Solicitudes","Tareas","Cierres totales","Cerrados","Proveedores","Código","Empresa","Contacto","Teléfono","Correo","Dirección","Lotes y números de serie","Fecha E - Fecha V","Kit de insumos","Editar","Duplicar","Eliminar"])
    assert.ok(views.includes(label),`falta ${label}`);
});
