-- Seguridad, RLS, funciones y controles de integridad

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.organization_id = public.current_organization_id()
      and rp.permission_code = p_permission
  )
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create or replace function public.bootstrap_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_org uuid;
begin
  requested_org := nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid;
  insert into public.profiles (id, organization_id, full_name, status)
  values (
    new.id,
    requested_org,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, ''),
    case when requested_org is null then 'INVITED' else 'ACTIVE' end
  )
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.bootstrap_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations','branches','profiles','insurers','insurance_plans','patients',
    'patient_contacts','patient_addresses','patient_insurances','doctors',
    'hospitalizations','hospitalization_status_events','files','hospitalization_documents',
    'catalog_items','price_lists','price_list_items','discount_rules','quotes',
    'quote_versions','quote_items','quote_status_events','insurance_requests',
    'insurance_request_events','payments','financial_adjustments','document_templates',
    'clinical_documents','vital_signs','medication_cards','medication_card_items',
    'medication_administrations','nursing_notes','shifts','suppliers','purchases',
    'purchase_items','warehouses','inventory_items','inventory_lots','inventory_movements',
    'inventory_reservations','inventory_closures','inventory_closure_items','supply_kits',
    'doctor_services','doctor_statements','notifications','patient_portal_links',
    'patient_portal_access_logs','audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- Organization and profile access
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
for select using (id = public.current_organization_id());

drop policy if exists profiles_select_same_org on public.profiles;
create policy profiles_select_same_org on public.profiles
for select using (organization_id = public.current_organization_id());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid() and organization_id = public.current_organization_id());

-- Generic policies for organization-scoped tables.
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
    'notifications','patient_portal_links','patient_portal_access_logs','audit_logs'
  ]
  loop
    execute format('drop policy if exists %I_org_select on public.%I', table_name, table_name);
    execute format(
      'create policy %I_org_select on public.%I for select using (organization_id = public.current_organization_id())',
      table_name, table_name
    );
  end loop;
end $$;

-- Write policies by permission and module.
drop policy if exists patients_write on public.patients;
create policy patients_write on public.patients for all
using (organization_id = public.current_organization_id() and public.has_permission('patients:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('patients:write'));

drop policy if exists patient_contacts_write on public.patient_contacts;
create policy patient_contacts_write on public.patient_contacts for all
using (organization_id = public.current_organization_id() and public.has_permission('patients:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('patients:write'));

drop policy if exists patient_addresses_write on public.patient_addresses;
create policy patient_addresses_write on public.patient_addresses for all
using (organization_id = public.current_organization_id() and public.has_permission('patients:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('patients:write'));

drop policy if exists patient_insurances_write on public.patient_insurances;
create policy patient_insurances_write on public.patient_insurances for all
using (organization_id = public.current_organization_id() and public.has_permission('patients:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('patients:write'));

drop policy if exists hospitalizations_write on public.hospitalizations;
create policy hospitalizations_write on public.hospitalizations for all
using (organization_id = public.current_organization_id() and public.has_permission('cases:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('cases:write'));

drop policy if exists hospitalization_events_write on public.hospitalization_status_events;
create policy hospitalization_events_write on public.hospitalization_status_events for insert
with check (organization_id = public.current_organization_id() and public.has_permission('cases:write'));

drop policy if exists catalog_items_write on public.catalog_items;
create policy catalog_items_write on public.catalog_items for all
using (organization_id = public.current_organization_id() and public.has_permission('catalogs:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('catalogs:write'));

drop policy if exists price_lists_write on public.price_lists;
create policy price_lists_write on public.price_lists for all
using (organization_id = public.current_organization_id() and public.has_permission('catalogs:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('catalogs:write'));

drop policy if exists price_items_write on public.price_list_items;
create policy price_items_write on public.price_list_items for all
using (organization_id = public.current_organization_id() and public.has_permission('catalogs:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('catalogs:write'));

drop policy if exists discounts_write on public.discount_rules;
create policy discounts_write on public.discount_rules for all
using (organization_id = public.current_organization_id() and public.has_permission('catalogs:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('catalogs:write'));

drop policy if exists quotes_write on public.quotes;
create policy quotes_write on public.quotes for all
using (organization_id = public.current_organization_id() and public.has_permission('quotes:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('quotes:write'));

drop policy if exists quote_versions_write on public.quote_versions;
create policy quote_versions_write on public.quote_versions for insert
with check (organization_id = public.current_organization_id() and public.has_permission('quotes:write'));

drop policy if exists quote_items_write on public.quote_items;
create policy quote_items_write on public.quote_items for insert
with check (organization_id = public.current_organization_id() and public.has_permission('quotes:write'));

drop policy if exists quote_events_write on public.quote_status_events;
create policy quote_events_write on public.quote_status_events for insert
with check (organization_id = public.current_organization_id() and (public.has_permission('quotes:write') or public.has_permission('insurance:write')));

drop policy if exists insurance_requests_write on public.insurance_requests;
create policy insurance_requests_write on public.insurance_requests for all
using (organization_id = public.current_organization_id() and public.has_permission('insurance:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('insurance:write'));

drop policy if exists insurance_events_write on public.insurance_request_events;
create policy insurance_events_write on public.insurance_request_events for insert
with check (organization_id = public.current_organization_id() and public.has_permission('insurance:write'));

drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for insert
with check (organization_id = public.current_organization_id() and public.has_permission('payments:write'));

drop policy if exists financial_adjustments_write on public.financial_adjustments;
create policy financial_adjustments_write on public.financial_adjustments for all
using (organization_id = public.current_organization_id() and public.has_permission('payments:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('payments:write'));

drop policy if exists clinical_documents_write on public.clinical_documents;
create policy clinical_documents_write on public.clinical_documents for all
using (organization_id = public.current_organization_id() and public.has_permission('clinical:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write'));

drop policy if exists vital_signs_write on public.vital_signs;
create policy vital_signs_write on public.vital_signs for insert
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write'));

drop policy if exists medication_cards_write on public.medication_cards;
create policy medication_cards_write on public.medication_cards for all
using (organization_id = public.current_organization_id() and public.has_permission('clinical:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write'));

drop policy if exists medication_card_items_write on public.medication_card_items;
create policy medication_card_items_write on public.medication_card_items for all
using (organization_id = public.current_organization_id() and public.has_permission('clinical:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write'));

drop policy if exists medication_administrations_write on public.medication_administrations;
create policy medication_administrations_write on public.medication_administrations for insert
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write'));

drop policy if exists nursing_notes_write on public.nursing_notes;
create policy nursing_notes_write on public.nursing_notes for all
using (organization_id = public.current_organization_id() and public.has_permission('clinical:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write'));

drop policy if exists shifts_write on public.shifts;
create policy shifts_write on public.shifts for all
using (organization_id = public.current_organization_id() and public.has_permission('agenda:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('agenda:write'));

drop policy if exists purchases_write on public.purchases;
create policy purchases_write on public.purchases for all
using (organization_id = public.current_organization_id() and public.has_permission('purchases:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('purchases:write'));

drop policy if exists purchase_items_write on public.purchase_items;
create policy purchase_items_write on public.purchase_items for all
using (organization_id = public.current_organization_id() and public.has_permission('purchases:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('purchases:write'));

drop policy if exists inventory_items_write on public.inventory_items;
create policy inventory_items_write on public.inventory_items for all
using (organization_id = public.current_organization_id() and public.has_permission('inventory:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('inventory:write'));

drop policy if exists inventory_lots_write on public.inventory_lots;
create policy inventory_lots_write on public.inventory_lots for all
using (organization_id = public.current_organization_id() and public.has_permission('inventory:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('inventory:write'));

drop policy if exists inventory_movements_write on public.inventory_movements;
create policy inventory_movements_write on public.inventory_movements for insert
with check (organization_id = public.current_organization_id() and public.has_permission('inventory:write'));

drop policy if exists inventory_reservations_write on public.inventory_reservations;
create policy inventory_reservations_write on public.inventory_reservations for all
using (organization_id = public.current_organization_id() and public.has_permission('inventory:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('inventory:write'));

drop policy if exists inventory_closures_write on public.inventory_closures;
create policy inventory_closures_write on public.inventory_closures for all
using (organization_id = public.current_organization_id() and public.has_permission('inventory:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('inventory:write'));

drop policy if exists supply_kits_write on public.supply_kits;
create policy supply_kits_write on public.supply_kits for all
using (organization_id = public.current_organization_id() and public.has_permission('inventory:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('inventory:write'));

drop policy if exists doctor_services_write on public.doctor_services;
create policy doctor_services_write on public.doctor_services for all
using (organization_id = public.current_organization_id() and public.has_permission('statements:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('statements:write'));

drop policy if exists doctor_statements_write on public.doctor_statements;
create policy doctor_statements_write on public.doctor_statements for all
using (organization_id = public.current_organization_id() and public.has_permission('statements:write'))
with check (organization_id = public.current_organization_id() and public.has_permission('statements:write'));

drop policy if exists notifications_write on public.notifications;
create policy notifications_write on public.notifications for insert
with check (organization_id = public.current_organization_id() and (public.has_permission('quotes:write') or public.has_permission('insurance:write') or public.has_permission('statements:write')));

-- Append-only audit log. No update/delete policy is intentionally defined.
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert
with check (organization_id = public.current_organization_id());

-- Prevent editing immutable quote versions.
create or replace function public.prevent_immutable_quote_version_change()
returns trigger language plpgsql as $$
begin
  if old.immutable then
    raise exception 'La versión enviada es inmutable. Cree una nueva versión.';
  end if;
  return new;
end
$$;
drop trigger if exists protect_quote_versions on public.quote_versions;
create trigger protect_quote_versions
before update or delete on public.quote_versions
for each row execute function public.prevent_immutable_quote_version_change();

-- Signed clinical records cannot be changed unless the user has explicit correction permission.
create or replace function public.protect_signed_clinical_document()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'SIGNED' and not public.has_permission('clinical:correct_signed') then
    raise exception 'Documento firmado: corrección auditada requerida.';
  end if;
  if old.status = 'SIGNED' and new.status = 'SIGNED' then
    new.version = old.version + 1;
  end if;
  return new;
end
$$;
drop trigger if exists protect_signed_clinical_documents on public.clinical_documents;
create trigger protect_signed_clinical_documents
before update or delete on public.clinical_documents
for each row execute function public.protect_signed_clinical_document();

create or replace function public.protect_signed_nursing_note()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'SIGNED' and not public.has_permission('clinical:correct_signed') then
    raise exception 'Nota firmada: corrección auditada requerida.';
  end if;
  return new;
end
$$;
drop trigger if exists protect_signed_nursing_notes on public.nursing_notes;
create trigger protect_signed_nursing_notes
before update or delete on public.nursing_notes
for each row execute function public.protect_signed_nursing_note();

-- Atomic inventory movement with row locking.
create or replace function public.apply_inventory_movement(
  p_inventory_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_hospitalization_id uuid default null,
  p_warehouse_to_id uuid default null,
  p_reference text default null,
  p_note text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.inventory_items%rowtype;
  movement_id uuid;
  key_value text := coalesce(p_idempotency_key, gen_random_uuid()::text);
begin
  if not public.has_permission('inventory:write') then
    raise exception 'Permiso insuficiente';
  end if;
  if p_quantity <= 0 then raise exception 'Cantidad inválida'; end if;

  select * into target
  from public.inventory_items
  where id = p_inventory_item_id
    and organization_id = public.current_organization_id()
  for update;

  if not found then raise exception 'Ítem no encontrado'; end if;

  if p_movement_type in ('PURCHASE_ENTRY','POSITIVE_ADJUSTMENT','RETURN_TO_STOCK') then
    update public.inventory_items set stock = stock + p_quantity where id = target.id;
  elsif p_movement_type = 'PATIENT_COMMITMENT' then
    if target.stock - target.committed < p_quantity then raise exception 'Stock libre insuficiente'; end if;
    update public.inventory_items set committed = committed + p_quantity where id = target.id;
  elsif p_movement_type = 'PATIENT_CONSUMPTION' then
    if target.committed < p_quantity then raise exception 'Consumo superior a lo comprometido'; end if;
    update public.inventory_items set committed = committed - p_quantity, stock = stock - p_quantity where id = target.id;
  elsif p_movement_type in ('NEGATIVE_ADJUSTMENT','EXPIRY_DISPOSAL') then
    if target.stock - target.committed < p_quantity then raise exception 'Stock libre insuficiente'; end if;
    update public.inventory_items set stock = stock - p_quantity where id = target.id;
  elsif p_movement_type = 'TRANSFER' then
    if p_warehouse_to_id is null then raise exception 'Bodega destino requerida'; end if;
    -- El traslado entre registros de bodega debe completarse en una segunda fase transaccional.
  else
    raise exception 'Tipo de movimiento no permitido';
  end if;

  insert into public.inventory_movements (
    organization_id, inventory_item_id, hospitalization_id, movement_type, quantity,
    warehouse_from_id, warehouse_to_id, reference, note, idempotency_key, created_by
  ) values (
    public.current_organization_id(), target.id, p_hospitalization_id, p_movement_type, p_quantity,
    target.warehouse_id, p_warehouse_to_id, p_reference, p_note, key_value, auth.uid()
  )
  returning id into movement_id;

  return movement_id;
exception
  when unique_violation then
    select id into movement_id
    from public.inventory_movements
    where organization_id = public.current_organization_id() and idempotency_key = key_value;
    return movement_id;
end
$$;

-- Secure portal snapshot. The API must pass hashes, never raw clinical data.
create or replace function public.portal_quote_snapshot(
  p_token text,
  p_document text,
  p_verification_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  portal public.patient_portal_links%rowtype;
  result jsonb;
begin
  select * into portal
  from public.patient_portal_links
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found or portal.failed_attempts >= portal.max_attempts then
    raise exception 'No fue posible validar el acceso';
  end if;

  if portal.verification_code_hash is not null
     and portal.verification_code_hash <> encode(digest(p_verification_code, 'sha256'), 'hex') then
    update public.patient_portal_links set failed_attempts = failed_attempts + 1 where id = portal.id;
    raise exception 'No fue posible validar el acceso';
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = portal.patient_id
      and regexp_replace(p.document_number, '\s', '', 'g') = regexp_replace(p_document, '\s', '', 'g')
  ) then
    update public.patient_portal_links set failed_attempts = failed_attempts + 1 where id = portal.id;
    raise exception 'No fue posible validar el acceso';
  end if;

  update public.patient_portal_links
  set failed_attempts = 0, last_access_at = now()
  where id = portal.id;

  select jsonb_build_object(
    'quote_id', q.code,
    'status', q.status,
    'total', q.total,
    'insurer_amount', q.insurer_amount,
    'patient_amount', q.patient_amount,
    'paid', coalesce((select sum(amount) from public.payments where quote_id = q.id and status = 'APPLIED'),0),
    'balance', greatest(0, q.patient_amount - coalesce((select sum(amount) from public.payments where quote_id = q.id and status = 'APPLIED'),0)),
    'updated_at', q.updated_at,
    'events', coalesce((select jsonb_agg(jsonb_build_object('status',e.to_status,'note',e.note,'date',e.created_at) order by e.created_at) from public.quote_status_events e where e.quote_id=q.id),'[]'::jsonb)
  ) into result
  from public.quotes q
  where q.id = portal.quote_id;

  insert into public.patient_portal_access_logs (organization_id, portal_link_id, success, reason)
  values (portal.organization_id, portal.id, true, 'verified');

  return result;
end
$$;

create or replace function public.claim_notification_retries(p_limit integer default 25)
returns setof public.notifications
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set status = 'RETRYING', attempts = attempts + 1, updated_at = now()
  where id in (
    select id
    from public.notifications
    where status in ('FAILED','QUEUED')
      and (next_retry_at is null or next_retry_at <= now())
      and attempts < 5
    order by created_at
    for update skip locked
    limit greatest(1, least(p_limit,100))
  )
  returning *
$$;

-- Updated-at triggers
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations','profiles','insurers','patients','doctors','hospitalizations',
    'catalog_items','quotes','insurance_requests','clinical_documents','purchases',
    'inventory_items','inventory_reservations','notifications'
  ]
  loop
    execute format('drop trigger if exists %I_touch on public.%I', table_name, table_name);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;
