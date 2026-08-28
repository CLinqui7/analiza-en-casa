-- CH16: versioned discount profiles and explicit approval workflow.
-- All writes are RPC-only; configuration does not infer legal, tax, or clinical rules.
begin;

alter table public.patients
  add column if not exists is_retired boolean not null default false;

alter table public.hospitalizations
  add column if not exists company_name text;

alter table public.discount_rules
  add column if not exists description text,
  add column if not exists calculation_type text not null default 'CATEGORY_PERCENTAGES'
    check (calculation_type in ('CATEGORY_PERCENTAGES', 'FIXED')),
  add column if not exists fixed_amount numeric(14,2) not null default 0 check (fixed_amount >= 0),
  add column if not exists eligibility jsonb not null default '{}'::jsonb,
  add column if not exists excluded_categories jsonb not null default '[]'::jsonb,
  add column if not exists max_amount numeric(14,2) check (max_amount is null or max_amount >= 0),
  add column if not exists combinable boolean not null default false,
  add column if not exists approver_user_id uuid references public.profiles(id) on delete restrict,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.discount_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  discount_rule_id uuid not null references public.discount_rules(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  quote_version_id uuid,
  quote_context jsonb not null default '{}'::jsonb,
  request_key text not null,
  reason text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  approver_user_id uuid not null references public.profiles(id) on delete restrict,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '',
  calculated_discount_amount numeric(14,2) not null default 0 check (calculated_discount_amount >= 0),
  unique (organization_id, request_key)
);

alter table public.quote_versions
  add column if not exists discount_approval_request_id uuid references public.discount_approval_requests(id) on delete restrict;

alter table public.discount_approval_requests
  drop constraint if exists discount_approval_requests_quote_version_id_fkey,
  add constraint discount_approval_requests_quote_version_id_fkey
    foreign key (quote_version_id) references public.quote_versions(id) on delete restrict;

create index if not exists discount_approval_requests_org_status_idx
  on public.discount_approval_requests (organization_id, status, approver_user_id, requested_at desc);
create index if not exists discount_approval_requests_rule_case_idx
  on public.discount_approval_requests (organization_id, discount_rule_id, hospitalization_id, patient_id);

alter table public.discount_approval_requests enable row level security;
drop policy if exists discount_approval_requests_select on public.discount_approval_requests;
create policy discount_approval_requests_select on public.discount_approval_requests
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (public.has_permission('quotes:read') or approver_user_id = auth.uid())
);

-- Discount profile and approval writes use the audited RPCs below; reads remain RLS-scoped.
revoke all on table public.discount_rules from anon, authenticated;
revoke all on table public.discount_approval_requests from anon, authenticated;
grant select on table public.discount_rules to authenticated;
grant select on table public.discount_approval_requests to authenticated;

create or replace function public.save_discount_rule(
  p_discount_rule_id uuid,
  p_rule jsonb,
  p_inactivation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_rule public.discount_rules%rowtype;
  v_existing public.discount_rules%rowtype;
  v_name text := btrim(coalesce(p_rule ->> 'name', ''));
  v_rule_type text := upper(coalesce(nullif(btrim(p_rule ->> 'rule_type'), ''), 'PROFILE'));
  v_calculation_type text := upper(coalesce(nullif(btrim(p_rule ->> 'calculation_type'), ''), 'CATEGORY_PERCENTAGES'));
  v_categories jsonb := coalesce(p_rule -> 'category_percentages', '{}'::jsonb);
  v_exclusions jsonb := coalesce(p_rule -> 'excluded_categories', '[]'::jsonb);
  v_eligibility jsonb := coalesce(p_rule -> 'eligibility', '{}'::jsonb);
  v_fixed_amount numeric(14,2) := coalesce(nullif(p_rule ->> 'fixed_amount', '')::numeric, 0);
  v_max_amount numeric(14,2) := nullif(p_rule ->> 'max_amount', '')::numeric;
  v_valid_from date := nullif(p_rule ->> 'valid_from', '')::date;
  v_valid_until date := nullif(p_rule ->> 'valid_until', '')::date;
  v_requires_reason boolean := coalesce((p_rule ->> 'requires_reason')::boolean, false);
  v_requires_approval boolean := coalesce((p_rule ->> 'requires_approval')::boolean, false);
  v_combinable boolean := coalesce((p_rule ->> 'combinable')::boolean, false);
  v_status text := upper(coalesce(nullif(btrim(p_rule ->> 'status'), ''), 'ACTIVE'));
  v_approver_user_id uuid := nullif(p_rule ->> 'approver_user_id', '')::uuid;
  v_category text;
  v_percent numeric;
begin
  if not public.has_permission('catalogs:write') then
    raise exception 'No tiene permiso para administrar perfiles de descuento.';
  end if;
  if jsonb_typeof(p_rule) <> 'object' or v_name = '' or length(v_name) > 200 then
    raise exception 'El nombre del perfil de descuento es obligatorio y debe ser válido.';
  end if;
  if v_calculation_type not in ('CATEGORY_PERCENTAGES', 'FIXED') then
    raise exception 'El tipo de cálculo del descuento no es válido.';
  end if;
  if v_status not in ('ACTIVE', 'INACTIVE') then
    raise exception 'El estado del perfil de descuento no es válido.';
  end if;
  if v_fixed_amount < 0 or (v_calculation_type = 'FIXED' and v_fixed_amount <= 0) then
    raise exception 'El monto fijo del descuento no es válido.';
  end if;
  if v_max_amount is not null and v_max_amount < 0 then
    raise exception 'El límite máximo del descuento no es válido.';
  end if;
  if v_valid_from is not null and v_valid_until is not null and v_valid_until < v_valid_from then
    raise exception 'La vigencia final no puede ser anterior a la inicial.';
  end if;
  if jsonb_typeof(v_categories) <> 'object' or jsonb_typeof(v_exclusions) <> 'array' or jsonb_typeof(v_eligibility) <> 'object' then
    raise exception 'La configuración del perfil de descuento no tiene el formato esperado.';
  end if;
  for v_category in select jsonb_object_keys(v_categories)
  loop
    if v_category not in ('SERVICES', 'STUDIES', 'MEDICATIONS', 'SUPPLIES', 'EQUIPMENT', 'FEES', 'EXTRAS') then
      raise exception 'La categoría de descuento no está autorizada.';
    end if;
    begin
      v_percent := (v_categories ->> v_category)::numeric;
    exception when others then
      raise exception 'El porcentaje configurado no es válido.';
    end;
    if v_percent < 0 or v_percent > 100 then
      raise exception 'El porcentaje configurado debe estar entre 0 y 100.';
    end if;
  end loop;
  for v_category in select jsonb_array_elements_text(v_exclusions)
  loop
    if v_category not in ('SERVICES', 'STUDIES', 'MEDICATIONS', 'SUPPLIES', 'EQUIPMENT', 'FEES', 'EXTRAS') then
      raise exception 'La exclusión de categoría no está autorizada.';
    end if;
  end loop;
  if v_requires_approval and v_approver_user_id is null then
    raise exception 'Un perfil que requiere aprobación debe tener un aprobador configurado.';
  end if;
  if v_approver_user_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = v_approver_user_id and p.organization_id = v_organization_id and p.status = 'ACTIVE'
  ) then
    raise exception 'El aprobador no pertenece a la organización o no está activo.';
  end if;
  if nullif(v_eligibility ->> 'patient_id', '') is not null and not exists (
    select 1 from public.patients p where p.id::text = v_eligibility ->> 'patient_id' and p.organization_id = v_organization_id
  ) then
    raise exception 'El paciente de elegibilidad no está disponible.';
  end if;
  if nullif(v_eligibility ->> 'insurer_id', '') is not null and not exists (
    select 1 from public.insurers i where i.id::text = v_eligibility ->> 'insurer_id' and i.organization_id = v_organization_id and i.status = 'ACTIVE'
  ) then
    raise exception 'La aseguradora de elegibilidad no está disponible.';
  end if;

  if p_discount_rule_id is not null then
    select * into v_existing from public.discount_rules
    where id = p_discount_rule_id and organization_id = v_organization_id for update;
    if not found then raise exception 'El perfil de descuento no está disponible.'; end if;
    if v_existing.status = 'ACTIVE' and v_status = 'INACTIVE' and btrim(coalesce(p_inactivation_reason, '')) = '' then
      raise exception 'Indique el motivo de inactivación del perfil.';
    end if;
    update public.discount_rules set
      name = v_name,
      description = nullif(btrim(p_rule ->> 'description'), ''),
      rule_type = v_rule_type,
      calculation_type = v_calculation_type,
      fixed_amount = round(v_fixed_amount, 2),
      category_percentages = v_categories,
      requires_reason = v_requires_reason,
      requires_approval = v_requires_approval,
      valid_from = v_valid_from,
      valid_until = v_valid_until,
      status = v_status,
      eligibility = v_eligibility,
      excluded_categories = v_exclusions,
      max_amount = case when v_max_amount is null then null else round(v_max_amount, 2) end,
      combinable = v_combinable,
      approver_user_id = v_approver_user_id,
      updated_at = now()
    where id = p_discount_rule_id
    returning * into v_rule;
  else
    insert into public.discount_rules (
      organization_id, name, description, rule_type, calculation_type, fixed_amount,
      category_percentages, requires_reason, requires_approval, valid_from, valid_until,
      status, eligibility, excluded_categories, max_amount, combinable, approver_user_id, created_at, updated_at
    ) values (
      v_organization_id, v_name, nullif(btrim(p_rule ->> 'description'), ''), v_rule_type, v_calculation_type, round(v_fixed_amount, 2),
      v_categories, v_requires_reason, v_requires_approval, v_valid_from, v_valid_until,
      v_status, v_eligibility, v_exclusions, case when v_max_amount is null then null else round(v_max_amount, 2) end,
      v_combinable, v_approver_user_id, now(), now()
    ) returning * into v_rule;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (
    v_organization_id, auth.uid(),
    case when p_discount_rule_id is null then 'CREATE_DISCOUNT_RULE' when v_rule.status = 'INACTIVE' then 'INACTIVATE_DISCOUNT_RULE' else 'UPDATE_DISCOUNT_RULE' end,
    'discount_rule', v_rule.id::text, 'Perfil de descuento configurado mediante operación auditada.',
    jsonb_build_object('calculation_type', v_rule.calculation_type, 'requires_approval', v_rule.requires_approval, 'inactivation_reason', nullif(btrim(coalesce(p_inactivation_reason, '')), ''))
  );
  return jsonb_build_object('rule', to_jsonb(v_rule));
end
$$;

create or replace function public.request_discount_approval(
  p_discount_rule_id uuid,
  p_hospitalization_id uuid,
  p_patient_id uuid,
  p_quote_context jsonb,
  p_reason text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_rule public.discount_rules%rowtype;
  v_request public.discount_approval_requests%rowtype;
  v_case public.hospitalizations%rowtype;
  v_patient public.patients%rowtype;
  v_context jsonb := coalesce(p_quote_context, '{}'::jsonb);
  v_eligibility jsonb;
  v_invoice_date date;
  v_item jsonb;
  v_requested_items jsonb := '[]'::jsonb;
  v_catalog_id uuid;
  v_quantity numeric(14,3);
  v_estimate numeric(14,2) := 0;
begin
  if not public.has_permission('quotes:write') then raise exception 'No tiene permiso para solicitar una aprobación.'; end if;
  if btrim(coalesce(p_request_key, '')) = '' or length(p_request_key) > 160 then raise exception 'La llave idempotente de solicitud no es válida.'; end if;
  if jsonb_typeof(v_context) <> 'object' or jsonb_typeof(coalesce(v_context -> 'items', '[]'::jsonb)) <> 'array' then
    raise exception 'El contexto de la solicitud no es válido.';
  end if;
  begin
    v_invoice_date := nullif(v_context ->> 'invoice_date', '')::date;
  exception when others then
    raise exception 'La fecha de cotización de la solicitud no es válida.';
  end;
  if v_invoice_date is null then raise exception 'La fecha de cotización de la solicitud es obligatoria.'; end if;
  select * into v_case from public.hospitalizations
  where id = p_hospitalization_id and patient_id = p_patient_id and organization_id = v_organization_id;
  if not found then raise exception 'La hospitalización y el paciente no pertenecen al alcance autorizado.'; end if;
  select * into v_patient from public.patients where id = p_patient_id and organization_id = v_organization_id;
  if not found then raise exception 'El paciente no pertenece al alcance autorizado.'; end if;
  select * into v_rule from public.discount_rules
  where id = p_discount_rule_id and organization_id = v_organization_id and status = 'ACTIVE'
    and (valid_from is null or valid_from <= v_invoice_date)
    and (valid_until is null or valid_until >= v_invoice_date);
  if not found or not v_rule.requires_approval then raise exception 'El perfil no requiere una aprobación vigente.'; end if;
  if v_rule.requires_reason and btrim(coalesce(p_reason, '')) = '' then raise exception 'El motivo del descuento es obligatorio.'; end if;
  v_eligibility := v_rule.eligibility;
  if nullif(v_eligibility ->> 'patient_id', '') is not null and v_eligibility ->> 'patient_id' <> p_patient_id::text then raise exception 'El perfil no aplica al paciente.'; end if;
  if nullif(v_eligibility ->> 'insurer_id', '') is not null and v_eligibility ->> 'insurer_id' <> coalesce(v_case.insurer_id::text, '') then raise exception 'El perfil no aplica a la aseguradora.'; end if;
  if nullif(v_eligibility ->> 'company_name', '') is not null and lower(v_eligibility ->> 'company_name') <> lower(coalesce(v_case.company_name, '')) then raise exception 'El perfil no aplica a la empresa.'; end if;
  if coalesce((v_eligibility ->> 'retiree_only')::boolean, false) and not v_patient.is_retired then raise exception 'El perfil exige elegibilidad de jubilado configurada.'; end if;
  if jsonb_array_length(v_context -> 'items') = 0 then raise exception 'La solicitud requiere al menos un concepto.'; end if;
  for v_item in select value from jsonb_array_elements(v_context -> 'items')
  loop
    begin
      v_catalog_id := (v_item ->> 'catalog_item_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::numeric;
    exception when others then
      raise exception 'Hay un concepto inválido en la solicitud.';
    end;
    if v_quantity <= 0 or not exists (select 1 from public.catalog_items c where c.id = v_catalog_id and c.organization_id = v_organization_id and c.status = 'ACTIVE') then
      raise exception 'Hay un concepto no autorizado en la solicitud.';
    end if;
    v_requested_items := v_requested_items || jsonb_build_array(jsonb_build_object('catalog_item_id', v_catalog_id, 'quantity', v_quantity));
  end loop;
  begin
    v_estimate := greatest(coalesce(nullif(v_context ->> 'calculated_discount_amount', '')::numeric, 0), 0);
  exception when others then
    raise exception 'El monto estimado de descuento no es válido.';
  end;
  v_context := v_context || jsonb_build_object(
    'invoice_date', v_invoice_date,
    'items', v_requested_items,
    'rule_updated_epoch', extract(epoch from v_rule.updated_at)
  );
  select * into v_request from public.discount_approval_requests
  where organization_id = v_organization_id and request_key = p_request_key;
  if found then return jsonb_build_object('request', to_jsonb(v_request)); end if;
  insert into public.discount_approval_requests (
    organization_id, discount_rule_id, hospitalization_id, patient_id, quote_context, request_key,
    reason, status, approver_user_id, requested_by, requested_at, calculated_discount_amount
  ) values (
    v_organization_id, v_rule.id, p_hospitalization_id, p_patient_id, v_context, p_request_key,
    btrim(coalesce(p_reason, '')), 'PENDING', v_rule.approver_user_id, auth.uid(), now(), round(v_estimate, 2)
  ) returning * into v_request;
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_organization_id, auth.uid(), 'REQUEST_DISCOUNT_APPROVAL', 'discount_approval_request', v_request.id::text,
    'Solicitud de descuento creada para aprobación explícita.', jsonb_build_object('discount_rule_id', v_rule.id, 'request_key', p_request_key));
  return jsonb_build_object('request', to_jsonb(v_request));
end
$$;

create or replace function public.decide_discount_approval(
  p_request_id uuid,
  p_decision text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_request public.discount_approval_requests%rowtype;
  v_decision text := upper(btrim(coalesce(p_decision, '')));
begin
  if not public.has_permission('quotes:write') then raise exception 'No tiene permiso para decidir la solicitud.'; end if;
  if v_decision not in ('APPROVED', 'REJECTED') then raise exception 'La decisión de aprobación no es válida.'; end if;
  select * into v_request from public.discount_approval_requests
  where id = p_request_id and organization_id = v_organization_id for update;
  if not found then raise exception 'La solicitud de aprobación no está disponible.'; end if;
  if v_request.status = v_decision then return jsonb_build_object('request', to_jsonb(v_request)); end if;
  if v_request.status <> 'PENDING' then raise exception 'La solicitud ya fue decidida.'; end if;
  if v_request.approver_user_id <> auth.uid() then raise exception 'Sólo el aprobador configurado puede decidir esta solicitud.'; end if;
  update public.discount_approval_requests set status = v_decision, decided_by = auth.uid(), decided_at = now(), decision_note = btrim(coalesce(p_note, ''))
  where id = v_request.id returning * into v_request;
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_organization_id, auth.uid(), 'DECIDE_DISCOUNT_APPROVAL', 'discount_approval_request', v_request.id::text,
    'Solicitud de descuento decidida por el aprobador configurado.', jsonb_build_object('decision', v_decision));
  return jsonb_build_object('request', to_jsonb(v_request));
end
$$;

create or replace function public.apply_quote_draft_catalog_v2(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_price_list_id uuid,
  p_items jsonb,
  p_discount_group_id text,
  p_discount_reason text,
  p_insurer_amount numeric,
  p_comments text,
  p_discount_approval_request_id uuid default null
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
  v_rule public.discount_rules%rowtype;
  v_approval public.discount_approval_requests%rowtype;
  v_case public.hospitalizations%rowtype;
  v_patient public.patients%rowtype;
  v_item jsonb;
  v_catalog_id uuid;
  v_catalog public.catalog_items%rowtype;
  v_price_item public.price_list_items%rowtype;
  v_quantity numeric(14,3);
  v_line_amount numeric(14,2);
  v_category_percent numeric := 0;
  v_subtotal numeric(14,2) := 0;
  v_discount_amount numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_insurer_amount numeric(14,2) := 0;
  v_patient_amount numeric(14,2) := 0;
  v_normalized_items jsonb := '[]'::jsonb;
  v_requested_items jsonb := '[]'::jsonb;
  v_eligibility jsonb;
begin
  if not public.has_permission('quotes:write') then raise exception 'No tiene permiso para editar cotizaciones.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'La cotización requiere al menos un concepto.'; end if;
  select * into v_quote from public.quotes where id = p_quote_id and organization_id = v_organization_id for update;
  if not found or v_quote.status <> 'DRAFT' or v_quote.sent_at is not null then raise exception 'La cotización no es un borrador editable.'; end if;
  select * into v_version from public.quote_versions where id = p_quote_version_id and quote_id = p_quote_id and organization_id = v_organization_id for update;
  if not found or v_version.immutable or v_version.status_snapshot <> 'DRAFT' then raise exception 'La versión no es un borrador editable.'; end if;
  select * into v_case from public.hospitalizations where id = v_quote.hospitalization_id and organization_id = v_organization_id;
  select * into v_patient from public.patients where id = v_quote.patient_id and organization_id = v_organization_id;
  if not found then raise exception 'El paciente de la cotización no está disponible.'; end if;
  if p_price_list_id is null or not exists (
    select 1 from public.price_lists pl where pl.id = p_price_list_id and pl.organization_id = v_organization_id and pl.status = 'ACTIVE'
      and pl.valid_from <= v_quote.invoice_date and (pl.valid_until is null or pl.valid_until >= v_quote.invoice_date)
  ) then raise exception 'Seleccione una lista de precios vigente y autorizada.'; end if;

  if p_discount_group_id <> 'REGULAR' then
    select * into v_rule from public.discount_rules where id::text = p_discount_group_id and organization_id = v_organization_id and status = 'ACTIVE'
      and (valid_from is null or valid_from <= v_quote.invoice_date) and (valid_until is null or valid_until >= v_quote.invoice_date);
    if not found then raise exception 'El grupo de descuento no está autorizado.'; end if;
    if v_rule.requires_reason and btrim(coalesce(p_discount_reason, '')) = '' then raise exception 'El motivo del descuento es obligatorio.'; end if;
    v_eligibility := v_rule.eligibility;
    if nullif(v_eligibility ->> 'patient_id', '') is not null and v_eligibility ->> 'patient_id' <> v_quote.patient_id::text then raise exception 'El perfil no aplica al paciente.'; end if;
    if nullif(v_eligibility ->> 'insurer_id', '') is not null and v_eligibility ->> 'insurer_id' <> coalesce(v_case.insurer_id::text, '') then raise exception 'El perfil no aplica a la aseguradora.'; end if;
    if nullif(v_eligibility ->> 'company_name', '') is not null and lower(v_eligibility ->> 'company_name') <> lower(coalesce(v_case.company_name, '')) then raise exception 'El perfil no aplica a la empresa.'; end if;
    if coalesce((v_eligibility ->> 'retiree_only')::boolean, false) and not v_patient.is_retired then raise exception 'El perfil exige elegibilidad de jubilado configurada.'; end if;
    if v_rule.requires_approval then
      if p_discount_approval_request_id is null then raise exception 'El perfil requiere una aprobación previa vinculada.'; end if;
      select * into v_approval from public.discount_approval_requests
      where id = p_discount_approval_request_id and organization_id = v_organization_id for update;
      if not found or v_approval.status <> 'APPROVED' or v_approval.discount_rule_id <> v_rule.id
        or v_approval.hospitalization_id <> v_quote.hospitalization_id or v_approval.patient_id <> v_quote.patient_id then
        raise exception 'La aprobación de descuento no corresponde a esta cotización.';
      end if;
      if v_approval.quote_version_id is not null and v_approval.quote_version_id <> p_quote_version_id then
        raise exception 'La aprobación ya fue vinculada a otra versión de cotización.';
      end if;
      if coalesce(v_approval.quote_context ->> 'invoice_date', '') <> v_quote.invoice_date::text
        or coalesce((v_approval.quote_context ->> 'rule_updated_epoch')::numeric, -1) <> extract(epoch from v_rule.updated_at) then
        raise exception 'La aprobación no corresponde a la fecha o versión actual del perfil de descuento.';
      end if;
    elsif p_discount_approval_request_id is not null then
      raise exception 'El perfil seleccionado no requiere una aprobación.';
    end if;
  elsif p_discount_approval_request_id is not null then
    raise exception 'La cotización regular no admite una aprobación de descuento.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_catalog_id := (v_item ->> 'catalog_item_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::numeric;
    exception when others then raise exception 'Hay un concepto con catálogo o cantidad inválidos.'; end;
    if v_quantity <= 0 then raise exception 'La cantidad debe ser mayor que cero.'; end if;
    select ci.* into v_catalog from public.catalog_items ci where ci.id = v_catalog_id and ci.organization_id = v_organization_id and ci.status = 'ACTIVE';
    if not found then raise exception 'El concepto no pertenece al catálogo autorizado.'; end if;
    select pli.* into v_price_item from public.price_list_items pli where pli.price_list_id = p_price_list_id and pli.catalog_item_id = v_catalog.id and pli.organization_id = v_organization_id;
    if not found then raise exception 'El concepto no tiene precio autorizado en la lista seleccionada.'; end if;
    v_line_amount := round(v_quantity * v_price_item.price, 2);
    v_category_percent := case when p_discount_group_id = 'REGULAR' or v_rule.calculation_type = 'FIXED' or v_rule.excluded_categories ? v_catalog.category then 0 else coalesce((v_rule.category_percentages ->> v_catalog.category)::numeric, 0) end;
    if v_category_percent < 0 or v_category_percent > 100 then raise exception 'La regla de descuento configurada es inválida.'; end if;
    v_subtotal := v_subtotal + v_line_amount;
    v_discount_amount := v_discount_amount + round(v_line_amount * v_category_percent / 100, 2);
    v_normalized_items := v_normalized_items || jsonb_build_array(jsonb_build_object('catalog_item_id', v_catalog.id, 'price_list_item_id', v_price_item.id, 'category', v_catalog.category, 'description', v_catalog.name, 'quantity', v_quantity, 'unit_price', v_price_item.price));
    v_requested_items := v_requested_items || jsonb_build_array(jsonb_build_object('catalog_item_id', v_catalog.id, 'quantity', v_quantity));
  end loop;
  if p_discount_group_id <> 'REGULAR' and v_rule.requires_approval and coalesce(v_approval.quote_context -> 'items', '[]'::jsonb) <> v_requested_items then
    raise exception 'La aprobación no corresponde a los conceptos o cantidades de esta cotización.';
  end if;
  v_subtotal := round(v_subtotal, 2);
  if p_discount_group_id <> 'REGULAR' and v_rule.calculation_type = 'FIXED' then v_discount_amount := v_rule.fixed_amount; end if;
  if p_discount_group_id <> 'REGULAR' and v_rule.max_amount is not null then v_discount_amount := least(v_discount_amount, v_rule.max_amount); end if;
  v_discount_amount := least(round(v_discount_amount, 2), v_subtotal);
  v_total := round(v_subtotal - v_discount_amount, 2);
  v_insurer_amount := least(greatest(coalesce(p_insurer_amount, 0), 0), v_total);
  v_patient_amount := round(v_total - v_insurer_amount, 2);
  delete from public.quote_items where quote_version_id = p_quote_version_id;
  insert into public.quote_items (organization_id, quote_version_id, catalog_item_id, price_list_item_id, category, description, quantity, unit_price, discount_amount)
  select v_organization_id, p_quote_version_id, x.catalog_item_id, x.price_list_item_id, x.category, x.description, x.quantity, x.unit_price, 0
  from jsonb_to_recordset(v_normalized_items) as x(catalog_item_id uuid, price_list_item_id uuid, category text, description text, quantity numeric, unit_price numeric);
  update public.quote_versions set price_list_id = p_price_list_id, subtotal = v_subtotal, discount_amount = v_discount_amount, total = v_total,
    insurer_amount = v_insurer_amount, patient_amount = v_patient_amount, discount_approval_request_id = p_discount_approval_request_id,
    discount_snapshot = case when p_discount_group_id = 'REGULAR' then jsonb_build_object('group_id', 'REGULAR', 'reason', coalesce(p_discount_reason, '')) else jsonb_build_object('group_id', p_discount_group_id, 'reason', coalesce(p_discount_reason, ''), 'calculation_type', v_rule.calculation_type, 'fixed_amount', v_rule.fixed_amount, 'category_percentages', v_rule.category_percentages, 'excluded_categories', v_rule.excluded_categories, 'max_amount', v_rule.max_amount, 'approval_request_id', p_discount_approval_request_id) end,
    comments = p_comments, snapshot = jsonb_build_object('price_list_id', p_price_list_id, 'subtotal', v_subtotal, 'discount_amount', v_discount_amount, 'total', v_total, 'insurer_amount', v_insurer_amount, 'patient_amount', v_patient_amount, 'items', v_normalized_items)
  where id = p_quote_version_id;
  update public.quotes set price_list_id = p_price_list_id, discount_group_id = p_discount_group_id, subtotal = v_subtotal, discount_amount = v_discount_amount, total = v_total, insurer_amount = v_insurer_amount, patient_amount = v_patient_amount, comments = p_comments, updated_at = now() where id = p_quote_id;
  if p_discount_approval_request_id is not null then
    update public.discount_approval_requests set quote_version_id = p_quote_version_id, calculated_discount_amount = v_discount_amount where id = p_discount_approval_request_id;
  end if;
  return jsonb_build_object('quote_id', p_quote_id, 'quote_version_id', p_quote_version_id, 'subtotal', v_subtotal, 'discount_amount', v_discount_amount, 'total', v_total, 'insurer_amount', v_insurer_amount, 'patient_amount', v_patient_amount, 'discount_approval_request_id', p_discount_approval_request_id);
end
$$;

create or replace function public.create_quote_draft_v2(
  p_code text, p_hospitalization_id uuid, p_patient_id uuid, p_price_list_id uuid, p_items jsonb,
  p_currency text, p_insurer_amount numeric, p_invoice_date date, p_discount_group_id text,
  p_discount_reason text, p_referred_by text, p_giftcard text, p_comments text,
  p_discount_approval_request_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_organization_id uuid := public.current_organization_id(); v_quote_id uuid; v_version_id uuid; v_result jsonb;
begin
  if not public.has_permission('quotes:write') then raise exception 'No tiene permiso para crear cotizaciones.'; end if;
  if not exists (select 1 from public.hospitalizations h where h.id = p_hospitalization_id and h.patient_id = p_patient_id and h.organization_id = v_organization_id) then raise exception 'La hospitalización y el paciente no pertenecen al alcance autorizado.'; end if;
  insert into public.quotes (organization_id, code, hospitalization_id, patient_id, status, current_version, currency, subtotal, discount_amount, total, insurer_amount, patient_amount, comments, invoice_date, discount_group_id, referred_by, giftcard, price_list_id, created_by)
  values (v_organization_id, btrim(p_code), p_hospitalization_id, p_patient_id, 'DRAFT', 1, upper(coalesce(p_currency, 'USD')), 0, 0, 0, 0, 0, p_comments, p_invoice_date, p_discount_group_id, p_referred_by, nullif(btrim(p_giftcard), ''), p_price_list_id, auth.uid()) returning id into v_quote_id;
  insert into public.quote_versions (organization_id, quote_id, version, status_snapshot, subtotal, discount_amount, total, insurer_amount, patient_amount, discount_snapshot, comments, immutable, snapshot, price_list_id, created_by)
  values (v_organization_id, v_quote_id, 1, 'DRAFT', 0, 0, 0, 0, 0, '{}'::jsonb, p_comments, false, '{}'::jsonb, p_price_list_id, auth.uid()) returning id into v_version_id;
  v_result := public.apply_quote_draft_catalog_v2(v_quote_id, v_version_id, p_price_list_id, p_items, p_discount_group_id, p_discount_reason, p_insurer_amount, p_comments, p_discount_approval_request_id);
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata) values (v_organization_id, auth.uid(), 'CREATE_QUOTE', 'quote', v_quote_id::text, 'Cotización creada transaccionalmente con el perfil de descuento validado.', v_result);
  return v_result;
end $$;

create or replace function public.update_quote_draft_catalog_v2(
  p_quote_id uuid, p_quote_version_id uuid, p_price_list_id uuid, p_items jsonb, p_insurer_amount numeric,
  p_invoice_date date, p_discount_group_id text, p_discount_reason text, p_referred_by text,
  p_giftcard text, p_comments text, p_discount_approval_request_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_result jsonb;
begin
  if not public.has_permission('quotes:write') then raise exception 'No tiene permiso para editar cotizaciones.'; end if;
  update public.quotes set invoice_date = p_invoice_date, discount_group_id = p_discount_group_id, referred_by = p_referred_by, giftcard = nullif(btrim(p_giftcard), ''), comments = p_comments, updated_at = now()
  where id = p_quote_id and organization_id = public.current_organization_id() and status = 'DRAFT' and sent_at is null;
  if not found then raise exception 'La cotización no es un borrador editable.'; end if;
  v_result := public.apply_quote_draft_catalog_v2(p_quote_id, p_quote_version_id, p_price_list_id, p_items, p_discount_group_id, p_discount_reason, p_insurer_amount, p_comments, p_discount_approval_request_id);
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata) values (public.current_organization_id(), auth.uid(), 'UPDATE_QUOTE_DRAFT', 'quote_version', p_quote_version_id::text, 'Borrador recalculado transaccionalmente con descuento validado.', v_result);
  return v_result;
end $$;

create or replace function public.create_quote_revision_catalog_v2(
  p_quote_id uuid, p_source_version_id uuid, p_reason text, p_price_list_id uuid, p_items jsonb,
  p_insurer_amount numeric, p_invoice_date date, p_discount_group_id text, p_discount_reason text,
  p_referred_by text, p_giftcard text, p_comments text, p_discount_approval_request_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_organization_id uuid := public.current_organization_id(); v_new_version_id uuid; v_result jsonb;
begin
  if not public.has_permission('quotes:write') then raise exception 'No tiene permiso para versionar cotizaciones.'; end if;
  v_new_version_id := public.create_quote_revision(p_quote_id, p_source_version_id, p_reason);
  update public.quotes set invoice_date = p_invoice_date, discount_group_id = p_discount_group_id, referred_by = p_referred_by, giftcard = nullif(btrim(p_giftcard), ''), comments = p_comments, updated_at = now() where id = p_quote_id and organization_id = v_organization_id;
  if not found then raise exception 'Cotización no disponible.'; end if;
  v_result := public.apply_quote_draft_catalog_v2(p_quote_id, v_new_version_id, p_price_list_id, p_items, p_discount_group_id, p_discount_reason, p_insurer_amount, p_comments, p_discount_approval_request_id);
  return v_result || jsonb_build_object('previous_version_id', p_source_version_id, 'revision_reason', btrim(p_reason));
end $$;

revoke all on function public.save_discount_rule(uuid, jsonb, text) from public, anon;
revoke all on function public.request_discount_approval(uuid, uuid, uuid, jsonb, text, text) from public, anon;
revoke all on function public.decide_discount_approval(uuid, text, text) from public, anon;
revoke all on function public.apply_quote_draft_catalog_v2(uuid, uuid, uuid, jsonb, text, text, numeric, text, uuid) from public, anon, authenticated;
revoke all on function public.create_quote_draft_v2(text, uuid, uuid, uuid, jsonb, text, numeric, date, text, text, text, text, text, uuid) from public, anon;
revoke all on function public.update_quote_draft_catalog_v2(uuid, uuid, uuid, jsonb, numeric, date, text, text, text, text, text, uuid) from public, anon;
revoke all on function public.create_quote_revision_catalog_v2(uuid, uuid, text, uuid, jsonb, numeric, date, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.save_discount_rule(uuid, jsonb, text) to authenticated;
grant execute on function public.request_discount_approval(uuid, uuid, uuid, jsonb, text, text) to authenticated;
grant execute on function public.decide_discount_approval(uuid, text, text) to authenticated;
grant execute on function public.create_quote_draft_v2(text, uuid, uuid, uuid, jsonb, text, numeric, date, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.update_quote_draft_catalog_v2(uuid, uuid, uuid, jsonb, numeric, date, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.create_quote_revision_catalog_v2(uuid, uuid, text, uuid, jsonb, numeric, date, text, text, text, text, text, uuid) to authenticated;

commit;
