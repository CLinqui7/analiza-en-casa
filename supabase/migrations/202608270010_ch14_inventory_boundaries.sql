-- CH14: close direct inventory/master mutations and repair tenant-safe reads.
-- Existing movement effects remain available only through the previously
-- audited, idempotent apply_inventory_movement_v2 RPC.

alter table public.supply_kit_items enable row level security;

drop policy if exists inventory_items_write on public.inventory_items;
drop policy if exists inventory_lots_write on public.inventory_lots;
drop policy if exists inventory_movements_write on public.inventory_movements;
drop policy if exists inventory_reservations_write on public.inventory_reservations;
drop policy if exists inventory_closures_write on public.inventory_closures;
drop policy if exists inventory_closure_items_write on public.inventory_closure_items;
drop policy if exists supply_kits_write on public.supply_kits;
drop policy if exists supply_kit_items_write on public.supply_kit_items;
drop policy if exists suppliers_write on public.suppliers;
drop policy if exists warehouses_write on public.warehouses;

drop policy if exists suppliers_org_select on public.suppliers;
drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('inventory:read'));

drop policy if exists warehouses_org_select on public.warehouses;
drop policy if exists warehouses_read on public.warehouses;
create policy warehouses_read on public.warehouses for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('inventory:read'));

drop policy if exists inventory_items_org_select on public.inventory_items;
drop policy if exists inventory_items_read on public.inventory_items;
create policy inventory_items_read on public.inventory_items for select to authenticated
using (
  public.has_permission('inventory:read')
  and organization_id = public.current_organization_id()
  and exists (
    select 1 from public.catalog_items catalog
    join public.warehouses warehouse on warehouse.id = inventory_items.warehouse_id
    where catalog.id = inventory_items.catalog_item_id
      and catalog.organization_id = inventory_items.organization_id
      and warehouse.organization_id = inventory_items.organization_id
  )
);

drop policy if exists inventory_lots_org_select on public.inventory_lots;
drop policy if exists inventory_lots_read on public.inventory_lots;
create policy inventory_lots_read on public.inventory_lots for select to authenticated
using (
  public.has_permission('inventory:read')
  and exists (
    select 1 from public.inventory_items item
    where item.id = inventory_lots.inventory_item_id
      and item.organization_id = public.current_organization_id()
      and inventory_lots.organization_id = item.organization_id
  )
);

drop policy if exists inventory_movements_org_select on public.inventory_movements;
drop policy if exists inventory_movements_read on public.inventory_movements;
create policy inventory_movements_read on public.inventory_movements for select to authenticated
using (
  public.has_permission('inventory:read')
  and exists (
    select 1 from public.inventory_items item
    where item.id = inventory_movements.inventory_item_id
      and item.organization_id = public.current_organization_id()
      and inventory_movements.organization_id = item.organization_id
      and (inventory_movements.hospitalization_id is null or exists (
        select 1 from public.hospitalizations hospitalization
        where hospitalization.id = inventory_movements.hospitalization_id
          and hospitalization.organization_id = item.organization_id
      ))
      and (inventory_movements.warehouse_from_id is null or exists (
        select 1 from public.warehouses warehouse
        where warehouse.id = inventory_movements.warehouse_from_id
          and warehouse.organization_id = item.organization_id
      ))
      and (inventory_movements.warehouse_to_id is null or exists (
        select 1 from public.warehouses warehouse
        where warehouse.id = inventory_movements.warehouse_to_id
          and warehouse.organization_id = item.organization_id
      ))
  )
);

drop policy if exists inventory_closures_org_select on public.inventory_closures;
drop policy if exists inventory_closures_read on public.inventory_closures;
create policy inventory_closures_read on public.inventory_closures for select to authenticated
using (
  public.has_permission('inventory:read')
  and organization_id = public.current_organization_id()
  and exists (
    select 1 from public.hospitalizations hospitalization
    where hospitalization.id = inventory_closures.hospitalization_id
      and hospitalization.organization_id = inventory_closures.organization_id
  )
);

drop policy if exists inventory_reservations_org_select on public.inventory_reservations;
drop policy if exists inventory_reservations_read on public.inventory_reservations;
create policy inventory_reservations_read on public.inventory_reservations for select to authenticated
using (
  public.has_permission('inventory:read')
  and exists (
    select 1 from public.hospitalizations hospitalization
    join public.inventory_items item on item.id = inventory_reservations.inventory_item_id
    where hospitalization.id = inventory_reservations.hospitalization_id
      and hospitalization.organization_id = public.current_organization_id()
      and item.organization_id = hospitalization.organization_id
      and inventory_reservations.organization_id = hospitalization.organization_id
  )
);

drop policy if exists supply_kits_org_select on public.supply_kits;
drop policy if exists supply_kits_read on public.supply_kits;
create policy supply_kits_read on public.supply_kits for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('inventory:read'));

drop policy if exists inventory_closure_items_org_select on public.inventory_closure_items;
drop policy if exists inventory_closure_items_read on public.inventory_closure_items;
create policy inventory_closure_items_read on public.inventory_closure_items for select to authenticated
using (
  public.has_permission('inventory:read')
  and exists (
    select 1 from public.inventory_closures closure
    join public.inventory_items item on item.id = inventory_closure_items.inventory_item_id
    where closure.id = inventory_closure_items.closure_id
      and closure.organization_id = public.current_organization_id()
      and item.organization_id = closure.organization_id
      and inventory_closure_items.organization_id = closure.organization_id
  )
);

drop policy if exists supply_kit_items_read on public.supply_kit_items;
create policy supply_kit_items_read on public.supply_kit_items for select to authenticated
using (
  public.has_permission('inventory:read')
  and exists (
    select 1 from public.supply_kits kit
    join public.catalog_items catalog on catalog.id = supply_kit_items.catalog_item_id
    where kit.id = supply_kit_items.kit_id
      and kit.organization_id = public.current_organization_id()
      and catalog.organization_id = kit.organization_id
  )
);

revoke insert, update, delete on public.inventory_items from authenticated;
revoke insert, update, delete on public.inventory_lots from authenticated;
revoke insert, update, delete on public.inventory_movements from authenticated;
revoke insert, update, delete on public.inventory_reservations from authenticated;
revoke insert, update, delete on public.inventory_closures from authenticated;
revoke insert, update, delete on public.inventory_closure_items from authenticated;
revoke insert, update, delete on public.supply_kits from authenticated;
revoke insert, update, delete on public.supply_kit_items from authenticated;
revoke insert, update, delete on public.suppliers from authenticated;
revoke insert, update, delete on public.warehouses from authenticated;

comment on table public.inventory_closures is
  'CH14 closure writes remain closed until approval, reconciliation, reversal and data-loss rules are confirmed.';
comment on table public.supply_kits is
  'CH14 kit writes and automatic consumption remain closed until component/lote/concurrency rules are confirmed.';
