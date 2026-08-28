begin;

alter table public.catalog_items
  add column if not exists presentation text,
  add column if not exists manufacturer text;

alter table public.quotes
  add column if not exists price_list_id uuid references public.price_lists(id) on delete restrict;
alter table public.quote_versions
  add column if not exists price_list_id uuid references public.price_lists(id) on delete restrict;
alter table public.quote_items
  add column if not exists price_list_item_id uuid references public.price_list_items(id) on delete restrict;

create or replace function public.apply_quote_draft_catalog(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_price_list_id uuid,
  p_items jsonb,
  p_discount_group_id text,
  p_discount_reason text,
  p_insurer_amount numeric,
  p_comments text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_quote public.quotes%rowtype;
  v_version public.quote_versions%rowtype;
  v_item jsonb;
  v_catalog_id uuid;
  v_catalog public.catalog_items%rowtype;
  v_price_item public.price_list_items%rowtype;
  v_quantity numeric(14,3);
  v_line_amount numeric(14,2);
  v_category_percent numeric := 0;
  v_category_percentages jsonb := '{}'::jsonb;
  v_requires_reason boolean := false;
  v_requires_approval boolean := false;
  v_subtotal numeric(14,2) := 0;
  v_discount_amount numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_insurer_amount numeric(14,2) := 0;
  v_patient_amount numeric(14,2) := 0;
  v_normalized_items jsonb := '[]'::jsonb;
begin
  if not public.has_permission('quotes:write') then
    raise exception 'No tiene permiso para editar cotizaciones.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La cotización requiere al menos un concepto.';
  end if;

  select * into v_quote from public.quotes
  where id = p_quote_id and organization_id = v_organization_id
  for update;
  if not found or v_quote.status <> 'DRAFT' or v_quote.sent_at is not null then
    raise exception 'La cotización no es un borrador editable.';
  end if;

  select * into v_version from public.quote_versions
  where id = p_quote_version_id
    and quote_id = p_quote_id
    and organization_id = v_organization_id
  for update;
  if not found or v_version.immutable or v_version.status_snapshot <> 'DRAFT' then
    raise exception 'La versión no es un borrador editable.';
  end if;

  if p_price_list_id is null or not exists (
    select 1 from public.price_lists pl
    where pl.id = p_price_list_id
      and pl.organization_id = v_organization_id
      and pl.status = 'ACTIVE'
      and pl.valid_from <= current_date
      and (pl.valid_until is null or pl.valid_until >= current_date)
  ) then
    raise exception 'Seleccione una lista de precios vigente y autorizada.';
  end if;

  if p_discount_group_id <> 'REGULAR' then
    select d.category_percentages, d.requires_reason, d.requires_approval
    into v_category_percentages, v_requires_reason, v_requires_approval
    from public.discount_rules d
    where d.id::text = p_discount_group_id
      and d.organization_id = v_organization_id
      and d.status = 'ACTIVE'
      and (d.valid_from is null or d.valid_from <= current_date)
      and (d.valid_until is null or d.valid_until >= current_date);
    if not found then raise exception 'El grupo de descuento no está autorizado.'; end if;
    if v_requires_approval then raise exception 'El grupo de descuento requiere aprobación previa.'; end if;
    if v_requires_reason and coalesce(btrim(p_discount_reason), '') = '' then
      raise exception 'El motivo del descuento es obligatorio.';
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_catalog_id := (v_item ->> 'catalog_item_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::numeric;
    exception when others then
      raise exception 'Hay un concepto con catálogo o cantidad inválidos.';
    end;
    if v_quantity <= 0 then raise exception 'La cantidad debe ser mayor que cero.'; end if;

    select ci.* into v_catalog
    from public.catalog_items ci
    where ci.id = v_catalog_id
      and ci.organization_id = v_organization_id
      and ci.status = 'ACTIVE';
    if not found then raise exception 'El concepto no pertenece al catálogo autorizado.'; end if;

    select pli.* into v_price_item
    from public.price_list_items pli
    where pli.price_list_id = p_price_list_id
      and pli.catalog_item_id = v_catalog.id
      and pli.organization_id = v_organization_id;
    if not found then raise exception 'El concepto no tiene precio autorizado en la lista seleccionada.'; end if;

    v_line_amount := round(v_quantity * v_price_item.price, 2);
    v_category_percent := coalesce((v_category_percentages ->> v_catalog.category)::numeric, 0);
    if v_category_percent < 0 or v_category_percent > 100 then
      raise exception 'La regla de descuento configurada es inválida.';
    end if;
    v_subtotal := v_subtotal + v_line_amount;
    v_discount_amount := v_discount_amount + round(v_line_amount * v_category_percent / 100, 2);
    v_normalized_items := v_normalized_items || jsonb_build_array(jsonb_build_object(
      'catalog_item_id', v_catalog.id,
      'price_list_item_id', v_price_item.id,
      'category', v_catalog.category,
      'description', v_catalog.name,
      'quantity', v_quantity,
      'unit_price', v_price_item.price
    ));
  end loop;

  v_subtotal := round(v_subtotal, 2);
  v_discount_amount := least(round(v_discount_amount, 2), v_subtotal);
  v_total := round(v_subtotal - v_discount_amount, 2);
  v_insurer_amount := least(greatest(coalesce(p_insurer_amount, 0), 0), v_total);
  v_patient_amount := round(v_total - v_insurer_amount, 2);

  delete from public.quote_items where quote_version_id = p_quote_version_id;
  insert into public.quote_items (
    organization_id, quote_version_id, catalog_item_id, price_list_item_id,
    category, description, quantity, unit_price, discount_amount
  )
  select
    v_organization_id, p_quote_version_id, x.catalog_item_id, x.price_list_item_id,
    x.category, x.description, x.quantity, x.unit_price, 0
  from jsonb_to_recordset(v_normalized_items) as x(
    catalog_item_id uuid, price_list_item_id uuid, category text,
    description text, quantity numeric, unit_price numeric
  );

  update public.quote_versions set
    price_list_id = p_price_list_id,
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    total = v_total,
    insurer_amount = v_insurer_amount,
    patient_amount = v_patient_amount,
    discount_snapshot = jsonb_build_object(
      'group_id', p_discount_group_id,
      'reason', coalesce(p_discount_reason, ''),
      'category_percentages', v_category_percentages
    ),
    comments = p_comments,
    snapshot = jsonb_build_object(
      'price_list_id', p_price_list_id,
      'subtotal', v_subtotal,
      'discount_amount', v_discount_amount,
      'total', v_total,
      'insurer_amount', v_insurer_amount,
      'patient_amount', v_patient_amount,
      'items', v_normalized_items
    )
  where id = p_quote_version_id;

  update public.quotes set
    price_list_id = p_price_list_id,
    discount_group_id = p_discount_group_id,
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    total = v_total,
    insurer_amount = v_insurer_amount,
    patient_amount = v_patient_amount,
    comments = p_comments,
    updated_at = now()
  where id = p_quote_id;

  return jsonb_build_object(
    'quote_id', p_quote_id,
    'quote_version_id', p_quote_version_id,
    'subtotal', v_subtotal,
    'discount_amount', v_discount_amount,
    'total', v_total,
    'insurer_amount', v_insurer_amount,
    'patient_amount', v_patient_amount
  );
end
$$;

revoke all on function public.apply_quote_draft_catalog(uuid, uuid, uuid, jsonb, text, text, numeric, text) from public, anon, authenticated;

create or replace function public.create_quote_draft(
  p_code text,
  p_hospitalization_id uuid,
  p_patient_id uuid,
  p_price_list_id uuid,
  p_items jsonb,
  p_currency text,
  p_insurer_amount numeric,
  p_invoice_date date,
  p_discount_group_id text,
  p_discount_reason text,
  p_referred_by text,
  p_giftcard text,
  p_comments text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_quote_id uuid;
  v_version_id uuid;
  v_result jsonb;
begin
  if not public.has_permission('quotes:write') then raise exception 'No tiene permiso para crear cotizaciones.'; end if;
  if not exists (
    select 1 from public.hospitalizations h
    where h.id = p_hospitalization_id
      and h.patient_id = p_patient_id
      and h.organization_id = v_organization_id
  ) then raise exception 'La hospitalización y el paciente no pertenecen al alcance autorizado.'; end if;

  insert into public.quotes (
    organization_id, code, hospitalization_id, patient_id, status, current_version,
    currency, subtotal, discount_amount, total, insurer_amount, patient_amount,
    comments, invoice_date, discount_group_id, referred_by, giftcard, price_list_id, created_by
  ) values (
    v_organization_id, btrim(p_code), p_hospitalization_id, p_patient_id, 'DRAFT', 1,
    upper(coalesce(p_currency, 'USD')), 0, 0, 0, 0, 0,
    p_comments, p_invoice_date, p_discount_group_id, p_referred_by, nullif(btrim(p_giftcard), ''), p_price_list_id, auth.uid()
  ) returning id into v_quote_id;

  insert into public.quote_versions (
    organization_id, quote_id, version, status_snapshot, subtotal, discount_amount,
    total, insurer_amount, patient_amount, discount_snapshot, comments, immutable,
    snapshot, price_list_id, created_by
  ) values (
    v_organization_id, v_quote_id, 1, 'DRAFT', 0, 0, 0, 0, 0, '{}'::jsonb,
    p_comments, false, '{}'::jsonb, p_price_list_id, auth.uid()
  ) returning id into v_version_id;

  v_result := public.apply_quote_draft_catalog(
    v_quote_id, v_version_id, p_price_list_id, p_items, p_discount_group_id,
    p_discount_reason, p_insurer_amount, p_comments
  );
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_organization_id, auth.uid(), 'CREATE_QUOTE', 'quote', v_quote_id::text,
    'Cotización creada de forma transaccional con precios de catálogo.', v_result);
  return v_result;
end
$$;

create or replace function public.update_quote_draft_catalog(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_price_list_id uuid,
  p_items jsonb,
  p_insurer_amount numeric,
  p_invoice_date date,
  p_discount_group_id text,
  p_discount_reason text,
  p_referred_by text,
  p_giftcard text,
  p_comments text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  update public.quotes set
    invoice_date = p_invoice_date,
    discount_group_id = p_discount_group_id,
    referred_by = p_referred_by,
    giftcard = nullif(btrim(p_giftcard), ''),
    comments = p_comments,
    updated_at = now()
  where id = p_quote_id
    and organization_id = public.current_organization_id()
    and status = 'DRAFT'
    and sent_at is null;
  if not found then raise exception 'La cotización no es un borrador editable.'; end if;

  v_result := public.apply_quote_draft_catalog(
    p_quote_id, p_quote_version_id, p_price_list_id, p_items,
    p_discount_group_id, p_discount_reason, p_insurer_amount, p_comments
  );
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (public.current_organization_id(), auth.uid(), 'UPDATE_QUOTE_DRAFT', 'quote_version', p_quote_version_id::text,
    'Borrador recalculado de forma transaccional con precios de catálogo.', v_result);
  return v_result;
end
$$;

create or replace function public.create_quote_revision_catalog(
  p_quote_id uuid,
  p_source_version_id uuid,
  p_reason text,
  p_price_list_id uuid,
  p_items jsonb,
  p_insurer_amount numeric,
  p_invoice_date date,
  p_discount_group_id text,
  p_discount_reason text,
  p_referred_by text,
  p_giftcard text,
  p_comments text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_new_version_id uuid;
  v_result jsonb;
begin
  if not public.has_permission('quotes:write') then raise exception 'No tiene permiso para versionar cotizaciones.'; end if;

  -- create_quote_revision locks the root, validates the immutable source and creates
  -- the sequential draft. Any later exception rolls that work back with this RPC.
  v_new_version_id := public.create_quote_revision(p_quote_id, p_source_version_id, p_reason);

  update public.quotes set
    invoice_date = p_invoice_date,
    discount_group_id = p_discount_group_id,
    referred_by = p_referred_by,
    giftcard = nullif(btrim(p_giftcard), ''),
    comments = p_comments,
    updated_at = now()
  where id = p_quote_id and organization_id = v_organization_id;
  if not found then raise exception 'Cotización no disponible.'; end if;

  v_result := public.apply_quote_draft_catalog(
    p_quote_id, v_new_version_id, p_price_list_id, p_items,
    p_discount_group_id, p_discount_reason, p_insurer_amount, p_comments
  );
  return v_result || jsonb_build_object('previous_version_id', p_source_version_id, 'revision_reason', btrim(p_reason));
end
$$;

revoke all on function public.create_quote_draft(text, uuid, uuid, uuid, jsonb, text, numeric, date, text, text, text, text, text) from public, anon;
revoke all on function public.update_quote_draft_catalog(uuid, uuid, uuid, jsonb, numeric, date, text, text, text, text, text) from public, anon;
revoke all on function public.create_quote_revision_catalog(uuid, uuid, text, uuid, jsonb, numeric, date, text, text, text, text, text) from public, anon;
revoke execute on function public.create_quote_revision(uuid, uuid, text) from authenticated;
grant execute on function public.create_quote_draft(text, uuid, uuid, uuid, jsonb, text, numeric, date, text, text, text, text, text) to authenticated;
grant execute on function public.update_quote_draft_catalog(uuid, uuid, uuid, jsonb, numeric, date, text, text, text, text, text) to authenticated;
grant execute on function public.create_quote_revision_catalog(uuid, uuid, text, uuid, jsonb, numeric, date, text, text, text, text, text) to authenticated;

-- Financial mutations are RPC-only. RLS remains enabled and read policies remain scoped.
revoke insert, update, delete on public.quotes from authenticated;
revoke insert, update, delete on public.quote_versions from authenticated;
revoke insert, update, delete on public.quote_items from authenticated;

commit;
