-- CH11: remote-confirmed, idempotent agenda visits and resource assignment.
-- Recurrence, deletion, finalization, tariffs, discounts and professional-payment rules remain blocked for confirmation.

alter table public.shifts
  add column if not exists idempotency_key text,
  add column if not exists classification text not null default 'TURNO' check (classification in ('PUNTUAL','TURNO')),
  add column if not exists frequency text not null default 'No documentada',
  add column if not exists occurrence_count integer not null default 1 check (occurrence_count > 0),
  add column if not exists internal_observations text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists shifts_org_idempotency_idx
  on public.shifts (organization_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.shift_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  shift_id uuid not null references public.shifts(id) on delete restrict,
  event_type text not null check (event_type in ('CREATED','RESOURCE_ASSIGNED')),
  actor_user_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, event_type, idempotency_key)
);

alter table public.shift_events enable row level security;
drop policy if exists shift_events_select on public.shift_events;
create policy shift_events_select on public.shift_events for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('agenda:read'));

create or replace function public.create_shift_visit(
  p_hospitalization_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_shift_type text,
  p_classification text,
  p_frequency text,
  p_occurrence_count integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_hospitalization public.hospitalizations%rowtype;
  v_shift public.shifts%rowtype;
begin
  if v_org is null or not public.has_permission('agenda:write') then
    raise exception 'No tiene permiso para crear visitas.';
  end if;
  if p_ends_at is null or p_starts_at is null or p_ends_at <= p_starts_at
    or p_shift_type not in (
      'NURSING_CARE','SUPERVISION','MEDICAL_VISIT','DAILY_RECORD','SWALLOWING_THERAPY',
      'OCCUPATIONAL_THERAPY','PHYSIOTHERAPY','NUTRITION','CAREGIVER','CLINICAL_PSYCHOLOGY',
      'SOCIAL_WORK','SPIRITUAL_VISIT','TECHNICAL_NURSING_CARE','SPECIAL_LABORATORY','GERIATRICS',
      'TERTIARY_LABORATORY','RESPIRATORY_VISIT'
    )
    or p_classification not in ('PUNTUAL','TURNO')
    or nullif(btrim(coalesce(p_frequency,'')), '') is null or length(p_frequency) > 160
    or coalesce(p_occurrence_count,0) <> 1
    or nullif(btrim(coalesce(p_idempotency_key,'')), '') is null or length(p_idempotency_key) > 160 then
    raise exception 'Revise los datos de la visita. La recurrencia múltiple aún no está configurada.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':shift:' || p_idempotency_key, 0));
  select * into v_shift from public.shifts
  where organization_id = v_org and idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_shift); end if;

  select * into v_hospitalization from public.hospitalizations
  where id = p_hospitalization_id and organization_id = v_org for share;
  if not found then raise exception 'Hospitalización no disponible.'; end if;

  insert into public.shifts (
    organization_id, hospitalization_id, patient_id, resource_user_id, resource_name,
    shift_type, starts_at, ends_at, status, created_by, idempotency_key,
    classification, frequency, occurrence_count
  ) values (
    v_org, v_hospitalization.id, v_hospitalization.patient_id, null, 'Sin asignar',
    btrim(p_shift_type), p_starts_at, p_ends_at, 'PENDING', auth.uid(), p_idempotency_key,
    p_classification, btrim(p_frequency), 1
  ) returning * into v_shift;

  insert into public.shift_events (organization_id, shift_id, event_type, actor_user_id, idempotency_key, metadata)
  values (v_org, v_shift.id, 'CREATED', auth.uid(), p_idempotency_key,
    jsonb_build_object('hospitalization_id', v_hospitalization.id, 'classification', p_classification, 'shift_type', p_shift_type));
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, auth.uid(), 'CREATE_SHIFT', 'shift', v_shift.id::text, 'Visita creada en agenda.',
    jsonb_build_object('hospitalization_id', v_hospitalization.id, 'idempotency_key', p_idempotency_key));
  return to_jsonb(v_shift);
end
$$;

create or replace function public.assign_shift_resource(
  p_shift_id uuid,
  p_resource_user_id uuid,
  p_internal_observations text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_shift public.shifts%rowtype;
  v_resource_name text;
  v_existing_shift_id uuid;
begin
  if v_org is null or not public.has_permission('agenda:write') then
    raise exception 'No tiene permiso para asignar visitas.';
  end if;
  if p_resource_user_id is null
    or length(coalesce(p_internal_observations,'')) > 5000
    or nullif(btrim(coalesce(p_idempotency_key,'')), '') is null or length(p_idempotency_key) > 160 then
    raise exception 'Revise la asignación de la visita.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':shift-assignment:' || p_idempotency_key, 0));
  select shift_id into v_existing_shift_id from public.shift_events
  where organization_id = v_org and event_type = 'RESOURCE_ASSIGNED' and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_shift_id <> p_shift_id then raise exception 'La clave de idempotencia ya pertenece a otra visita.'; end if;
    select * into v_shift from public.shifts where id = p_shift_id and organization_id = v_org;
    return to_jsonb(v_shift);
  end if;

  select p.full_name into v_resource_name from public.profiles p
  where p.id = p_resource_user_id and p.organization_id = v_org and p.status = 'ACTIVE'
    and exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id and r.organization_id = ur.organization_id
      where ur.organization_id = v_org and ur.user_id = p.id and r.code in ('NURSE','DOCTOR')
    );
  if not found then raise exception 'Recurso no disponible en la organización.'; end if;

  select * into v_shift from public.shifts
  where id = p_shift_id and organization_id = v_org for update;
  if not found then raise exception 'Visita no disponible.'; end if;
  if v_shift.status in ('COMPLETED','CANCELLED') then raise exception 'La visita finalizada o cancelada no puede reasignarse.'; end if;

  update public.shifts set
    resource_user_id = p_resource_user_id,
    resource_name = v_resource_name,
    internal_observations = nullif(btrim(coalesce(p_internal_observations,'')), ''),
    updated_at = now()
  where id = v_shift.id
  returning * into v_shift;

  insert into public.shift_events (organization_id, shift_id, event_type, actor_user_id, idempotency_key, metadata)
  values (v_org, v_shift.id, 'RESOURCE_ASSIGNED', auth.uid(), p_idempotency_key,
    jsonb_build_object('resource_user_id', p_resource_user_id));
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, auth.uid(), 'ASSIGN_SHIFT_RESOURCE', 'shift', v_shift.id::text, 'Recurso de visita asignado.',
    jsonb_build_object('resource_user_id', p_resource_user_id, 'idempotency_key', p_idempotency_key));
  return to_jsonb(v_shift);
end
$$;

revoke all on function public.create_shift_visit(uuid, timestamptz, timestamptz, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.assign_shift_resource(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_shift_visit(uuid, timestamptz, timestamptz, text, text, text, integer, text) to authenticated;
grant execute on function public.assign_shift_resource(uuid, uuid, text, text) to authenticated;

revoke insert, update, delete on public.shifts from authenticated;
revoke insert, update, delete on public.shift_events from authenticated;
grant select on public.shift_events to authenticated;
