-- CH08: authoritative administrative execution handoff and immutable payment correction UI support.
-- All values are operational metadata supplied by an authorized user; no clinical or financial rules are inferred here.

create table if not exists public.administrative_execution_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  quote_version_id uuid not null references public.quote_versions(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  health_manager text not null,
  referred_by text not null,
  revenue_type text not null,
  service_type text,
  start_date date not null,
  duration_days integer not null check (duration_days between 1 and 3660),
  payment_form text not null,
  insurer_id uuid references public.insurers(id) on delete set null,
  request_type text not null,
  third_party_invoice boolean not null default false,
  major_category text,
  service_subcategory text,
  source_hospital text,
  description text,
  patient_type text,
  module_type text,
  additional_options text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CANCELLED','COMPLETED')),
  idempotency_key text not null check (length(idempotency_key) between 1 and 160),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create unique index if not exists administrative_execution_profile_active_uidx
  on public.administrative_execution_profiles (organization_id, hospitalization_id)
  where status = 'ACTIVE';

alter table public.administrative_execution_profiles enable row level security;

drop policy if exists administrative_execution_profiles_select on public.administrative_execution_profiles;
create policy administrative_execution_profiles_select on public.administrative_execution_profiles
for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('cases:read'));

drop policy if exists administrative_execution_profiles_rpc_only on public.administrative_execution_profiles;
create policy administrative_execution_profiles_rpc_only on public.administrative_execution_profiles
for all to authenticated using (false) with check (false);

create or replace function public.prevent_administrative_execution_delete()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Los perfiles de ejecución no se eliminan; requieren una transición auditada';
end
$$;

drop trigger if exists administrative_execution_profiles_no_delete on public.administrative_execution_profiles;
create trigger administrative_execution_profiles_no_delete
before delete on public.administrative_execution_profiles
for each row execute function public.prevent_administrative_execution_delete();

create or replace function public.start_administrative_execution(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_hospitalization_id uuid,
  p_health_manager text,
  p_referred_by text,
  p_revenue_type text,
  p_service_type text,
  p_start_date date,
  p_duration_days integer,
  p_payment_form text,
  p_insurer_id uuid,
  p_request_type text,
  p_third_party_invoice boolean,
  p_major_category text,
  p_service_subcategory text,
  p_source_hospital text,
  p_description text,
  p_patient_type text,
  p_module_type text,
  p_additional_options text,
  p_idempotency_key text
)
returns public.administrative_execution_profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_quote public.quotes%rowtype;
  v_profile public.administrative_execution_profiles%rowtype;
begin
  if v_org is null or not public.has_permission('cases:write') then raise exception 'Permiso insuficiente'; end if;
  if p_quote_id is null or p_quote_version_id is null or p_hospitalization_id is null or p_start_date is null
     or nullif(btrim(coalesce(p_health_manager,'')), '') is null
     or nullif(btrim(coalesce(p_referred_by,'')), '') is null
     or nullif(btrim(coalesce(p_revenue_type,'')), '') is null
     or nullif(btrim(coalesce(p_payment_form,'')), '') is null
     or nullif(btrim(coalesce(p_request_type,'')), '') is null
     or p_duration_days is null or p_duration_days not between 1 and 3660
     or nullif(btrim(coalesce(p_idempotency_key,'')), '') is null or length(p_idempotency_key) > 160 then
    raise exception 'Perfil administrativo inválido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':execution:' || p_idempotency_key, 0));
  select * into v_profile from public.administrative_execution_profiles
   where organization_id = v_org and idempotency_key = p_idempotency_key;
  if found then return v_profile; end if;

  select * into v_quote from public.quotes
   where id = p_quote_id and organization_id = v_org and hospitalization_id = p_hospitalization_id
   for update;
  if not found then raise exception 'Cotización no disponible'; end if;
  if not exists (
    select 1 from public.quote_versions
     where id = p_quote_version_id and quote_id = v_quote.id and organization_id = v_org
  ) then raise exception 'Versión de cotización no disponible'; end if;
  if not exists (
    select 1 from public.hospitalizations
     where id = p_hospitalization_id and organization_id = v_org and patient_id = v_quote.patient_id
  ) then raise exception 'Hospitalización no disponible'; end if;
  if p_insurer_id is not null and not exists (
    select 1 from public.insurers where id = p_insurer_id and organization_id = v_org
  ) then raise exception 'Aseguradora no disponible'; end if;
  if exists (
    select 1 from public.administrative_execution_profiles
     where organization_id = v_org and hospitalization_id = p_hospitalization_id and status = 'ACTIVE'
  ) then raise exception 'La hospitalización ya tiene un perfil de ejecución activo'; end if;

  insert into public.administrative_execution_profiles (
    organization_id, hospitalization_id, quote_id, quote_version_id, patient_id,
    health_manager, referred_by, revenue_type, service_type, start_date, duration_days,
    payment_form, insurer_id, request_type, third_party_invoice, major_category,
    service_subcategory, source_hospital, description, patient_type, module_type,
    additional_options, idempotency_key, created_by
  ) values (
    v_org, p_hospitalization_id, v_quote.id, p_quote_version_id, v_quote.patient_id,
    btrim(p_health_manager), btrim(p_referred_by), btrim(p_revenue_type), nullif(btrim(p_service_type),''),
    p_start_date, p_duration_days, btrim(p_payment_form), p_insurer_id, btrim(p_request_type),
    coalesce(p_third_party_invoice,false), nullif(btrim(p_major_category),''),
    nullif(btrim(p_service_subcategory),''), nullif(btrim(p_source_hospital),''),
    nullif(btrim(p_description),''), nullif(btrim(p_patient_type),''),
    nullif(btrim(p_module_type),''), nullif(btrim(p_additional_options),''),
    p_idempotency_key, auth.uid()
  ) returning * into v_profile;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, auth.uid(), 'START_ADMINISTRATIVE_EXECUTION', 'ADMINISTRATIVE_EXECUTION_PROFILE', v_profile.id::text,
    'Perfil administrativo de ejecución creado.',
    jsonb_build_object('hospitalization_id', p_hospitalization_id, 'quote_id', p_quote_id, 'quote_version_id', p_quote_version_id));
  return v_profile;
end
$$;

revoke all on function public.start_administrative_execution(uuid,uuid,uuid,text,text,text,text,date,integer,text,uuid,text,boolean,text,text,text,text,text,text,text,text) from public;
revoke all on function public.start_administrative_execution(uuid,uuid,uuid,text,text,text,text,date,integer,text,uuid,text,boolean,text,text,text,text,text,text,text,text) from anon;
grant execute on function public.start_administrative_execution(uuid,uuid,uuid,text,text,text,text,date,integer,text,uuid,text,boolean,text,text,text,text,text,text,text,text) to authenticated;

grant select on public.administrative_execution_profiles to authenticated;
revoke insert, update, delete on public.administrative_execution_profiles from authenticated;
