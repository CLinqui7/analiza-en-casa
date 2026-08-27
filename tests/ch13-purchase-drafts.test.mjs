import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore, DEMO_PASSWORD } from "../app/store.js";
import { safeStorage } from "../app/domain.js";
import { mapSupabaseBootstrap } from "../app/supabase-adapter.js";

const storePath = new URL("../app/store.js", import.meta.url);
const adapterPath = new URL("../app/supabase-adapter.js", import.meta.url);
const mainPath = new URL("../app/main.js", import.meta.url);
const viewsPath = new URL("../app/views.js", import.meta.url);
const migrationPath = new URL("../supabase/migrations/202608270009_ch13_purchase_drafts.sql", import.meta.url);

async function isolatedStore(email = "admin@analiza.demo") {
  safeStorage.clear();
  const store = await createAppStore({ dataMode:"mock", notificationsMode:"mock" });
  await store.authenticate(email, DEMO_PASSWORD);
  return store;
}

function purchaseInput(key = "CH13-DRAFT-1") {
  return {
    kind:"PETTY_CASH",
    supplierId:"SUP-001",
    date:"2026-08-27",
    invoiceNumber:"FAC-SINTETICA-CH13",
    observations:"Compra sintética para QA.",
    extraAmount:2.25,
    idempotencyKey:key,
    items:[{
      catalogItemId:"CAT-INS-001", supplierId:"SUP-001", presentation:"Caja sintética",
      quantity:2, unitCost:10, taxAmount:1.5, discountAmount:.75
    }]
  };
}

test("CH13 crea sólo un borrador idempotente con importes manuales y sin inventario", async () => {
  const store = await isolatedStore();
  const inventoryBefore = structuredClone(store.getState().inventoryItems);
  const purchase = store.createPurchase(purchaseInput());
  assert.equal(purchase.status,"DRAFT");
  assert.equal(purchase.kind,"PETTY_CASH");
  assert.equal(purchase.subtotal,20);
  assert.equal(purchase.tax,1.5);
  assert.equal(purchase.discount,.75);
  assert.equal(purchase.extra,2.25);
  assert.equal(purchase.total,23);
  assert.equal(purchase.items[0].taxAmount,1.5);
  assert.equal(purchase.items[0].lineTotal,20.75);
  assert.equal(store.createPurchase(purchaseInput()).id,purchase.id);
  assert.equal(store.getState().purchases.filter((item)=>item.idempotencyKey==="CH13-DRAFT-1").length,1);
  assert.deepEqual(store.getState().inventoryItems,inventoryBefore);
  assert.ok(store.getState().auditLogs.some((entry)=>entry.action==="CREATE_PURCHASE_DRAFT"&&entry.entity===purchase.id));
});

test("CH13 rechaza totales negativos, referencias de otro tenant y roles sin escritura", async () => {
  const store = await isolatedStore();
  assert.throws(()=>store.createPurchase({...purchaseInput("CH13-NEGATIVE"),items:[{...purchaseInput().items[0],discountAmount:100}]}),/total negativo/i);
  assert.throws(()=>store.createPurchase({...purchaseInput("CH13-NO-ITEMS"),items:[]}),/requiere entre 1 y 200/i);
  store.getState().suppliers.find((item)=>item.id==="SUP-001").organizationId="ORG-OTHER";
  assert.throws(()=>store.createPurchase(purchaseInput("CH13-OTHER-ORG")),/no disponible/i);

  const idempotencyStore = await isolatedStore();
  idempotencyStore.getState().purchases.unshift({
    ...idempotencyStore.getState().purchases[0],
    id:"PUR-FOREIGN", organizationId:"ORG-OTHER", idempotencyKey:"CH13-SAME-KEY"
  });
  const tenantPurchase = idempotencyStore.createPurchase(purchaseInput("CH13-SAME-KEY"));
  assert.equal(tenantPurchase.organizationId,idempotencyStore.getState().organization.id);
  assert.notEqual(tenantPurchase.id,"PUR-FOREIGN");

  const auditor = await isolatedStore("auditoria@analiza.demo");
  assert.throws(()=>auditor.createPurchase(purchaseInput("CH13-AUDITOR")),/no tiene permiso/i);
});

test("CH13 reconstruye compras, líneas, proveedores y catálogo desde Supabase", () => {
  const mapped = mapSupabaseBootstrap({
    suppliers:[{id:"11111111-1111-1111-1111-111111111111",organization_id:"O-1",name:"Proveedor sintético",status:"ACTIVE"}],
    catalogItems:[{id:"22222222-2222-2222-2222-222222222222",organization_id:"O-1",sku:"SYN-1",name:"Ítem sintético",cost:"4.50",base_price:"7.00",status:"ACTIVE"}],
    purchases:[{
      id:"33333333-3333-3333-3333-333333333333",organization_id:"O-1",code:"BORRADOR-3333",
      supplier_id:"11111111-1111-1111-1111-111111111111",purchase_date:"2026-08-27",purchase_kind:"ORDER",
      invoice_number:"FAC-SYN",status:"DRAFT",subtotal:"9",tax_amount:"1",discount_amount:".5",extra_amount:"2",total:"11.5",
      purchase_items:[{id:"44444444-4444-4444-4444-444444444444",catalog_item_id:"22222222-2222-2222-2222-222222222222",supplier_id:"11111111-1111-1111-1111-111111111111",description:"Ítem sintético",presentation:"Caja",quantity:"2",unit_cost:"4.50",tax_amount:"1",discount_amount:".5",line_total:"9.5"}]
    }]
  });
  assert.equal(mapped.suppliers[0].organizationId,"O-1");
  assert.equal(mapped.catalogItems[0].price,7);
  assert.equal(mapped.purchases[0].supplierId,"11111111-1111-1111-1111-111111111111");
  assert.equal(mapped.purchases[0].date,"2026-08-27");
  assert.equal(mapped.purchases[0].tax,1);
  assert.equal(mapped.purchases[0].items.length,1);
  assert.equal(mapped.purchases[0].items[0].presentation,"Caja");
  assert.equal(mapped.purchases[0].items[0].lineTotal,9.5);
});

test("CH13 usa RPC transaccional, tenant scope, idempotencia y DML cerrado", async () => {
  const [store,adapter,migration] = await Promise.all([
    readFile(storePath,"utf8"), readFile(adapterPath,"utf8"), readFile(migrationPath,"utf8")
  ]);
  assert.match(store,/requiredSync\("CREATE_PURCHASE_DRAFT"/);
  assert.doesNotMatch(store,/safeSync\("CREATE_PURCHASE"/);
  assert.match(adapter,/client\.rpc\("create_purchase_draft"/);
  assert.match(adapter,/\["suppliers", "suppliers", "\*"\]/);
  assert.match(adapter,/\["catalogItems", "catalog_items", "\*"\]/);
  for (const marker of [
    "pg_advisory_xact_lock","organization_id = v_org","status = 'ACTIVE'","'DRAFT_CREATED'",
    "CREATE_PURCHASE_DRAFT","purchase_items.organization_id = purchase.organization_id",
    "drop policy if exists purchases_org_select","drop policy if exists purchase_items_org_select",
    "revoke insert, update, delete on public.purchases from authenticated",
    "revoke insert, update, delete on public.purchase_items from authenticated",
    "set search_path = pg_catalog, public","tax_rate, tax_amount","v_line_total < 0"
  ]) assert.ok(migration.includes(marker),`falta ${marker}`);
  assert.doesNotMatch(migration,/disable row level security/i);
});

test("CH13 expone listado, dos modalidades, líneas, detalle y bloqueos observados", async () => {
  const [main,views] = await Promise.all([readFile(mainPath,"utf8"),readFile(viewsPath,"utf8")]);
  for (const label of [
    "¿Qué quieres crear?","Orden de compra","Caja menuda","Nueva compra caja menuda","Fecha*","Número de factura",
    "Observaciones","Buscar ítem","Ítem*","Proveedor*","Presentación*","Costo*","Cantidad*","Monto impuesto","Monto descuento",
    "+ Presentación","Añadir","Atrás","Guardar borrador","Subtotal","Descuentos","Extra","Impuesto","Total",
    "Detalles de compra","# Orden","Archivos adjuntos"
  ]) assert.ok(main.includes(label),`falta ${label}`);
  for (const label of [
    "Acciones","Tipo","Número","Proveedor","Total","# Factura","Fecha","Estado","Registro PT","Excel","Nuevo",
    "Ver","Editar detalles","Copiar","Imprimir PDF","Imprimir con montos","Imprimir en Excel","Anular"
  ]) assert.ok(views.includes(label),`falta ${label}`);
  assert.doesNotMatch(main,/IVA %/);
  assert.match(main,/no aprueba, recibe, anula ni mueve inventario/i);
});
