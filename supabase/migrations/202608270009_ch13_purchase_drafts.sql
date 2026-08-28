-- CH13: transactionally persist purchase drafts without inventing approval,
-- receipt, tax, attachment, Registro PT, cancellation or inventory rules.

alter table public.purchases
  add column if not exists purchase_kind text not null default 'ORDER'
    check (purchase_kind in ('ORDER','PETTY_CASH')),
  add column if not exists observations text,
  add column if not exists extra_amount numeric(14,2) not null default 0 check (extra_amount >= 0),
  add column if not exists registry_status text not null default 'Sin Registro',
  add column if not exists idempotency_key text;

alter table public.purchase_items
  add column if not exists supplier_id uuid references public.suppliers(id) on delete restrict,
  add column if not exists presentation text,
  add column if not exists tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0);

create unique index if not exists purchases_org_idempotency_idx
  on public.purchases (organization_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.purchase_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, event_type, idempotency_key)
);

alter table public.purchase_events enable row level security;

drop policy if exists purchase_events_select on public.purchase_events;
create policy purchase_events_select on public.purchase_events for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('purchases:read')
);

drop policy if exists purchases_org_select on public.purchases;
drop policy if exists purchases_read on public.purchases;
create policy purchases_read on public.purchases for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('purchases:read')
);

-- Read a line only through a purchase owned by the active organization. This
-- closes the legacy row-only policy that could expose an inconsistent cross-org reference.
drop policy if exists purchase_items_org_select on public.purchase_items;
drop policy if exists purchase_items_read on public.purchase_items;
create policy purchase_items_read on public.purchase_items for select to authenticated
using (
  public.has_permission('purchases:read')
  and exists (
    select 1
    from public.purchases purchase
    where purchase.id = purchase_items.purchase_id
      and purchase.organization_id = public.current_organization_id()
      and purchase_items.organization_id = purchase.organization_id
  )
);

create or replace function public.create_purchase_draft(
  p_supplier_id uuid,
  p_purchase_date date,
  p_invoice_number text,
  p_observations text,
  p_purchase_kind text,
  p_extra_amount numeric,
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_purchase public.purchases%rowtype;
  v_purchase_id uuid;
  v_supplier public.suppliers%rowtype;
  v_catalog public.catalog_items%rowtype;
  v_item jsonb;
  v_item_supplier_id uuid;
  v_catalog_item_id uuid;
  v_presentation text;
  v_quantity numeric;
  v_unit_cost numeric;
  v_tax_amount numeric;
  v_discount_amount numeric;
  v_line_subtotal numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_discount numeric := 0;
  v_extra numeric;
  v_total numeric;
begin
  if v_org is null or not public.has_permission('purchases:write') then
    raise exception 'No tiene permiso para crear borradores de compra.';
  end if;
  if p_purchase_date is null
    or p_purchase_kind not in ('ORDER','PETTY_CASH')
    or (p_purchase_kind = 'PETTY_CASH' and nullif(btrim(coalesce(p_invoice_number,'')), '') is null)
    or length(coalesce(p_invoice_number,'')) > 160
    or length(coalesce(p_observations,'')) > 5000
    or nullif(btrim(coalesce(p_idempotency_key,'')), '') is null
    or length(p_idempotency_key) > 160
    or p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 200 then
    raise exception 'Revise los datos del borrador de compra.';
  end if;

  v_extra := round(coalesce(p_extra_amount,0),2);
  if v_extra < 0 then raise exception 'El monto extra no puede ser negativo.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':purchase-draft:' || p_idempotency_key, 0));
  select * into v_purchase
  from public.purchases
  where organization_id = v_org and idempotency_key = p_idempotency_key;
  if found then
    return to_jsonb(v_purchase) || jsonb_build_object(
      'purchase_items', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.created_at, item.id)
        from public.purchase_items item
        where item.purchase_id = v_purchase.id and item.organization_id = v_org
      ), '[]'::jsonb)
    );
  end if;

  select * into v_supplier
  from public.suppliers
  where id = p_supplier_id and organization_id = v_org and status = 'ACTIVE'
  for share;
  if not found then raise exception 'Proveedor no disponible en la organización.'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_catalog_item_id := nullif(v_item ->> 'catalog_item_id','')::uuid;
      v_item_supplier_id := coalesce(nullif(v_item ->> 'supplier_id','')::uuid, p_supplier_id);
      v_quantity := (v_item ->> 'quantity')::numeric;
      v_unit_cost := round((v_item ->> 'unit_cost')::numeric,2);
      v_tax_amount := round(coalesce(nullif(v_item ->> 'tax_amount','')::numeric,0),2);
      v_discount_amount := round(coalesce(nullif(v_item ->> 'discount_amount','')::numeric,0),2);
      v_presentation := btrim(coalesce(v_item ->> 'presentation',''));
    exception when others then
      raise exception 'Un ítem contiene datos inválidos.';
    end;

    select * into v_catalog from public.catalog_items
    where id = v_catalog_item_id and organization_id = v_org and status = 'ACTIVE'
    for share;
    if not found then raise exception 'Ítem de catálogo no disponible en la organización.'; end if;
    if not exists (
      select 1 from public.suppliers
      where id = v_item_supplier_id and organization_id = v_org and status = 'ACTIVE'
    ) then raise exception 'Proveedor de línea no disponible en la organización.'; end if;
    if v_quantity <= 0 or v_unit_cost < 0 or v_tax_amount < 0 or v_discount_amount < 0
      or nullif(v_presentation,'') is null or length(v_presentation) > 160 then
      raise exception 'Revise cantidad, costo, presentación y ajustes del ítem.';
    end if;
    v_line_subtotal := round(v_quantity * v_unit_cost,2);
    v_line_total := round(v_line_subtotal + v_tax_amount - v_discount_amount,2);
    if v_line_total < 0 then raise exception 'Un descuento de línea produce un total negativo.'; end if;
    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax := v_tax + v_tax_amount;
    v_discount := v_discount + v_discount_amount;
  end loop;

  v_subtotal := round(v_subtotal,2);
  v_tax := round(v_tax,2);
  v_discount := round(v_discount,2);
  v_total := round(v_subtotal + v_tax + v_extra - v_discount,2);
  if v_total < 0 then raise exception 'Los ajustes producen un total negativo.'; end if;

  v_purchase_id := gen_random_uuid();
  insert into public.purchases (
    id, organization_id, code, supplier_id, invoice_number, purchase_date,
    payment_type, status, subtotal, tax_amount, discount_amount, extra_amount,
    total, created_by, purchase_kind, observations, registry_status, idempotency_key
  ) values (
    v_purchase_id, v_org,
    'BORRADOR-' || upper(substr(replace(v_purchase_id::text,'-',''),1,12)),
    v_supplier.id, nullif(btrim(coalesce(p_invoice_number,'')), ''), p_purchase_date,
    'UNCONFIRMED', 'DRAFT', v_subtotal, v_tax, v_discount, v_extra,
    v_total, auth.uid(), p_purchase_kind,
    nullif(btrim(coalesce(p_observations,'')), ''), 'Sin Registro', p_idempotency_key
  ) returning * into v_purchase;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_catalog_item_id := (v_item ->> 'catalog_item_id')::uuid;
    v_item_supplier_id := coalesce(nullif(v_item ->> 'supplier_id','')::uuid, p_supplier_id);
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_cost := round((v_item ->> 'unit_cost')::numeric,2);
    v_tax_amount := round(coalesce(nullif(v_item ->> 'tax_amount','')::numeric,0),2);
    v_discount_amount := round(coalesce(nullif(v_item ->> 'discount_amount','')::numeric,0),2);
    v_presentation := btrim(v_item ->> 'presentation');
    select * into v_catalog from public.catalog_items where id = v_catalog_item_id and organization_id = v_org;
    v_line_total := round(v_quantity * v_unit_cost + v_tax_amount - v_discount_amount,2);
    insert into public.purchase_items (
      organization_id, purchase_id, catalog_item_id, supplier_id, description,
      presentation, quantity, unit_cost, tax_rate, tax_amount, discount_amount, line_total
    ) values (
      v_org, v_purchase.id, v_catalog.id, v_item_supplier_id, v_catalog.name,
      v_presentation, v_quantity, v_unit_cost, 0, v_tax_amount, v_discount_amount, v_line_total
    );
  end loop;

  insert into public.purchase_events (
    organization_id, purchase_id, event_type, actor_user_id, idempotency_key, metadata
  ) values (
    v_org, v_purchase.id, 'DRAFT_CREATED', auth.uid(), p_idempotency_key,
    jsonb_build_object('purchase_kind', p_purchase_kind, 'item_count', jsonb_array_length(p_items))
  );
  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_org, auth.uid(), 'CREATE_PURCHASE_DRAFT', 'purchase', v_purchase.id::text,
    'Borrador de compra creado y confirmado.',
    jsonb_build_object('idempotency_key', p_idempotency_key, 'purchase_kind', p_purchase_kind, 'item_count', jsonb_array_length(p_items))
  );

  return to_jsonb(v_purchase) || jsonb_build_object(
    'purchase_items', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.created_at, item.id)
      from public.purchase_items item
      where item.purchase_id = v_purchase.id and item.organization_id = v_org
    ), '[]'::jsonb)
  );
end
$$;

drop policy if exists purchases_write on public.purchases;
drop policy if exists purchase_items_write on public.purchase_items;

revoke insert, update, delete on public.purchases from authenticated;
revoke insert, update, delete on public.purchase_items from authenticated;
revoke insert, update, delete on public.purchase_events from authenticated;
grant select on public.purchase_events to authenticated;

revoke all on function public.create_purchase_draft(uuid, date, text, text, text, numeric, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.create_purchase_draft(uuid, date, text, text, text, numeric, jsonb, text)
  to authenticated;

comment on function public.create_purchase_draft(uuid, date, text, text, text, numeric, jsonb, text) is
  'CH13 creates tenant-scoped, idempotent DRAFT purchases only. Amounts are explicit inputs; no tax rate, approval, receipt, attachment or inventory rule is inferred.';
