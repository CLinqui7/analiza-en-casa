-- CH09: append-only clinical profiles created by authorized clinicians.
-- Catalog values are recorded as supplied; this migration does not infer diagnoses, triage, schedules or treatment rules.

create table if not exists public.clinical_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  start_date date not null,
  end_date date,
  treating_doctor_id uuid references public.doctors(id) on delete set null,
  other_doctor_ids uuid[] not null default '{}'::uuid[],
  diagnosis_code text not null check (length(btrim(diagnosis_code)) between 1 and 80),
  diagnosis_label text not null check (length(btrim(diagnosis_label)) between 1 and 500),
  diagnosis_group text not null check (length(btrim(diagnosis_group)) between 1 and 300),
  triage text not null check (length(btrim(triage)) between 1 and 120),
  profile_group text not null check (length(btrim(profile_group)) between 1 and 200),
  profile_subgroup text not null check (length(btrim(profile_subgroup)) between 1 and 200),
  patient_type text not null check (length(btrim(patient_type)) between 1 and 120),
  supervisor_name text,
  coordinator_id uuid references public.doctors(id) on delete set null,
  nursing_tags text,
  supervision_frequency text,
  physician_report_frequency text,
  service_type text not null check (length(btrim(service_type)) between 1 and 200),
  devices jsonb not null default '[]'::jsonb check (jsonb_typeof(devices) = 'array'),
  shift_start_date date,
  shift_end_date date,
  shift_frequency text,
  attention_type text,
  clinical_status text not null default 'DRAFT' check (clinical_status in ('DRAFT','ACTIVE','FINISHED','VOIDED')),
  attachment_metadata jsonb not null default '[]'::jsonb check (jsonb_typeof(attachment_metadata) = 'array'),
  idempotency_key text not null check (length(idempotency_key) between 1 and 160),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check ((shift_start_date is null and shift_end_date is null) or (shift_start_date is not null and shift_end_date is not null and shift_end_date >= shift_start_date)),
  unique (organization_id, idempotency_key)
);

create index if not exists clinical_profiles_org_hospitalization_start_idx
  on public.clinical_profiles (organization_id, hospitalization_id, start_date desc);
create index if not exists clinical_profiles_org_patient_idx
  on public.clinical_profiles (organization_id, patient_id);

alter table public.clinical_profiles enable row level security;

drop policy if exists clinical_profiles_select on public.clinical_profiles;
create policy clinical_profiles_select on public.clinical_profiles
for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('clinical:read'));

drop policy if exists clinical_profiles_rpc_only on public.clinical_profiles;
create policy clinical_profiles_rpc_only on public.clinical_profiles
for all to authenticated using (false) with check (false);

create or replace function public.prevent_clinical_profile_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Los perfiles clínicos son append-only; la corrección requiere un nuevo registro autorizado';
end
$$;

drop trigger if exists clinical_profiles_no_update_delete on public.clinical_profiles;
create trigger clinical_profiles_no_update_delete
before update or delete on public.clinical_profiles
for each row execute function public.prevent_clinical_profile_mutation();

create or replace function public.create_clinical_profile(
  p_hospitalization_id uuid,
  p_profile jsonb,
  p_idempotency_key text
)
returns public.clinical_profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_hospitalization public.hospitalizations%rowtype;
  v_profile public.clinical_profiles%rowtype;
  v_start_date date;
  v_end_date date;
  v_shift_start date;
  v_shift_end date;
  v_treating_doctor uuid;
  v_coordinator uuid;
  v_other_doctors uuid[] := '{}'::uuid[];
begin
  if v_org is null or not public.has_permission('clinical:write') then raise exception 'Permiso insuficiente'; end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object'
     or nullif(btrim(coalesce(p_idempotency_key,'')), '') is null or length(p_idempotency_key) > 160 then
    raise exception 'Perfil clínico inválido';
  end if;

  begin
    v_start_date := (p_profile->>'start_date')::date;
    v_end_date := nullif(p_profile->>'end_date','')::date;
    v_shift_start := nullif(p_profile->>'shift_start_date','')::date;
    v_shift_end := nullif(p_profile->>'shift_end_date','')::date;
    v_treating_doctor := nullif(p_profile->>'treating_doctor_id','')::uuid;
    v_coordinator := nullif(p_profile->>'coordinator_id','')::uuid;
    if jsonb_typeof(coalesce(p_profile->'other_doctor_ids','[]'::jsonb)) <> 'array' then
      raise exception 'Referencias de médicos adicionales no válidas';
    end if;
    select coalesce(array_agg(value::uuid), '{}'::uuid[])
      into v_other_doctors
      from jsonb_array_elements_text(coalesce(p_profile->'other_doctor_ids','[]'::jsonb));
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception 'Fechas o referencias del perfil clínico no válidas';
  end;

  if v_start_date is null or (v_end_date is not null and v_end_date < v_start_date)
     or ((v_shift_start is null) <> (v_shift_end is null)) or (v_shift_end is not null and v_shift_end < v_shift_start)
     or jsonb_typeof(coalesce(p_profile->'devices','[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_profile->'devices','[]'::jsonb)) > 50
     or exists (select 1 from unnest(array['diagnosis_code','diagnosis_label','diagnosis_group','triage','profile_group','profile_subgroup','patient_type','service_type']) key
                where nullif(btrim(coalesce(p_profile->>key,'')), '') is null) then
    raise exception 'Perfil clínico inválido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':clinical-profile:' || p_idempotency_key, 0));
  select * into v_profile from public.clinical_profiles
   where organization_id = v_org and idempotency_key = p_idempotency_key;
  if found then return v_profile; end if;

  select * into v_hospitalization from public.hospitalizations
   where id = p_hospitalization_id and organization_id = v_org;
  if not found then raise exception 'Hospitalización no disponible'; end if;
  if v_treating_doctor is not null and not exists (select 1 from public.doctors where id = v_treating_doctor and organization_id = v_org and status = 'ACTIVE') then
    raise exception 'Médico tratante no disponible';
  end if;
  if v_coordinator is not null and not exists (select 1 from public.doctors where id = v_coordinator and organization_id = v_org and status = 'ACTIVE') then
    raise exception 'Coordinador clínico no disponible';
  end if;
  if exists (
    select 1 from unnest(v_other_doctors) doctor_id
    where not exists (
      select 1 from public.doctors
      where id = doctor_id and organization_id = v_org and status = 'ACTIVE'
    )
  ) then
    raise exception 'Médico adicional no disponible';
  end if;

  insert into public.clinical_profiles (
    organization_id, hospitalization_id, patient_id, start_date, end_date, treating_doctor_id, other_doctor_ids,
    diagnosis_code, diagnosis_label, diagnosis_group, triage, profile_group, profile_subgroup,
    patient_type, supervisor_name, coordinator_id, nursing_tags, supervision_frequency,
    physician_report_frequency, service_type, devices, shift_start_date, shift_end_date,
    shift_frequency, attention_type, idempotency_key, created_by
  ) values (
    v_org, v_hospitalization.id, v_hospitalization.patient_id, v_start_date, v_end_date, v_treating_doctor, v_other_doctors,
    btrim(p_profile->>'diagnosis_code'), btrim(p_profile->>'diagnosis_label'), btrim(p_profile->>'diagnosis_group'),
    btrim(p_profile->>'triage'), btrim(p_profile->>'profile_group'), btrim(p_profile->>'profile_subgroup'),
    btrim(p_profile->>'patient_type'), nullif(btrim(p_profile->>'supervisor_name'),''), v_coordinator,
    nullif(btrim(p_profile->>'nursing_tags'),''), nullif(btrim(p_profile->>'supervision_frequency'),''),
    nullif(btrim(p_profile->>'physician_report_frequency'),''), btrim(p_profile->>'service_type'),
    coalesce(p_profile->'devices','[]'::jsonb), v_shift_start, v_shift_end,
    nullif(btrim(p_profile->>'shift_frequency'),''), nullif(btrim(p_profile->>'attention_type'),''),
    p_idempotency_key, auth.uid()
  ) returning * into v_profile;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, auth.uid(), 'CREATE_CLINICAL_PROFILE', 'clinical_profile', v_profile.id::text,
    'Perfil clínico append-only creado.', jsonb_build_object('hospitalization_id', v_hospitalization.id, 'patient_id', v_hospitalization.patient_id));
  return v_profile;
end
$$;

revoke all on function public.create_clinical_profile(uuid,jsonb,text) from public;
revoke all on function public.create_clinical_profile(uuid,jsonb,text) from anon;
grant execute on function public.create_clinical_profile(uuid,jsonb,text) to authenticated;

grant select on public.clinical_profiles to authenticated;
revoke insert, update, delete on public.clinical_profiles from authenticated;

create or replace function public.validate_health_report_range(
  p_hospitalization_id uuid,
  p_start_date date,
  p_end_date date
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
begin
  if v_org is null or not public.has_permission('clinical:read') then
    raise exception 'Permiso insuficiente';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Rango de reporte no válido';
  end if;
  if not exists (
    select 1 from public.hospitalizations
    where id = p_hospitalization_id and organization_id = v_org
  ) then
    raise exception 'Hospitalización no disponible';
  end if;
  return true;
end
$$;

revoke all on function public.validate_health_report_range(uuid,date,date) from public;
revoke all on function public.validate_health_report_range(uuid,date,date) from anon;
grant execute on function public.validate_health_report_range(uuid,date,date) to authenticated;
