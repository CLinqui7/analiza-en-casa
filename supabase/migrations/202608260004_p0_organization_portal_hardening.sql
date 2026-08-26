-- P0 hardening: trustworthy organization membership and patient portal MFA.
-- This migration intentionally derives organization scope in PostgreSQL. Browser
-- payloads are never an authorization source.

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role_id uuid not null references public.roles(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index if not exists organization_invitations_active_email_idx
  on public.organization_invitations (organization_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.patient_portal_links
  add column if not exists verification_code_expires_at timestamptz,
  add column if not exists verification_code_issued_at timestamptz,
  add column if not exists verification_code_used_at timestamptz,
  add column if not exists verification_code_generation integer not null default 0,
  add column if not exists delivery_channel text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'patient_portal_links_delivery_channel_check'
      and conrelid = 'public.patient_portal_links'::regclass
  ) then
    alter table public.patient_portal_links
      add constraint patient_portal_links_delivery_channel_check
      check (delivery_channel is null or delivery_channel in ('SMS', 'WHATSAPP', 'EMAIL'));
  end if;
end
$$;

alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.organization_invitations enable row level security;

-- No direct membership, role, permission or invitation writes are allowed. These
-- records are changed only through the authorized functions below.
drop policy if exists organization_invitations_select on public.organization_invitations;
create policy organization_invitations_select on public.organization_invitations
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_permission('settings:read')
);

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.organization_id
  from public.profiles p
  where p.id = auth.uid()
    and p.status = 'ACTIVE'
  limit 1
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur
      on ur.user_id = p.id
     and ur.organization_id = p.organization_id
    join public.roles r
      on r.id = ur.role_id
     and r.organization_id = ur.organization_id
    join public.role_permissions rp on rp.role_id = r.id
    where p.id = auth.uid()
      and p.status = 'ACTIVE'
      and p.organization_id = public.current_organization_id()
      and rp.permission_code = p_permission
  )
$$;

create or replace function public.validate_organization_invitation_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.roles r
    where r.id = new.role_id
      and r.organization_id = new.organization_id
  ) then
    raise exception 'Invitación no válida';
  end if;

  if new.branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = new.branch_id
      and b.organization_id = new.organization_id
  ) then
    raise exception 'Invitación no válida';
  end if;

  return new;
end
$$;

drop trigger if exists validate_organization_invitation_scope on public.organization_invitations;
create trigger validate_organization_invitation_scope
before insert or update on public.organization_invitations
for each row execute function public.validate_organization_invitation_scope();

create or replace function public.bootstrap_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invitation public.organization_invitations%rowtype;
begin
  select * into invitation
  from public.organization_invitations oi
  where lower(oi.email) = lower(coalesce(new.email, ''))
    and oi.accepted_at is null
    and oi.revoked_at is null
    and oi.expires_at > now()
  order by oi.created_at asc
  limit 1
  for update;

  if found then
    insert into public.profiles (id, organization_id, branch_id, full_name, status)
    values (
      new.id,
      invitation.organization_id,
      invitation.branch_id,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email, ''),
      'ACTIVE'
    )
    on conflict (id) do nothing;

    insert into public.user_roles (organization_id, user_id, role_id)
    values (invitation.organization_id, new.id, invitation.role_id)
    on conflict do nothing;

    update public.organization_invitations
    set accepted_at = now()
    where id = invitation.id;

    insert into public.audit_logs (
      organization_id, actor_user_id, actor_name, actor_role,
      action, entity_type, entity_id, summary, metadata
    ) values (
      invitation.organization_id, new.id, coalesce(new.email, ''), 'INVITED_USER',
      'ACCEPT_ORGANIZATION_INVITATION', 'organization_invitation', invitation.id::text,
      'Invitación aceptada y membresía asignada por flujo confiable.',
      jsonb_build_object('role_id', invitation.role_id, 'branch_id', invitation.branch_id)
    );
  else
    insert into public.profiles (id, full_name, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email, ''),
      'INVITED'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end
$$;

create or replace function public.protect_profile_assignment_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() = old.id and (
    new.organization_id is distinct from old.organization_id
    or new.branch_id is distinct from old.branch_id
    or new.status is distinct from old.status
  ) then
    raise exception 'Actualización de perfil no permitida';
  end if;
  return new;
end
$$;

drop trigger if exists protect_profile_assignment_fields on public.profiles;
create trigger protect_profile_assignment_fields
before update on public.profiles
for each row execute function public.protect_profile_assignment_fields();

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and organization_id = public.current_organization_id());

create or replace function public.enforce_actor_organization_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() = 'authenticated' then
    new.organization_id := public.current_organization_id();
    if new.organization_id is null then
      raise exception 'Operación no autorizada';
    end if;
  end if;
  return new;
end
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'branches','insurers','insurance_plans','patients','patient_contacts','patient_addresses',
    'patient_insurances','doctors','hospitalizations','hospitalization_status_events','files',
    'catalog_items','price_lists','price_list_items','discount_rules','quotes','quote_versions',
    'quote_items','quote_status_events','insurance_requests','insurance_request_events',
    'payments','financial_adjustments','document_templates','clinical_documents','vital_signs',
    'medication_cards','medication_card_items','medication_administrations','nursing_notes',
    'shifts','suppliers','purchases','purchase_items','warehouses','inventory_items',
    'inventory_lots','inventory_movements','inventory_reservations','inventory_closures',
    'inventory_closure_items','supply_kits','doctor_services','doctor_statements',
    'notifications','audit_logs','organization_invitations'
  ]
  loop
    execute format('drop trigger if exists enforce_actor_organization_id on public.%I', table_name);
    execute format(
      'create trigger enforce_actor_organization_id before insert or update on public.%I for each row execute function public.enforce_actor_organization_id()',
      table_name
    );
  end loop;
end
$$;

create or replace function public.create_organization_invitation(
  p_email text,
  p_role_id uuid,
  p_branch_id uuid,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invitation_id uuid;
  organization uuid := public.current_organization_id();
begin
  if auth.uid() is null or organization is null or not public.has_permission('settings:write') then
    raise exception 'Operación no autorizada';
  end if;
  if nullif(trim(p_email), '') is null or p_expires_at <= now() then
    raise exception 'Datos de invitación no válidos';
  end if;

  insert into public.organization_invitations (
    organization_id, email, role_id, branch_id, expires_at, created_by
  ) values (
    organization, lower(trim(p_email)), p_role_id, p_branch_id, p_expires_at, auth.uid()
  ) returning id into invitation_id;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata
  ) values (
    organization, auth.uid(), 'CREATE_ORGANIZATION_INVITATION', 'organization_invitation', invitation_id::text,
    'Invitación de organización creada mediante función autorizada.',
    jsonb_build_object('role_id', p_role_id, 'branch_id', p_branch_id)
  );

  return invitation_id;
end
$$;

create or replace function public.assign_organization_role(
  p_user_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  organization uuid := public.current_organization_id();
begin
  if auth.uid() is null or organization is null or not public.has_permission('settings:write') then
    raise exception 'Operación no autorizada';
  end if;
  if p_user_id is null or p_role_id is null or p_user_id = auth.uid() then
    raise exception 'Operación no autorizada';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and p.organization_id = organization
      and p.status = 'ACTIVE'
  ) or not exists (
    select 1 from public.roles r
    where r.id = p_role_id and r.organization_id = organization
  ) then
    raise exception 'Operación no autorizada';
  end if;

  insert into public.user_roles (organization_id, user_id, role_id)
  values (organization, p_user_id, p_role_id)
  on conflict do nothing;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata
  ) values (
    organization, auth.uid(), 'ASSIGN_ORGANIZATION_ROLE', 'user_role', p_user_id::text,
    'Rol asignado mediante función autorizada.', jsonb_build_object('role_id', p_role_id)
  );
end
$$;

create or replace function public.validate_patient_portal_link_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
    from public.quotes q
    join public.patients p on p.id = q.patient_id
    where q.id = new.quote_id
      and q.patient_id = new.patient_id
      and q.organization_id = new.organization_id
      and p.organization_id = new.organization_id
  ) then
    raise exception 'Enlace de portal no válido';
  end if;
  return new;
end
$$;

drop trigger if exists validate_patient_portal_link_scope on public.patient_portal_links;
create trigger validate_patient_portal_link_scope
before insert or update on public.patient_portal_links
for each row execute function public.validate_patient_portal_link_scope();

create or replace function public.portal_log_access(
  p_organization_id uuid,
  p_portal_link_id uuid,
  p_success boolean,
  p_reason text,
  p_ip_hash text default null,
  p_user_agent_hash text default null
)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  insert into public.patient_portal_access_logs (
    organization_id, portal_link_id, success, reason, ip_hash, user_agent_hash
  ) values (
    p_organization_id, p_portal_link_id, p_success, p_reason, p_ip_hash, p_user_agent_hash
  )
$$;

create or replace function public.create_patient_portal_link(
  p_quote_id uuid,
  p_delivery_channel text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  quote_record public.quotes%rowtype;
  raw_token text := encode(gen_random_bytes(32), 'hex');
  link_id uuid;
begin
  if auth.uid() is null or not public.has_permission('quotes:write') then
    raise exception 'Operación no autorizada';
  end if;
  if p_delivery_channel not in ('SMS', 'WHATSAPP', 'EMAIL') or p_expires_at <= now() then
    raise exception 'Datos de enlace no válidos';
  end if;

  select * into quote_record
  from public.quotes q
  where q.id = p_quote_id
    and q.organization_id = public.current_organization_id();
  if not found then
    raise exception 'Operación no autorizada';
  end if;

  insert into public.patient_portal_links (
    organization_id, quote_id, patient_id, token_hash, expires_at, delivery_channel
  ) values (
    quote_record.organization_id, quote_record.id, quote_record.patient_id,
    encode(digest(raw_token, 'sha256'), 'hex'), p_expires_at, p_delivery_channel
  ) returning id into link_id;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata
  ) values (
    quote_record.organization_id, auth.uid(), 'CREATE_PATIENT_PORTAL_LINK',
    'patient_portal_link', link_id::text,
    'Enlace de portal creado mediante función autorizada.',
    jsonb_build_object('quote_id', quote_record.id, 'channel', p_delivery_channel, 'expires_at', p_expires_at)
  );

  return jsonb_build_object('id', link_id, 'token', raw_token, 'expires_at', p_expires_at);
end
$$;

create or replace function public.revoke_patient_portal_link(
  p_portal_link_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  portal public.patient_portal_links%rowtype;
begin
  if auth.uid() is null or not public.has_permission('quotes:write') then
    raise exception 'Operación no autorizada';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Motivo de revocación requerido';
  end if;

  select * into portal
  from public.patient_portal_links
  where id = p_portal_link_id
    and organization_id = public.current_organization_id()
  for update;
  if not found then
    raise exception 'Operación no autorizada';
  end if;

  update public.patient_portal_links
  set revoked_at = coalesce(revoked_at, now()),
      verification_code_hash = null,
      verification_code_expires_at = null
  where id = portal.id;

  perform public.portal_log_access(portal.organization_id, portal.id, false, 'REVOKED');
  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata
  ) values (
    portal.organization_id, auth.uid(), 'REVOKE_PATIENT_PORTAL_LINK',
    'patient_portal_link', portal.id::text,
    'Enlace de portal revocado mediante función autorizada.', jsonb_build_object('reason', trim(p_reason))
  );
end
$$;

create or replace function public.portal_issue_verification_code(
  p_token text,
  p_verification_code_hash text,
  p_ip_hash text default null,
  p_user_agent_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  portal public.patient_portal_links%rowtype;
  destination text;
  recent_requests integer;
begin
  if auth.role() <> 'service_role'
    or p_token is null
    or length(p_token) < 32
    or p_verification_code_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('accepted', false);
  end if;

  select * into portal
  from public.patient_portal_links
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;
  if not found then
    return jsonb_build_object('accepted', false);
  end if;
  if portal.revoked_at is not null then
    perform public.portal_log_access(portal.organization_id, portal.id, false, 'REVOKED', p_ip_hash, p_user_agent_hash);
    return jsonb_build_object('accepted', false);
  end if;
  if portal.expires_at <= now() then
    perform public.portal_log_access(portal.organization_id, portal.id, false, 'EXPIRED', p_ip_hash, p_user_agent_hash);
    return jsonb_build_object('accepted', false);
  end if;
  if portal.failed_attempts >= portal.max_attempts then
    perform public.portal_log_access(portal.organization_id, portal.id, false, 'ATTEMPT_LIMIT', p_ip_hash, p_user_agent_hash);
    return jsonb_build_object('accepted', false);
  end if;

  select count(*) into recent_requests
  from public.patient_portal_access_logs l
  where l.portal_link_id = portal.id
    and l.ip_hash is not distinct from p_ip_hash
    and l.reason = 'OTP_ISSUED'
    and l.created_at > now() - interval '10 minutes';
  if recent_requests >= 5 then
    perform public.portal_log_access(portal.organization_id, portal.id, false, 'RATE_LIMITED', p_ip_hash, p_user_agent_hash);
    return jsonb_build_object('accepted', false);
  end if;

  select case portal.delivery_channel
    when 'EMAIL' then p.email
    when 'SMS' then p.phone
    when 'WHATSAPP' then p.phone
  end into destination
  from public.patients p
  where p.id = portal.patient_id
    and p.organization_id = portal.organization_id;
  if nullif(trim(destination), '') is null then
    perform public.portal_log_access(portal.organization_id, portal.id, false, 'NO_REGISTERED_CHANNEL', p_ip_hash, p_user_agent_hash);
    return jsonb_build_object('accepted', false);
  end if;

  update public.patient_portal_links
  set verification_code_hash = p_verification_code_hash,
      verification_code_issued_at = now(),
      verification_code_expires_at = now() + interval '10 minutes',
      verification_code_used_at = null,
      verification_code_generation = verification_code_generation + 1,
      failed_attempts = 0
  where id = portal.id;

  perform public.portal_log_access(portal.organization_id, portal.id, false, 'OTP_ISSUED', p_ip_hash, p_user_agent_hash);
  return jsonb_build_object('accepted', true, 'channel', portal.delivery_channel, 'destination', destination);
end
$$;

drop function if exists public.portal_quote_snapshot(text, text, text);
create function public.portal_quote_snapshot(
  p_token text,
  p_verification_code text,
  p_ip_hash text default null,
  p_user_agent_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  portal public.patient_portal_links%rowtype;
  result jsonb;
begin
  if auth.role() <> 'service_role' or p_token is null or length(p_token) < 32 then
    return null;
  end if;

  select * into portal
  from public.patient_portal_links
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;
  if not found then
    return null;
  end if;
  if portal.revoked_at is not null then
    perform public.portal_log_access(portal.organization_id, portal.id, false, 'REVOKED', p_ip_hash, p_user_agent_hash);
    return null;
  end if;
  if portal.expires_at <= now() then
    perform public.portal_log_access(portal.organization_id, portal.id, false, 'EXPIRED', p_ip_hash, p_user_agent_hash);
    return null;
  end if;
  if portal.failed_attempts >= portal.max_attempts then
    perform public.portal_log_access(portal.organization_id, portal.id, false, 'ATTEMPT_LIMIT', p_ip_hash, p_user_agent_hash);
    return null;
  end if;
  if portal.verification_code_hash is null
    or portal.verification_code_used_at is not null
    or portal.verification_code_expires_at is null
    or portal.verification_code_expires_at <= now() then
    perform public.portal_log_access(portal.organization_id, portal.id, false, 'CODE_EXPIRED_OR_USED', p_ip_hash, p_user_agent_hash);
    return null;
  end if;
  if portal.verification_code_hash <> encode(digest(coalesce(p_verification_code, ''), 'sha256'), 'hex') then
    update public.patient_portal_links
    set failed_attempts = failed_attempts + 1
    where id = portal.id;
    perform public.portal_log_access(portal.organization_id, portal.id, false, 'INVALID_CODE', p_ip_hash, p_user_agent_hash);
    return null;
  end if;

  update public.patient_portal_links
  set failed_attempts = 0,
      verification_code_used_at = now(),
      last_access_at = now()
  where id = portal.id;

  select jsonb_build_object(
    'quote_id', q.code,
    'status', q.status,
    'total', q.total,
    'insurer_amount', q.insurer_amount,
    'patient_amount', q.patient_amount,
    'paid', coalesce((select sum(pay.amount) from public.payments pay where pay.quote_id = q.id and pay.status = 'APPLIED'), 0),
    'balance', greatest(0, q.patient_amount - coalesce((select sum(pay.amount) from public.payments pay where pay.quote_id = q.id and pay.status = 'APPLIED'), 0)),
    'updated_at', q.updated_at,
    'events', coalesce((select jsonb_agg(jsonb_build_object('status', e.to_status, 'date', e.created_at) order by e.created_at) from public.quote_status_events e where e.quote_id = q.id), '[]'::jsonb)
  ) into result
  from public.quotes q
  where q.id = portal.quote_id
    and q.organization_id = portal.organization_id
    and q.patient_id = portal.patient_id;

  if result is null then
    perform public.portal_log_access(portal.organization_id, portal.id, false, 'SCOPE_MISMATCH', p_ip_hash, p_user_agent_hash);
    return null;
  end if;

  perform public.portal_log_access(portal.organization_id, portal.id, true, 'VERIFIED', p_ip_hash, p_user_agent_hash);
  return result;
end
$$;

-- SECURITY DEFINER routines have no implicit PUBLIC execution. Functions used by
-- RLS get the narrow authenticated grant; internal portal routines are server-only.
revoke all on function public.current_organization_id() from public, anon, authenticated;
revoke all on function public.has_permission(text) from public, anon, authenticated;
revoke all on function public.bootstrap_new_user() from public, anon, authenticated;
revoke all on function public.protect_profile_assignment_fields() from public, anon, authenticated;
revoke all on function public.enforce_actor_organization_id() from public, anon, authenticated;
revoke all on function public.validate_organization_invitation_scope() from public, anon, authenticated;
revoke all on function public.validate_patient_portal_link_scope() from public, anon, authenticated;
revoke all on function public.portal_log_access(uuid, uuid, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.create_organization_invitation(text, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.assign_organization_role(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_patient_portal_link(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_patient_portal_link(uuid, text) from public, anon, authenticated;
revoke all on function public.portal_issue_verification_code(text, text, text, text) from public, anon, authenticated;
revoke all on function public.portal_quote_snapshot(text, text, text, text) from public, anon, authenticated;
revoke all on function public.apply_inventory_movement(uuid, text, numeric, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_notification_retries(integer) from public, anon, authenticated;
revoke all on function public.protect_signed_clinical_document() from public, anon, authenticated;
revoke all on function public.protect_signed_nursing_note() from public, anon, authenticated;

grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.create_organization_invitation(text, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.assign_organization_role(uuid, uuid) to authenticated;
grant execute on function public.create_patient_portal_link(uuid, text, timestamptz) to authenticated;
grant execute on function public.revoke_patient_portal_link(uuid, text) to authenticated;
grant execute on function public.apply_inventory_movement(uuid, text, numeric, uuid, uuid, text, text, text) to authenticated;
grant execute on function public.portal_issue_verification_code(text, text, text, text) to service_role;
grant execute on function public.portal_quote_snapshot(text, text, text, text) to service_role;
grant execute on function public.claim_notification_retries(integer) to service_role;

alter function public.protect_signed_clinical_document() set search_path = pg_catalog, public;
alter function public.protect_signed_nursing_note() set search_path = pg_catalog, public;
alter function public.apply_inventory_movement(uuid, text, numeric, uuid, uuid, text, text, text) set search_path = pg_catalog, public;
alter function public.claim_notification_retries(integer) set search_path = pg_catalog, public;
