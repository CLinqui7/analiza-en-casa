-- Analiza en Casa · P0 lot 3
-- Secure notifications, immutable payment evidence, and atomic inventory.
-- All operational data remains organization-scoped; provider secrets remain server-only.

-- Notification records keep only the registered-recipient reference and a mask.
-- Raw telephone numbers, email addresses, clinical text, portal tokens and provider
-- credentials are intentionally absent from this persistence contract.
alter table public.notifications
  add column if not exists provider text not null default 'SIMULATED',
  add column if not exists recipient_type text,
  add column if not exists recipient_id uuid,
  add column if not exists related_entity_type text,
  add column if not exists related_entity_id uuid,
  add column if not exists sent_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists retry_count integer not null default 0,
  add column if not exists max_retries integer not null default 5,
  add column if not exists provider_reference text,
  add column if not exists error_code text;

alter table public.notifications
  drop constraint if exists notifications_status_check;
alter table public.notifications
  add constraint notifications_status_check check (status in ('QUEUED','RETRYING','SENT','DELIVERED','FAILED','CANCELLED','SIMULATED'));
alter table public.notifications
  add constraint notifications_recipient_type_check check (recipient_type is null or recipient_type in ('PATIENT','DOCTOR')),
  add constraint notifications_retry_bounds check (retry_count >= 0 and max_retries between 0 and 10);

create table if not exists public.notification_attempt (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  notification_id uuid not null references public.notifications(id) on delete restrict,
  provider text not null,
  channel text not null check (channel in ('WHATSAPP','SMS','EMAIL')),
  attempt_number integer not null check (attempt_number > 0),
  state text not null check (state in ('SIMULATED','SENT','DELIVERED','FAILED','CANCELLED')),
  provider_reference text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (notification_id, attempt_number)
);
create index if not exists notification_attempt_notification_idx on public.notification_attempt (notification_id, created_at desc);

-- Payments are created only through apply_payment and may only be reversed by
-- reverse_payment. They are never deleted, and their allocation/receipt evidence
-- remains separately addressable.
alter table public.payments
  add column if not exists hospitalization_id uuid references public.hospitalizations(id) on delete restrict,
  add column if not exists quote_version_id uuid references public.quote_versions(id) on delete restrict,
  add column if not exists currency char(3) not null default 'USD',
  add column if not exists reversed_by uuid references auth.users(id) on delete set null,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_reason text,
  add column if not exists reversal_idempotency_key text;
alter table public.payments
  add constraint payments_reversal_reason_check check ((status = 'REVERSED' and reversal_reason is not null and reversed_at is not null) or status <> 'REVERSED');

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  quote_version_id uuid references public.quote_versions(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'USD',
  status text not null default 'APPLIED' check (status in ('APPLIED','REVERSED')),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  unique (payment_id, quote_id, quote_version_id)
);
create index if not exists payment_allocations_quote_idx on public.payment_allocations (quote_id, status);

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  receipt_code text not null,
  status text not null default 'ISSUED' check (status in ('ISSUED','VOIDED')),
  issued_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text,
  unique (organization_id, receipt_code)
);

alter table public.notification_attempt enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.payment_receipts enable row level security;
drop policy if exists notification_attempt_read on public.notification_attempt;
create policy notification_attempt_read on public.notification_attempt for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_permission('quotes:read') or public.has_permission('insurance:read') or public.has_permission('payments:read') or public.has_permission('statements:read')
));
drop policy if exists payment_allocations_read on public.payment_allocations;
create policy payment_allocations_read on public.payment_allocations for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('payments:read'));
drop policy if exists payment_receipts_read on public.payment_receipts;
create policy payment_receipts_read on public.payment_receipts for select to authenticated
using (organization_id = public.current_organization_id() and public.has_permission('payments:read'));

create index if not exists payments_org_reference_idx on public.payments (organization_id, external_reference) where external_reference is not null;
create unique index if not exists payments_org_reversal_idempotency_idx on public.payments (organization_id, reversal_idempotency_key) where reversal_idempotency_key is not null;

-- A single open reservation represents the committed inventory for one case/item.
-- `available` is canonically `stock - committed`; the check intentionally does
-- not constrain historical delivered values from the synthetic seed.
create unique index if not exists inventory_open_reservation_unique_idx
  on public.inventory_reservations (organization_id, hospitalization_id, inventory_item_id)
  where status = 'OPEN';
create index if not exists inventory_lots_item_status_idx on public.inventory_lots (inventory_item_id, status, expires_at);

create or replace function public.prevent_payment_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los pagos no se eliminan; use una reversión auditada.';
  end if;
  if current_setting('app.payment_mutation', true) <> 'reverse' then
    raise exception 'Los pagos son inmutables; use el flujo de reversión auditada.';
  end if;
  if old.status <> 'APPLIED' or new.status <> 'REVERSED'
     or new.reversal_reason is null or btrim(new.reversal_reason) = '' then
    raise exception 'Transición de pago no permitida.';
  end if;
  return new;
end
$$;
drop trigger if exists protect_payment_mutation on public.payments;
create trigger protect_payment_mutation
before update or delete on public.payments
for each row execute function public.prevent_payment_mutation();

create or replace function public.prevent_inventory_movement_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Los movimientos de inventario son inmutables; registre un movimiento de ajuste o devolución.';
end
$$;
drop trigger if exists protect_inventory_movement_mutation on public.inventory_movements;
create trigger protect_inventory_movement_mutation
before update or delete on public.inventory_movements
for each row execute function public.prevent_inventory_movement_mutation();

-- Direct browser writes are denied. Security-definer RPCs below derive the
-- organization from auth.uid() and explicitly validate each role.
drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for insert to authenticated with check (false);
drop policy if exists inventory_movements_write on public.inventory_movements;
create policy inventory_movements_write on public.inventory_movements for insert to authenticated with check (false);
drop policy if exists inventory_reservations_write on public.inventory_reservations;
create policy inventory_reservations_write on public.inventory_reservations for all to authenticated using (false) with check (false);
drop policy if exists notifications_write on public.notifications;
create policy notifications_write on public.notifications for insert to authenticated with check (false);

create or replace function public.queue_notification(
  p_channel text,
  p_template_code text,
  p_recipient_type text,
  p_recipient_id uuid,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_idempotency_key text
)
returns public.notifications
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_destination text;
  v_masked text;
  v_notification public.notifications%rowtype;
  v_required_permission text;
begin
  if v_org is null then raise exception 'Organización no disponible'; end if;
  if p_channel not in ('WHATSAPP','SMS','EMAIL')
     or p_template_code not in ('QUOTE_READY','QUOTE_STATUS','PAYMENT_RECEIVED','DOCTOR_STATEMENT','NURSING_NOTE_AVAILABLE')
     or p_recipient_type not in ('PATIENT','DOCTOR')
     or p_recipient_id is null or p_related_entity_id is null
     or nullif(btrim(coalesce(p_related_entity_type,'')), '') is null
     or nullif(btrim(coalesce(p_idempotency_key,'')), '') is null or length(p_idempotency_key) > 160 then
    raise exception 'Solicitud de notificación inválida';
  end if;

  v_required_permission := case p_template_code
    when 'QUOTE_READY' then 'quotes:write'
    when 'QUOTE_STATUS' then 'insurance:write'
    when 'PAYMENT_RECEIVED' then 'payments:write'
    when 'DOCTOR_STATEMENT' then 'statements:write'
    when 'NURSING_NOTE_AVAILABLE' then 'clinical:write'
  end;
  if not public.has_permission(v_required_permission) then raise exception 'Permiso insuficiente'; end if;
  if (p_template_code in ('QUOTE_READY','QUOTE_STATUS','PAYMENT_RECEIVED') and p_recipient_type <> 'PATIENT')
     or (p_template_code in ('DOCTOR_STATEMENT','NURSING_NOTE_AVAILABLE') and p_recipient_type <> 'DOCTOR') then
    raise exception 'Destinatario no permitido para la plantilla';
  end if;
  if (p_related_entity_type = 'QUOTE' and not exists (select 1 from public.quotes where id = p_related_entity_id and organization_id = v_org))
     or (p_related_entity_type = 'QUOTE_VERSION' and not exists (select 1 from public.quote_versions where id = p_related_entity_id and organization_id = v_org))
     or (p_related_entity_type = 'PAYMENT' and not exists (select 1 from public.payments where id = p_related_entity_id and organization_id = v_org))
     or (p_related_entity_type = 'DOCTOR_STATEMENT' and not exists (select 1 from public.doctor_statements where id = p_related_entity_id and organization_id = v_org))
     or (p_related_entity_type = 'NURSING_NOTE' and not exists (select 1 from public.nursing_notes where id = p_related_entity_id and organization_id = v_org))
     or p_related_entity_type not in ('QUOTE','QUOTE_VERSION','PAYMENT','DOCTOR_STATEMENT','NURSING_NOTE') then
    raise exception 'Entidad relacionada no disponible';
  end if;
  if (p_template_code in ('QUOTE_READY','QUOTE_STATUS') and not exists (
        select 1 from public.quotes q where q.id = p_related_entity_id and p_related_entity_type = 'QUOTE'
          and q.organization_id = v_org and q.patient_id = p_recipient_id
        union all
        select 1 from public.quote_versions qv join public.quotes q on q.id = qv.quote_id
        where qv.id = p_related_entity_id and p_related_entity_type = 'QUOTE_VERSION'
          and qv.organization_id = v_org and q.patient_id = p_recipient_id
      ))
     or (p_template_code = 'PAYMENT_RECEIVED' and not exists (
        select 1 from public.payments where id = p_related_entity_id and p_related_entity_type = 'PAYMENT' and organization_id = v_org and patient_id = p_recipient_id
        union all
        select 1 from public.quotes where id = p_related_entity_id and p_related_entity_type = 'QUOTE' and organization_id = v_org and patient_id = p_recipient_id
      ))
     or (p_template_code = 'DOCTOR_STATEMENT' and not exists (
        select 1 from public.doctor_statements where id = p_related_entity_id and organization_id = v_org and doctor_id = p_recipient_id
      ))
     or (p_template_code = 'NURSING_NOTE_AVAILABLE' and not exists (
        select 1 from public.nursing_notes n join public.hospitalizations h on h.id = n.hospitalization_id
        where n.id = p_related_entity_id and n.organization_id = v_org and h.organization_id = v_org and h.contracting_doctor_id = p_recipient_id
      )) then
    raise exception 'Destinatario no autorizado para la entidad relacionada';
  end if;

  if p_recipient_type = 'PATIENT' then
    select case when p_channel = 'EMAIL' then email else phone end into v_destination
    from public.patients where id = p_recipient_id and organization_id = v_org and status = 'ACTIVE';
  else
    select case when p_channel = 'EMAIL' then email else phone end into v_destination
    from public.doctors where id = p_recipient_id and organization_id = v_org and status = 'ACTIVE';
  end if;
  if nullif(btrim(coalesce(v_destination,'')), '') is null then raise exception 'Canal registrado no disponible'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':' || p_idempotency_key, 0));
  select * into v_notification from public.notifications
  where organization_id = v_org and idempotency_key = p_idempotency_key;
  if found then return v_notification; end if;

  v_masked := case when p_channel = 'EMAIL'
    then left(v_destination, 2) || '•••@' || split_part(v_destination, '@', 2)
    else '•••• ' || right(regexp_replace(v_destination, '\D', '', 'g'), 4)
  end;
  insert into public.notifications (
    organization_id, provider, channel, template_code, recipient_type, recipient_id,
    related_entity_type, related_entity_id, destination_masked, status, payload, idempotency_key
  ) values (
    v_org, 'SIMULATED', p_channel, p_template_code, p_recipient_type, p_recipient_id,
    p_related_entity_type, p_related_entity_id, v_masked, 'QUEUED',
    jsonb_build_object('template_code', p_template_code, 'related_entity_type', p_related_entity_type), p_idempotency_key
  ) returning * into v_notification;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, auth.uid(), 'QUEUE_NOTIFICATION', 'NOTIFICATION', v_notification.id::text,
    'Notificación segura encolada.', jsonb_build_object('template_code', p_template_code, 'channel', p_channel, 'related_entity_type', p_related_entity_type));
  return v_notification;
end
$$;

create or replace function public.claim_notification_jobs(p_limit integer default 25)
returns setof public.notifications
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Servicio no autorizado'; end if;
  update public.notifications
  set status = 'CANCELLED', failed_at = coalesce(failed_at, now()), error_code = 'MAX_RETRIES_EXCEEDED', updated_at = now()
  where status in ('QUEUED','FAILED') and retry_count >= max_retries;
  return query
    update public.notifications
    set status = 'RETRYING', updated_at = now()
    where id in (
      select id from public.notifications
      where status in ('QUEUED','FAILED') and retry_count < max_retries
        and (next_retry_at is null or next_retry_at <= now())
      order by created_at for update skip locked limit greatest(1, least(p_limit, 100))
    )
    returning *;
end
$$;

create or replace function public.record_notification_attempt(
  p_notification_id uuid,
  p_provider text,
  p_state text,
  p_provider_reference text default null,
  p_error_code text default null
)
returns public.notifications
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_notification public.notifications%rowtype;
  v_retry integer;
  v_state text;
begin
  if auth.role() <> 'service_role' then raise exception 'Servicio no autorizado'; end if;
  if p_state not in ('SIMULATED','SENT','DELIVERED','FAILED','CANCELLED') then raise exception 'Estado inválido'; end if;
  select * into v_notification from public.notifications where id = p_notification_id for update;
  if not found or v_notification.status <> 'RETRYING' then raise exception 'Notificación no disponible'; end if;
  v_retry := v_notification.retry_count + 1;
  v_state := case when p_state = 'FAILED' and v_retry >= v_notification.max_retries then 'CANCELLED' else p_state end;
  insert into public.notification_attempt (organization_id, notification_id, provider, channel, attempt_number, state, provider_reference, error_code, completed_at)
  values (v_notification.organization_id, v_notification.id, coalesce(nullif(btrim(p_provider),''),'UNCONFIGURED'), v_notification.channel,
    v_retry, v_state, nullif(btrim(p_provider_reference),''), nullif(btrim(p_error_code),''), now());
  update public.notifications set
    provider = coalesce(nullif(btrim(p_provider),''),'UNCONFIGURED'), retry_count = v_retry,
    status = v_state, provider_reference = nullif(btrim(p_provider_reference),''), error_code = nullif(btrim(p_error_code),''),
    sent_at = case when v_state in ('SENT','DELIVERED') then now() else sent_at end,
    delivered_at = case when v_state = 'DELIVERED' then now() else delivered_at end,
    failed_at = case when v_state in ('FAILED','CANCELLED') then now() else failed_at end,
    next_retry_at = case when v_state = 'FAILED' then now() + make_interval(secs => least(3600, 60 * power(2, v_retry)::integer)) else null end,
    updated_at = now()
  where id = v_notification.id returning * into v_notification;
  insert into public.audit_logs (organization_id, action, entity_type, entity_id, summary, metadata)
  values (v_notification.organization_id, 'NOTIFICATION_ATTEMPT', 'NOTIFICATION', v_notification.id::text,
    'Intento de notificación registrado.', jsonb_build_object('state', v_state, 'retry_count', v_retry, 'error_code', p_error_code));
  return v_notification;
end
$$;

create or replace function public.apply_payment(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_hospitalization_id uuid,
  p_patient_id uuid,
  p_amount numeric,
  p_currency char(3),
  p_method text,
  p_payer text,
  p_external_reference text,
  p_idempotency_key text
)
returns public.payments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_quote public.quotes%rowtype;
  v_payment public.payments%rowtype;
  v_balance numeric(14,2);
  v_reference text := nullif(btrim(coalesce(p_external_reference,'')), '');
  v_receipt text;
begin
  if v_org is null or not public.has_permission('payments:write') then raise exception 'Permiso insuficiente'; end if;
  if p_quote_id is null or p_patient_id is null or p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2)
     or nullif(btrim(coalesce(p_method,'')), '') is null or v_reference is null
     or nullif(btrim(coalesce(p_idempotency_key,'')), '') is null or length(p_idempotency_key) > 160 then
    raise exception 'Pago inválido';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':' || p_idempotency_key, 0));
  select * into v_payment from public.payments where organization_id = v_org and idempotency_key = p_idempotency_key;
  if found then return v_payment; end if;
  select * into v_quote from public.quotes where id = p_quote_id and organization_id = v_org for update;
  if not found or v_quote.patient_id <> p_patient_id then raise exception 'Cotización no disponible'; end if;
  if p_hospitalization_id is not null and not exists (select 1 from public.hospitalizations where id = p_hospitalization_id and organization_id = v_org and patient_id = p_patient_id) then
    raise exception 'Hospitalización no disponible';
  end if;
  if p_quote_version_id is not null and not exists (select 1 from public.quote_versions where id = p_quote_version_id and quote_id = v_quote.id and organization_id = v_org) then
    raise exception 'Versión de cotización no disponible';
  end if;
  if exists (select 1 from public.payments where organization_id = v_org and external_reference = v_reference) then raise exception 'Referencia de pago duplicada'; end if;
  select greatest(0, v_quote.patient_amount - coalesce(sum(amount) filter (where status = 'APPLIED'), 0)) into v_balance
  from public.payments where quote_id = v_quote.id and organization_id = v_org;
  if p_amount > v_balance then raise exception 'El pago supera el saldo pendiente'; end if;
  v_receipt := 'REC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8));
  insert into public.payments (organization_id, quote_id, quote_version_id, hospitalization_id, patient_id, amount, currency, method, payer, external_reference, status, receipt_code, idempotency_key, created_by, paid_at)
  values (v_org, v_quote.id, p_quote_version_id, p_hospitalization_id, p_patient_id, p_amount, coalesce(p_currency, v_quote.currency, 'USD'), p_method, nullif(btrim(p_payer),''), v_reference, 'APPLIED', v_receipt, p_idempotency_key, auth.uid(), now())
  returning * into v_payment;
  insert into public.payment_allocations (organization_id, payment_id, quote_id, quote_version_id, amount, currency)
  values (v_org, v_payment.id, v_quote.id, p_quote_version_id, p_amount, v_payment.currency);
  insert into public.payment_receipts (organization_id, payment_id, receipt_code) values (v_org, v_payment.id, v_receipt);
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, auth.uid(), 'APPLY_PAYMENT', 'PAYMENT', v_payment.id::text, 'Pago aplicado y comprobante emitido.', jsonb_build_object('quote_id', v_quote.id, 'amount', p_amount, 'currency', v_payment.currency));
  return v_payment;
end
$$;

create or replace function public.reverse_payment(p_payment_id uuid, p_reason text, p_idempotency_key text)
returns public.payments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_payment public.payments%rowtype;
begin
  if v_org is null or not public.has_permission('payments:write') then raise exception 'Permiso insuficiente'; end if;
  if nullif(btrim(coalesce(p_reason,'')), '') is null or nullif(btrim(coalesce(p_idempotency_key,'')), '') is null then raise exception 'Motivo e idempotencia obligatorios'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':reverse:' || p_idempotency_key, 0));
  select * into v_payment from public.payments where id = p_payment_id and organization_id = v_org for update;
  if not found then raise exception 'Pago no disponible'; end if;
  if v_payment.status = 'REVERSED' and v_payment.reversal_idempotency_key = p_idempotency_key then return v_payment; end if;
  if v_payment.status <> 'APPLIED' then raise exception 'El pago no puede revertirse'; end if;
  perform set_config('app.payment_mutation', 'reverse', true);
  update public.payments set status = 'REVERSED', reversed_by = auth.uid(), reversed_at = now(), reversal_reason = btrim(p_reason), reversal_idempotency_key = p_idempotency_key
  where id = v_payment.id returning * into v_payment;
  update public.payment_allocations set status = 'REVERSED', reversed_at = now() where payment_id = v_payment.id and status = 'APPLIED';
  update public.payment_receipts set status = 'VOIDED', voided_at = now(), void_reason = btrim(p_reason) where payment_id = v_payment.id;
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, auth.uid(), 'REVERSE_PAYMENT', 'PAYMENT', v_payment.id::text, 'Pago revertido sin eliminar el registro.', jsonb_build_object('reason', btrim(p_reason)));
  return v_payment;
end
$$;

create or replace function public.apply_inventory_movement_v2(
  p_inventory_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_hospitalization_id uuid default null,
  p_warehouse_to_id uuid default null,
  p_lot_id uuid default null,
  p_lot_number text default null,
  p_lot_expires_at date default null,
  p_reference text default null,
  p_note text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_source public.inventory_items%rowtype;
  v_target public.inventory_items%rowtype;
  v_lot public.inventory_lots%rowtype;
  v_reservation public.inventory_reservations%rowtype;
  v_movement_id uuid;
  v_key text := nullif(btrim(coalesce(p_idempotency_key,'')), '');
  v_requires_lot boolean;
  v_lot_id uuid := p_lot_id;
begin
  if v_org is null or not public.has_permission('inventory:write') then raise exception 'Permiso insuficiente'; end if;
  if p_movement_type not in ('PURCHASE_ENTRY','PATIENT_COMMITMENT','PATIENT_CONSUMPTION','RETURN_TO_STOCK','TRANSFER','POSITIVE_ADJUSTMENT','NEGATIVE_ADJUSTMENT','EXPIRY_DISPOSAL')
     or p_quantity is null or p_quantity <= 0 or v_key is null or length(v_key) > 160 then raise exception 'Movimiento inválido'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':' || v_key, 0));
  select id into v_movement_id from public.inventory_movements where organization_id = v_org and idempotency_key = v_key;
  if found then return v_movement_id; end if;
  select i.*, c.requires_lot into v_source, v_requires_lot
  from public.inventory_items i join public.catalog_items c on c.id = i.catalog_item_id
  where i.id = p_inventory_item_id and i.organization_id = v_org and c.organization_id = v_org for update;
  if not found then raise exception 'Ítem no disponible'; end if;
  if v_requires_lot and p_lot_id is null and nullif(btrim(coalesce(p_lot_number,'')), '') is null then raise exception 'El ítem requiere lote o serie'; end if;
  if p_hospitalization_id is not null and not exists (select 1 from public.hospitalizations where id = p_hospitalization_id and organization_id = v_org) then raise exception 'Hospitalización no disponible'; end if;
  if p_movement_type in ('PATIENT_COMMITMENT','PATIENT_CONSUMPTION') and p_hospitalization_id is null then raise exception 'Hospitalización requerida'; end if;
  if p_lot_id is not null then
    select * into v_lot from public.inventory_lots where id = p_lot_id and inventory_item_id = v_source.id and organization_id = v_org for update;
    if not found or v_lot.status <> 'AVAILABLE' or (v_lot.expires_at is not null and v_lot.expires_at < current_date) then raise exception 'Lote no disponible'; end if;
  elsif nullif(btrim(coalesce(p_lot_number,'')), '') is not null then
    if p_lot_expires_at is not null and p_lot_expires_at < current_date then raise exception 'No se puede ingresar un lote vencido'; end if;
    insert into public.inventory_lots (organization_id, inventory_item_id, lot_number, expires_at, quantity, status)
    values (v_org, v_source.id, btrim(p_lot_number), p_lot_expires_at, 0, 'AVAILABLE') returning * into v_lot;
    v_lot_id := v_lot.id;
  end if;
  if p_movement_type in ('PATIENT_CONSUMPTION','NEGATIVE_ADJUSTMENT','EXPIRY_DISPOSAL','TRANSFER') and v_source.stock - v_source.committed < p_quantity
     and p_movement_type <> 'PATIENT_CONSUMPTION' then raise exception 'Stock libre insuficiente'; end if;
  if p_movement_type = 'PATIENT_CONSUMPTION' and v_source.committed < p_quantity then raise exception 'Consumo superior a lo comprometido'; end if;
  if v_lot_id is not null and p_movement_type in ('PATIENT_CONSUMPTION','NEGATIVE_ADJUSTMENT','EXPIRY_DISPOSAL','TRANSFER') and v_lot.quantity < p_quantity then raise exception 'Cantidad de lote insuficiente'; end if;

  if p_movement_type = 'TRANSFER' then
    if p_warehouse_to_id is null or p_warehouse_to_id = v_source.warehouse_id then raise exception 'Bodega destino requerida'; end if;
    select * into v_target from public.inventory_items where organization_id = v_org and warehouse_id = p_warehouse_to_id and catalog_item_id = v_source.catalog_item_id for update;
    if not found then raise exception 'Ítem no configurado en la bodega destino'; end if;
    update public.inventory_items set stock = stock - p_quantity where id = v_source.id;
    update public.inventory_items set stock = stock + p_quantity where id = v_target.id;
    if v_lot_id is not null then
      update public.inventory_lots set quantity = quantity - p_quantity, status = case when quantity - p_quantity = 0 then 'CONSUMED' else status end where id = v_lot_id;
      insert into public.inventory_lots (organization_id, inventory_item_id, lot_number, serial_number, expires_at, quantity, status)
      values (v_org, v_target.id, v_lot.lot_number, v_lot.serial_number, v_lot.expires_at, p_quantity, 'AVAILABLE');
    end if;
  elsif p_movement_type in ('PURCHASE_ENTRY','POSITIVE_ADJUSTMENT') then
    update public.inventory_items set stock = stock + p_quantity where id = v_source.id;
    if v_lot_id is not null then update public.inventory_lots set quantity = quantity + p_quantity where id = v_lot_id; end if;
  elsif p_movement_type = 'PATIENT_COMMITMENT' then
    if v_source.stock - v_source.committed < p_quantity then raise exception 'Stock libre insuficiente'; end if;
    update public.inventory_items set committed = committed + p_quantity where id = v_source.id;
    select * into v_reservation from public.inventory_reservations where organization_id = v_org and hospitalization_id = p_hospitalization_id and inventory_item_id = v_source.id and status = 'OPEN' for update;
    if found then update public.inventory_reservations set quantity = quantity + p_quantity, updated_at = now() where id = v_reservation.id;
    else insert into public.inventory_reservations (organization_id, hospitalization_id, inventory_item_id, quantity) values (v_org, p_hospitalization_id, v_source.id, p_quantity); end if;
  elsif p_movement_type = 'PATIENT_CONSUMPTION' then
    select * into v_reservation from public.inventory_reservations where organization_id = v_org and hospitalization_id = p_hospitalization_id and inventory_item_id = v_source.id and status = 'OPEN' for update;
    if not found or v_reservation.quantity - v_reservation.consumed - v_reservation.returned < p_quantity then raise exception 'Consumo superior a la reserva'; end if;
    update public.inventory_items set committed = committed - p_quantity, stock = stock - p_quantity where id = v_source.id;
    update public.inventory_reservations set consumed = consumed + p_quantity, delivered = delivered + p_quantity, updated_at = now() where id = v_reservation.id;
    if v_lot_id is not null then update public.inventory_lots set quantity = quantity - p_quantity, status = case when quantity - p_quantity = 0 then 'CONSUMED' else status end where id = v_lot_id; end if;
  elsif p_movement_type = 'RETURN_TO_STOCK' and p_hospitalization_id is not null then
    select * into v_reservation from public.inventory_reservations where organization_id = v_org and hospitalization_id = p_hospitalization_id and inventory_item_id = v_source.id and status = 'OPEN' for update;
    if not found or v_source.committed < p_quantity or v_reservation.quantity - v_reservation.consumed - v_reservation.returned < p_quantity then raise exception 'Devolución superior a la reserva'; end if;
    update public.inventory_items set committed = committed - p_quantity where id = v_source.id;
    update public.inventory_reservations set returned = returned + p_quantity, updated_at = now() where id = v_reservation.id;
  elsif p_movement_type = 'RETURN_TO_STOCK' then
    update public.inventory_items set stock = stock + p_quantity where id = v_source.id;
    if v_lot_id is not null then update public.inventory_lots set quantity = quantity + p_quantity where id = v_lot_id; end if;
  else
    update public.inventory_items set stock = stock - p_quantity where id = v_source.id;
    if v_lot_id is not null then update public.inventory_lots set quantity = quantity - p_quantity, status = case when quantity - p_quantity = 0 then 'CONSUMED' else status end where id = v_lot_id; end if;
  end if;

  insert into public.inventory_movements (organization_id, inventory_item_id, hospitalization_id, movement_type, quantity, warehouse_from_id, warehouse_to_id, lot_id, reference, note, idempotency_key, created_by)
  values (v_org, v_source.id, p_hospitalization_id, p_movement_type, p_quantity, v_source.warehouse_id, p_warehouse_to_id, v_lot_id, nullif(btrim(p_reference),''), nullif(btrim(p_note),''), v_key, auth.uid())
  returning id into v_movement_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, auth.uid(), 'APPLY_INVENTORY_MOVEMENT', 'INVENTORY_MOVEMENT', v_movement_id::text, 'Movimiento de inventario aplicado.', jsonb_build_object('movement_type', p_movement_type, 'quantity', p_quantity, 'hospitalization_id', p_hospitalization_id));
  return v_movement_id;
end
$$;

-- All privileged functions are explicitly closed to PUBLIC. The notification
-- worker functions are service-only internally; their grants are kept narrow so
-- the database checks remain the final authorization boundary.
revoke all on function public.queue_notification(text,text,text,uuid,text,uuid,text) from public;
grant execute on function public.queue_notification(text,text,text,uuid,text,uuid,text) to authenticated, service_role;
revoke all on function public.claim_notification_jobs(integer) from public;
grant execute on function public.claim_notification_jobs(integer) to service_role;
revoke all on function public.record_notification_attempt(uuid,text,text,text,text) from public;
grant execute on function public.record_notification_attempt(uuid,text,text,text,text) to service_role;
revoke all on function public.apply_payment(uuid,uuid,uuid,uuid,numeric,char,text,text,text,text) from public;
grant execute on function public.apply_payment(uuid,uuid,uuid,uuid,numeric,char,text,text,text,text) to authenticated, service_role;
revoke all on function public.reverse_payment(uuid,text,text) from public;
grant execute on function public.reverse_payment(uuid,text,text) to authenticated, service_role;
revoke all on function public.apply_inventory_movement_v2(uuid,text,numeric,uuid,uuid,uuid,text,date,text,text,text) from public;
grant execute on function public.apply_inventory_movement_v2(uuid,text,numeric,uuid,uuid,uuid,text,date,text,text,text) to authenticated, service_role;
