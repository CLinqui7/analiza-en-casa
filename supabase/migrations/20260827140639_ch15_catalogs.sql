-- CH15 catalog master data. Financial, tax, logistics and clinical semantics remain configurable.

alter table public.catalog_items
  add column if not exists billable boolean not null default false,
  add column if not exists discount_allowed boolean not null default false,
  add column if not exists giftcard_allowed boolean not null default false,
  add column if not exists cold_chain boolean not null default false,
  add column if not exists manufacturer text,
  add column if not exists product_type text,
  add column if not exists service_category text,
  add column if not exists presentation text,
  add column if not exists administration_routes jsonb not null default '[]'::jsonb,
  add column if not exists supplier_id uuid references public.suppliers(id) on delete restrict,
  add column if not exists valid_from date,
  add column if not exists valid_until date,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.catalog_items
  drop constraint if exists catalog_items_validity_check;

alter table public.catalog_items
  add constraint catalog_items_validity_check
  check (valid_until is null or valid_from is null or valid_until >= valid_from);

create unique index if not exists catalog_items_org_sku_ci_unique
  on public.catalog_items (organization_id, lower(sku));

create table if not exists public.catalog_price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  catalog_item_id uuid not null references public.catalog_items(id) on delete restrict,
  cost numeric(14,2) not null check (cost >= 0),
  base_price numeric(14,2) not null check (base_price >= 0),
  valid_from date,
  valid_until date,
  change_reason text not null default 'CATALOG_UPDATE',
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

alter table public.catalog_price_history enable row level security;

drop policy if exists catalog_price_history_select on public.catalog_price_history;
create policy catalog_price_history_select on public.catalog_price_history
for select to authenticated
using (organization_id = (select public.current_organization_id()));

revoke all on table public.catalog_price_history from anon, authenticated;
grant select on table public.catalog_price_history to authenticated;

create index if not exists catalog_price_history_item_date_idx
  on public.catalog_price_history (catalog_item_id, created_at desc);

create schema if not exists private;

create or replace function private.record_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_name text;
  v_actor_role text;
  v_action text;
begin
  if (select auth.uid()) is null
     or new.organization_id <> (select public.current_organization_id())
     or not (select public.has_permission('catalogs:write')) then
    raise exception 'Operación de catálogo no autorizada.' using errcode = '42501';
  end if;

  select coalesce(p.full_name, u.email), max(r.code)
    into v_actor_name, v_actor_role
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_roles ur
    on ur.user_id = u.id and ur.organization_id = new.organization_id
  left join public.roles r on r.id = ur.role_id
  where u.id = (select auth.uid());
  group by p.full_name, u.email;

  v_action := case
    when tg_op = 'INSERT' then 'CREATE_CATALOG_ITEM'
    when old.status <> new.status and new.status = 'INACTIVE' then 'INACTIVATE_CATALOG_ITEM'
    else 'UPDATE_CATALOG_ITEM'
  end;

  if tg_op = 'INSERT'
     or old.cost is distinct from new.cost
     or old.base_price is distinct from new.base_price
     or old.valid_from is distinct from new.valid_from
     or old.valid_until is distinct from new.valid_until then
    insert into public.catalog_price_history (
      organization_id, catalog_item_id, cost, base_price, valid_from, valid_until,
      change_reason, changed_by
    ) values (
      new.organization_id, new.id, new.cost, new.base_price, new.valid_from, new.valid_until,
      v_action, (select auth.uid())
    );
  end if;

  insert into public.audit_logs (
    organization_id, actor_user_id, actor_name, actor_role, action,
    entity_type, entity_id, summary, metadata
  ) values (
    new.organization_id, (select auth.uid()), v_actor_name, v_actor_role, v_action,
    'CATALOG_ITEM', new.id::text,
    case when v_action = 'INACTIVATE_CATALOG_ITEM'
      then 'Ítem de catálogo inactivado.'
      else 'Ítem de catálogo guardado.' end,
    jsonb_build_object('sku', new.sku, 'category', new.category, 'status', new.status)
  );

  return new;
end;
$$;

revoke all on function private.record_catalog_change() from public, anon, authenticated;

drop trigger if exists catalog_items_record_change on public.catalog_items;
create trigger catalog_items_record_change
after insert or update on public.catalog_items
for each row execute function private.record_catalog_change();

create or replace function public.save_catalog_item(
  p_catalog_item_id uuid,
  p_item jsonb,
  p_inactivation_reason text default null
)
returns public.catalog_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_metadata jsonb := coalesce(p_item -> 'metadata', '{}'::jsonb);
  v_result public.catalog_items;
begin
  if (select auth.uid()) is null
     or v_organization_id is null
     or not (select public.has_permission('catalogs:write')) then
    raise exception 'Operación de catálogo no autorizada.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_item) <> 'object' then
    raise exception 'Datos de catálogo inválidos.' using errcode = '22023';
  end if;
  if p_inactivation_reason is not null then
    if length(btrim(p_inactivation_reason)) not between 1 and 500 then
      raise exception 'Motivo de inactivación inválido.' using errcode = '22023';
    end if;
    v_metadata := v_metadata || jsonb_build_object('inactivation_reason', btrim(p_inactivation_reason));
  end if;

  if p_catalog_item_id is null then
    insert into public.catalog_items (
      organization_id, sku, category, name, description, unit, cost, base_price,
      taxable, billable, discount_allowed, giftcard_allowed, requires_lot,
      requires_serial, internal_use, cold_chain, manufacturer, product_type,
      service_category, presentation, administration_routes, supplier_id,
      valid_from, valid_until, metadata, status
    ) values (
      v_organization_id,
      nullif(btrim(p_item ->> 'sku'), ''),
      nullif(btrim(p_item ->> 'category'), ''),
      nullif(btrim(p_item ->> 'name'), ''),
      nullif(btrim(p_item ->> 'description'), ''),
      coalesce(nullif(btrim(p_item ->> 'unit'), ''), 'unidad'),
      coalesce(nullif(p_item ->> 'cost', '')::numeric, 0),
      coalesce(nullif(p_item ->> 'base_price', '')::numeric, 0),
      coalesce((p_item ->> 'taxable')::boolean, false),
      coalesce((p_item ->> 'billable')::boolean, false),
      coalesce((p_item ->> 'discount_allowed')::boolean, false),
      coalesce((p_item ->> 'giftcard_allowed')::boolean, false),
      coalesce((p_item ->> 'requires_lot')::boolean, false),
      coalesce((p_item ->> 'requires_serial')::boolean, false),
      coalesce((p_item ->> 'internal_use')::boolean, false),
      coalesce((p_item ->> 'cold_chain')::boolean, false),
      nullif(btrim(p_item ->> 'manufacturer'), ''),
      nullif(btrim(p_item ->> 'product_type'), ''),
      nullif(btrim(p_item ->> 'service_category'), ''),
      nullif(btrim(p_item ->> 'presentation'), ''),
      coalesce(p_item -> 'administration_routes', '[]'::jsonb),
      nullif(p_item ->> 'supplier_id', '')::uuid,
      nullif(p_item ->> 'valid_from', '')::date,
      nullif(p_item ->> 'valid_until', '')::date,
      v_metadata,
      case when p_item ->> 'status' = 'INACTIVE' then 'INACTIVE' else 'ACTIVE' end
    ) returning * into v_result;
  else
    update public.catalog_items set
      sku = nullif(btrim(p_item ->> 'sku'), ''),
      category = nullif(btrim(p_item ->> 'category'), ''),
      name = nullif(btrim(p_item ->> 'name'), ''),
      description = nullif(btrim(p_item ->> 'description'), ''),
      unit = coalesce(nullif(btrim(p_item ->> 'unit'), ''), 'unidad'),
      cost = coalesce(nullif(p_item ->> 'cost', '')::numeric, 0),
      base_price = coalesce(nullif(p_item ->> 'base_price', '')::numeric, 0),
      taxable = coalesce((p_item ->> 'taxable')::boolean, false),
      billable = coalesce((p_item ->> 'billable')::boolean, false),
      discount_allowed = coalesce((p_item ->> 'discount_allowed')::boolean, false),
      giftcard_allowed = coalesce((p_item ->> 'giftcard_allowed')::boolean, false),
      requires_lot = coalesce((p_item ->> 'requires_lot')::boolean, false),
      requires_serial = coalesce((p_item ->> 'requires_serial')::boolean, false),
      internal_use = coalesce((p_item ->> 'internal_use')::boolean, false),
      cold_chain = coalesce((p_item ->> 'cold_chain')::boolean, false),
      manufacturer = nullif(btrim(p_item ->> 'manufacturer'), ''),
      product_type = nullif(btrim(p_item ->> 'product_type'), ''),
      service_category = nullif(btrim(p_item ->> 'service_category'), ''),
      presentation = nullif(btrim(p_item ->> 'presentation'), ''),
      administration_routes = coalesce(p_item -> 'administration_routes', '[]'::jsonb),
      supplier_id = nullif(p_item ->> 'supplier_id', '')::uuid,
      valid_from = nullif(p_item ->> 'valid_from', '')::date,
      valid_until = nullif(p_item ->> 'valid_until', '')::date,
      metadata = v_metadata,
      status = case when p_item ->> 'status' = 'INACTIVE' then 'INACTIVE' else 'ACTIVE' end
    where id = p_catalog_item_id and organization_id = v_organization_id
    returning * into v_result;
    if v_result.id is null then
      raise exception 'Ítem de catálogo no disponible.' using errcode = 'P0002';
    end if;
  end if;
  return v_result;
end;
$$;

create or replace function public.import_catalog_items(p_items jsonb)
returns setof public.catalog_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_result public.catalog_items;
  v_count integer;
begin
  if (select auth.uid()) is null
     or (select public.current_organization_id()) is null
     or not (select public.has_permission('catalogs:write')) then
    raise exception 'Operación de catálogo no autorizada.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'La importación requiere un arreglo JSON.' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count not between 1 and 500 then
    raise exception 'La importación requiere entre 1 y 500 filas.' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_result := public.save_catalog_item(null, v_item, null);
    return next v_result;
  end loop;
  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata
  ) values (
    (select public.current_organization_id()), (select auth.uid()),
    'IMPORT_CATALOG_ITEMS', 'CATALOG_BATCH', null,
    'Lote de catálogo sintético importado.', jsonb_build_object('count', v_count)
  );
end;
$$;

revoke all on function public.save_catalog_item(uuid, jsonb, text) from public, anon;
revoke all on function public.import_catalog_items(jsonb) from public, anon;
grant execute on function public.save_catalog_item(uuid, jsonb, text) to authenticated;
grant execute on function public.import_catalog_items(jsonb) to authenticated;

revoke all on table public.catalog_items from anon, authenticated;
grant select on table public.catalog_items to authenticated;

-- Catalog masters are inactivated, never deleted from operational history.
revoke delete on table public.catalog_items from authenticated;
