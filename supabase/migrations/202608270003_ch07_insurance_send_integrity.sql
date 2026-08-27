-- CH07: quote delivery and insurance transitions are atomic, idempotent and auditable.
-- Browser roles cannot mutate insurance state or append history outside these RPCs.

alter table public.insurance_request_events
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists insurance_request_events_org_idempotency_uidx
  on public.insurance_request_events (organization_id, idempotency_key)
  where idempotency_key is not null;

drop policy if exists insurance_requests_write on public.insurance_requests;
drop policy if exists insurance_requests_insert on public.insurance_requests;
drop policy if exists insurance_requests_update on public.insurance_requests;
drop policy if exists insurance_requests_delete on public.insurance_requests;
create policy insurance_requests_rpc_only on public.insurance_requests
  for all to authenticated using (false) with check (false);

drop policy if exists insurance_events_write on public.insurance_request_events;
drop policy if exists insurance_request_events_insert on public.insurance_request_events;
drop policy if exists insurance_request_events_update on public.insurance_request_events;
drop policy if exists insurance_request_events_delete on public.insurance_request_events;
create policy insurance_request_events_rpc_only on public.insurance_request_events
  for all to authenticated using (false) with check (false);

create or replace function public.send_quote_version_and_queue(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_channel text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_quote public.quotes%rowtype;
  v_existing public.notifications%rowtype;
  v_notification public.notifications%rowtype;
begin
  if v_org is null or not public.has_permission('quotes:write') then
    raise exception 'No tiene permiso para enviar cotizaciones.';
  end if;
  if p_channel not in ('WHATSAPP', 'EMAIL')
     or nullif(btrim(coalesce(p_idempotency_key, '')), '') is null
     or length(p_idempotency_key) > 160 then
    raise exception 'Solicitud de envío inválida.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':' || p_idempotency_key, 0));
  select * into v_existing
  from public.notifications
  where organization_id = v_org and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.channel is distinct from p_channel
       or v_existing.template_code is distinct from 'QUOTE_READY'
       or v_existing.related_entity_type is distinct from 'QUOTE_VERSION'
       or v_existing.related_entity_id is distinct from p_quote_version_id then
      raise exception 'La clave de idempotencia ya pertenece a otra operación.';
    end if;
    return jsonb_build_object(
      'quote_id', p_quote_id,
      'quote_version_id', p_quote_version_id,
      'notification_id', v_existing.id,
      'idempotent', true
    );
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and organization_id = v_org;
  if not found then raise exception 'Cotización no disponible.'; end if;

  perform public.send_quote_version(p_quote_id, p_quote_version_id);
  v_notification := public.queue_notification(
    p_channel,
    'QUOTE_READY',
    'PATIENT',
    v_quote.patient_id,
    'QUOTE_VERSION',
    p_quote_version_id,
    p_idempotency_key
  );

  return jsonb_build_object(
    'quote_id', p_quote_id,
    'quote_version_id', p_quote_version_id,
    'notification_id', v_notification.id,
    'idempotent', false
  );
end
$$;

create or replace function public.transition_quote_insurance_status(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_to_status text,
  p_note text,
  p_approved_amount numeric default null,
  p_claim_number text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_quote public.quotes%rowtype;
  v_version public.quote_versions%rowtype;
  v_request public.insurance_requests%rowtype;
  v_existing_event public.insurance_request_events%rowtype;
  v_event public.insurance_request_events%rowtype;
  v_notification public.notifications%rowtype;
  v_insurer_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_claim text := nullif(btrim(coalesce(p_claim_number, '')), '');
begin
  if v_org is null or not public.has_permission('insurance:write') then
    raise exception 'No tiene permiso para actualizar el reclamo.';
  end if;
  if v_note is null
     or nullif(btrim(coalesce(p_idempotency_key, '')), '') is null
     or length(p_idempotency_key) > 160
     or length(coalesce(v_claim, '')) > 120 then
    raise exception 'La transición requiere observación y una clave válida.';
  end if;
  if p_to_status not in ('SENT_TO_INSURER','INSURER_REVIEW','INFO_REQUIRED','PARTIALLY_APPROVED','APPROVED','REJECTED') then
    raise exception 'Estado de seguro no permitido.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':' || p_idempotency_key, 0));
  select * into v_existing_event
  from public.insurance_request_events
  where organization_id = v_org and idempotency_key = p_idempotency_key;
  if found then
    select * into v_request from public.insurance_requests
    where id = v_existing_event.insurance_request_id and organization_id = v_org;
    if v_request.id is null
       or v_request.quote_id is distinct from p_quote_id
       or v_existing_event.status is distinct from p_to_status
       or v_existing_event.note is distinct from v_note
       or v_existing_event.metadata->>'quote_version_id' is distinct from p_quote_version_id::text
       or v_existing_event.metadata->>'claim_number' is distinct from v_claim
       or nullif(v_existing_event.metadata->>'approved_amount', '')::numeric is distinct from p_approved_amount then
      raise exception 'La clave de idempotencia ya pertenece a otra operación.';
    end if;
    return jsonb_build_object(
      'quote_id', p_quote_id,
      'quote_version_id', p_quote_version_id,
      'insurance_request_id', v_request.id,
      'insurance_event_id', v_existing_event.id,
      'idempotent', true
    );
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and organization_id = v_org
  for update;
  if not found then raise exception 'Cotización no disponible.'; end if;

  select * into v_version
  from public.quote_versions
  where id = p_quote_version_id
    and quote_id = p_quote_id
    and organization_id = v_org;
  if not found or v_version.version <> v_quote.current_version then
    raise exception 'Versión vigente no disponible.';
  end if;
  if not public.quote_transition_allowed(v_quote.status, p_to_status) then
    raise exception 'Transición de estado no permitida: % a %.', v_quote.status, p_to_status;
  end if;
  if p_approved_amount is not null
     and (p_approved_amount < 0 or p_approved_amount > v_version.total) then
    raise exception 'Monto aprobado fuera de rango.';
  end if;

  select h.insurer_id into v_insurer_id
  from public.hospitalizations h
  where h.id = v_quote.hospitalization_id and h.organization_id = v_org;
  if v_insurer_id is null then
    raise exception 'La hospitalización no tiene aseguradora configurada.';
  end if;

  select * into v_request
  from public.insurance_requests
  where quote_id = p_quote_id and organization_id = v_org
  for update;
  if found then
    update public.insurance_requests
    set status = p_to_status,
        approved_amount = coalesce(p_approved_amount, approved_amount),
        claim_number = coalesce(v_claim, claim_number),
        last_note = v_note,
        updated_at = now()
    where id = v_request.id
    returning * into v_request;
  else
    insert into public.insurance_requests (
      organization_id, quote_id, insurer_id, status, claim_number,
      requested_amount, approved_amount, submitted_at, last_note, created_by
    ) values (
      v_org, p_quote_id, v_insurer_id, p_to_status, v_claim,
      v_version.total, coalesce(p_approved_amount, 0), now(), v_note, auth.uid()
    ) returning * into v_request;
  end if;

  insert into public.insurance_request_events (
    organization_id, insurance_request_id, status, note, created_by, idempotency_key, metadata
  ) values (
    v_org, v_request.id, p_to_status, v_note, auth.uid(), p_idempotency_key,
    jsonb_build_object(
      'quote_version_id', p_quote_version_id,
      'claim_number', v_claim,
      'approved_amount', p_approved_amount
    )
  ) returning * into v_event;

  update public.quotes
  set status = p_to_status, updated_at = now()
  where id = p_quote_id;

  insert into public.quote_status_events (
    organization_id, quote_id, from_status, to_status, note, metadata, created_by
  ) values (
    v_org, p_quote_id, v_quote.status, p_to_status, v_note,
    jsonb_build_object(
      'quote_version_id', p_quote_version_id,
      'insurance_request_id', v_request.id,
      'insurance_event_id', v_event.id,
      'idempotency_key', p_idempotency_key
    ), auth.uid()
  );

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_org, auth.uid(), 'TRANSITION_QUOTE_INSURANCE_STATUS', 'insurance_request', v_request.id::text,
    'Transición de seguro y reclamo auditada.',
    jsonb_build_object(
      'quote_id', p_quote_id,
      'quote_version_id', p_quote_version_id,
      'from_status', v_quote.status,
      'to_status', p_to_status,
      'insurance_event_id', v_event.id,
      'idempotency_key', p_idempotency_key
    )
  );

  v_notification := public.queue_notification(
    'WHATSAPP',
    'QUOTE_STATUS',
    'PATIENT',
    v_quote.patient_id,
    'QUOTE',
    p_quote_id,
    'NOT:QUOTE_STATUS:' || p_idempotency_key
  );

  return jsonb_build_object(
    'quote_id', p_quote_id,
    'quote_version_id', p_quote_version_id,
    'insurance_request_id', v_request.id,
    'insurance_event_id', v_event.id,
    'notification_id', v_notification.id,
    'idempotent', false
  );
end
$$;

revoke all on function public.send_quote_version_and_queue(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.send_quote_version_and_queue(uuid,uuid,text,text) to authenticated;
revoke all on function public.transition_quote_insurance_status(uuid,uuid,text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.transition_quote_insurance_status(uuid,uuid,text,text,numeric,text,text) to authenticated;
