import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore, DEMO_PASSWORD } from "../app/store.js";
import { safeStorage } from "../app/domain.js";
import { mapSupabaseBootstrap } from "../app/supabase-adapter.js";

const mainPath = new URL("../app/main.js", import.meta.url);
const viewsPath = new URL("../app/views.js", import.meta.url);
const storePath = new URL("../app/store.js", import.meta.url);
const adapterPath = new URL("../app/supabase-adapter.js", import.meta.url);
const migrationPath = new URL("../supabase/migrations/20260827140639_ch15_catalogs.sql", import.meta.url);

async function isolatedStore(email = "admin@analiza.demo") {
  safeStorage.clear();
  const store = await createAppStore({ dataMode:"mock", notificationsMode:"mock" });
  await store.authenticate(email, DEMO_PASSWORD);
  return store;
}

function syntheticItem(sku = "CH15-SYN-001") {
  return {
    sku, category:"SUPPLIES", name:"Insumo sintético CH15", description:"Descripción sintética",
    unit:"unidad", cost:0, price:0, taxable:false, billable:true, discountAllowed:false,
    requiresLot:false, requiresSerial:false, manufacturer:"Fabricante sintético",
    validFrom:"2026-08-27", validUntil:"2026-12-31"
  };
}

test("CH15 crea, edita e inactiva un catálogo con auditoría e historial local", async () => {
  const store = await isolatedStore();
  const created = store.createCatalogItem(syntheticItem());
  assert.equal(created.organizationId, store.getState().organization.id);
  assert.equal(created.active, true);
  const updated = store.updateCatalogItem(created.id, { ...created, name:"Insumo sintético actualizado", price:1, requiresLot:true });
  assert.equal(updated.name, "Insumo sintético actualizado");
  assert.equal(updated.price, 1);
  assert.equal(updated.requiresLot, true);
  const inactive = store.inactivateCatalogItem(created.id, "Fin de vigencia sintética");
  assert.equal(inactive.active, false);
  const actions = store.getState().auditLogs.filter((entry) => entry.entity === created.id).map((entry) => entry.action);
  assert.ok(actions.includes("CREATE_CATALOG_ITEM"));
  assert.ok(actions.includes("UPDATE_CATALOG_ITEM"));
  assert.ok(actions.includes("INACTIVATE_CATALOG_ITEM"));
});

test("CH15 impide SKU duplicado, importación parcial y vigencias inválidas", async () => {
  const store = await isolatedStore();
  store.createCatalogItem(syntheticItem("CH15-SYN-DUP"));
  assert.throws(() => store.createCatalogItem(syntheticItem("ch15-syn-dup")), /ya existe/i);
  const before = store.getState().catalogItems.length;
  assert.throws(() => store.importCatalogItems([
    syntheticItem("CH15-CSV-001"),
    { ...syntheticItem("CH15-CSV-002"), validFrom:"2026-12-31", validUntil:"2026-01-01" }
  ]), /vigencia/i);
  assert.equal(store.getState().catalogItems.length, before);
});

test("CH15 importa un lote validado una sola vez y registra evidencia", async () => {
  const store = await isolatedStore();
  const imported = store.importCatalogItems([syntheticItem("CH15-CSV-A"), syntheticItem("CH15-CSV-B")]);
  assert.equal(imported.length, 2);
  assert.equal(store.getState().catalogItems.filter((item) => item.sku.startsWith("CH15-CSV-")).length, 2);
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "IMPORT_CATALOG_ITEMS" && entry.metadata?.count === 2));
});

test("CH15 mantiene AUDITOR sin mutaciones de catálogo", async () => {
  const store = await isolatedStore("auditoria@analiza.demo");
  assert.throws(() => store.createCatalogItem(syntheticItem()), /no tiene permiso/i);
  assert.throws(() => store.importCatalogItems([syntheticItem("CH15-AUD")]), /no tiene permiso/i);
});

test("CH15 reconstruye snake_case con metadatos de categoría", () => {
  const mapped = mapSupabaseBootstrap({ catalogItems:[{
    id:"00000000-0000-0000-0000-000000000015", organization_id:"ORG-1", sku:"CH15-MAP", category:"MEDICATIONS",
    name:"Medicamento sintético", description:"Sin indicación clínica", unit:"vial", cost:"2.50", base_price:"4.00",
    taxable:true, billable:true, discount_allowed:false, requires_lot:true, requires_serial:false,
    manufacturer:"Fabricante sintético", presentation:"Vial", administration_routes:["DOCUMENTADA"], status:"ACTIVE"
  }]});
  assert.equal(mapped.catalogItems[0].price, 4);
  assert.equal(mapped.catalogItems[0].cost, 2.5);
  assert.equal(mapped.catalogItems[0].discountAllowed, false);
  assert.deepEqual(mapped.catalogItems[0].administrationRoutes, ["DOCUMENTADA"]);
});

test("CH15 usa confirmación remota, RLS, historial y controles reales", async () => {
  const [main, views, store, adapter, migration] = await Promise.all([
    readFile(mainPath,"utf8"), readFile(viewsPath,"utf8"), readFile(storePath,"utf8"),
    readFile(adapterPath,"utf8"), readFile(migrationPath,"utf8")
  ]);
  for (const marker of ["parseCatalogCsv", "openCatalogImport", "confirm-catalog-import", "inactivate-catalog-item", "¿Está seguro de salir?"]) assert.ok(main.includes(marker), `falta ${marker}`);
  for (const marker of ["Tipo / categoría", "Trazabilidad", "catalog-page", "catalogPageSize", "Inactivar"]) assert.ok(views.includes(marker), `falta ${marker}`);
  for (const action of ["CREATE_CATALOG_ITEM", "UPDATE_CATALOG_ITEM", "INACTIVATE_CATALOG_ITEM", "IMPORT_CATALOG_ITEMS"]) {
    assert.ok(store.includes(`requiredSync("${action}"`), `falta confirmación ${action}`);
    assert.ok(adapter.includes(`case "${action}"`), `falta adaptador ${action}`);
  }
  for (const marker of [
    "alter table public.catalog_price_history enable row level security",
    "organization_id = (select public.current_organization_id())",
    "create unique index if not exists catalog_items_org_sku_ci_unique",
    "create or replace function public.save_catalog_item",
    "create or replace function public.import_catalog_items",
    "grant select on table public.catalog_items to authenticated",
    "revoke delete on table public.catalog_items from authenticated",
    "security definer",
    "set search_path = ''"
  ]) assert.ok(migration.includes(marker), `falta ${marker}`);
  assert.ok(adapter.includes('client.rpc("save_catalog_item"'));
  assert.ok(adapter.includes('client.rpc("import_catalog_items"'));
  assert.doesNotMatch(adapter, /organization_id\s*:/);
  assert.doesNotMatch(migration, /disable row level security/i);
});
