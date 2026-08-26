-- P0 lot 2: immutable sent quote versions and append-only signed clinical records.
-- The metadata-only signature is intentionally not a legal/certified signature.

alter table public.quote_versions
  add column if not exists previous_version_id uuid references public.quote_versions(id) on delete restrict,
  add column if not exists revision_reason text,
  add column if not exists sent_at timestamptz,
  add column if not exists sent_by uuid references auth.users(id) on delete set null,
  add column if not exists snapshot jsonb not null default '{}'::jsonb;

alter table public.clinical_documents
  add column if not exists signature_metadata jsonb not null default '{}'::jsonb,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists voided_at timestamptz;

alter table public.nursing_notes
  add column if not exists signature_metadata jsonb not null default '{}'::jsonb,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists voided_at timestamptz;

alter table public.medication_cards
  add column if not exists document_status text not null default 'DRAFT' check (document_status in ('DRAFT','SIGNED','VOIDED')),
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists signed_by uuid references auth.users(id) on delete set null,
  add column if not exists signed_at timestamptz,
  add column if not exists signature_metadata jsonb not null default '{}'::jsonb,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists voided_at timestamptz;

create table if not exists public.clinical_record_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  subject_type text not null check (subject_type in ('CLINICAL_DOCUMENT','NURSING_NOTE','MEDICATION_CARD')),
  clinical_document_id uuid references public.clinical_documents(id) on delete restrict,
  nursing_note_id uuid references public.nursing_notes(id) on delete restrict,
  medication_card_id uuid references public.medication_cards(id) on delete restrict,
  previous_correction_id uuid references public.clinical_record_corrections(id) on delete restrict,
  correction_kind text not null check (correction_kind in ('AMENDMENT','ADDENDUM','ERRATA')),
  reason text not null check (length(btrim(reason)) > 0),
  content jsonb not null default '{}'::jsonb,
  author_id uuid references auth.users(id) on delete set null,
  author_role text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(clinical_document_id, nursing_note_id, medication_card_id) = 1),
  check (
    (subject_type = 'CLINICAL_DOCUMENT' and clinical_document_id is not null)
    or (subject_type = 'NURSING_NOTE' and nursing_note_id is not null)
    or (subject_type = 'MEDICATION_CARD' and medication_card_id is not null)
  )
);

create index if not exists quote_versions_parent_version_idx
  on public.quote_versions (quote_id, version desc);
create index if not exists quote_versions_previous_idx
  on public.quote_versions (previous_version_id) where previous_version_id is not null;
create index if not exists clinical_record_corrections_subject_idx
  on public.clinical_record_corrections (organization_id, subject_type, clinical_document_id, nursing_note_id, medication_card_id, created_at);

alter table public.clinical_record_corrections enable row level security;
drop policy if exists clinical_record_corrections_select on public.clinical_record_corrections;
create policy clinical_record_corrections_select on public.clinical_record_corrections
for select using (organization_id = public.current_organization_id());

-- Direct writes are permitted only while a quote is a true editable draft.
drop policy if exists quotes_write on public.quotes;
drop policy if exists quotes_insert_draft on public.quotes;
create policy quotes_insert_draft on public.quotes for insert
with check (organization_id = public.current_organization_id() and public.has_permission('quotes:write'));

drop policy if exists quotes_update_draft on public.quotes;
create policy quotes_update_draft on public.quotes for update
using (
  organization_id = public.current_organization_id()
  and public.has_permission('quotes:write')
  and sent_at is null
  and status in ('DRAFT','READY_TO_SEND')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('quotes:write')
  and sent_at is null
  and status in ('DRAFT','READY_TO_SEND')
);

drop policy if exists quote_versions_write on public.quote_versions;
drop policy if exists quote_versions_insert_draft on public.quote_versions;
create policy quote_versions_insert_draft on public.quote_versions for insert
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('quotes:write')
  and immutable = false
  and status_snapshot in ('DRAFT','READY_TO_SEND')
);

drop policy if exists quote_versions_update_draft on public.quote_versions;
create policy quote_versions_update_draft on public.quote_versions for update
using (
  organization_id = public.current_organization_id()
  and public.has_permission('quotes:write')
  and immutable = false
  and status_snapshot in ('DRAFT','READY_TO_SEND')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('quotes:write')
  and immutable = false
  and status_snapshot in ('DRAFT','READY_TO_SEND')
);

drop policy if exists quote_items_write on public.quote_items;
drop policy if exists quote_items_insert_draft on public.quote_items;
create policy quote_items_insert_draft on public.quote_items for insert
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('quotes:write')
  and exists (
    select 1 from public.quote_versions qv
    where qv.id = quote_version_id
      and qv.organization_id = public.current_organization_id()
      and qv.immutable = false
      and qv.status_snapshot in ('DRAFT','READY_TO_SEND')
  )
);

drop policy if exists quote_items_update_draft on public.quote_items;
create policy quote_items_update_draft on public.quote_items for update
using (
  organization_id = public.current_organization_id()
  and public.has_permission('quotes:write')
  and exists (
    select 1 from public.quote_versions qv
    where qv.id = quote_version_id
      and qv.organization_id = public.current_organization_id()
      and qv.immutable = false
      and qv.status_snapshot in ('DRAFT','READY_TO_SEND')
  )
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('quotes:write')
  and exists (
    select 1 from public.quote_versions qv
    where qv.id = quote_version_id
      and qv.organization_id = public.current_organization_id()
      and qv.immutable = false
      and qv.status_snapshot in ('DRAFT','READY_TO_SEND')
  )
);

drop policy if exists quote_items_delete_draft on public.quote_items;
create policy quote_items_delete_draft on public.quote_items for delete
using (
  organization_id = public.current_organization_id()
  and public.has_permission('quotes:write')
  and exists (
    select 1 from public.quote_versions qv
    where qv.id = quote_version_id
      and qv.organization_id = public.current_organization_id()
      and qv.immutable = false
      and qv.status_snapshot in ('DRAFT','READY_TO_SEND')
  )
);

create or replace function public.prevent_immutable_quote_version_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' and old.immutable then
    raise exception 'La versión enviada es inmutable y no puede eliminarse.';
  end if;
  if tg_op = 'UPDATE' and old.immutable then
    raise exception 'La versión enviada es inmutable. Cree una nueva versión.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create or replace function public.prevent_immutable_quote_item_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_immutable boolean;
  v_version_id uuid;
begin
  v_version_id := case when tg_op = 'DELETE' then old.quote_version_id else new.quote_version_id end;
  select immutable into v_immutable from public.quote_versions where id = v_version_id;
  if coalesce(v_immutable, false) then
    raise exception 'Los ítems de una versión enviada son inmutables.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists protect_quote_items on public.quote_items;
create trigger protect_quote_items
before insert or update or delete on public.quote_items
for each row execute function public.prevent_immutable_quote_item_change();

create or replace function public.prevent_sent_quote_financial_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.sent_at is not null and (
    new.hospitalization_id is distinct from old.hospitalization_id
    or new.patient_id is distinct from old.patient_id
    or new.currency is distinct from old.currency
    or new.subtotal is distinct from old.subtotal
    or new.discount_amount is distinct from old.discount_amount
    or new.total is distinct from old.total
    or new.insurer_amount is distinct from old.insurer_amount
    or new.patient_amount is distinct from old.patient_amount
    or new.comments is distinct from old.comments
  ) then
    raise exception 'La cotización enviada conserva importes y datos históricos. Cree una nueva versión.';
  end if;
  return new;
end
$$;

drop trigger if exists protect_sent_quote_financial_fields on public.quotes;
create trigger protect_sent_quote_financial_fields
before update on public.quotes
for each row execute function public.prevent_sent_quote_financial_change();

create or replace function public.quote_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when p_from = p_to then false
    when p_from in ('CLOSED','CANCELLED') then false
    when p_to in ('REJECTED','CANCELLED') then true
    when p_from = 'DRAFT' then p_to in ('READY_TO_SEND')
    when p_from = 'READY_TO_SEND' then p_to in ('SENT_TO_PATIENT')
    when p_from = 'SENT_TO_PATIENT' then p_to in ('SENT_TO_INSURER','PATIENT_PAYMENT')
    when p_from = 'SENT_TO_INSURER' then p_to in ('INSURER_REVIEW')
    when p_from = 'INSURER_REVIEW' then p_to in ('INFO_REQUIRED','PARTIALLY_APPROVED','APPROVED')
    when p_from = 'INFO_REQUIRED' then p_to in ('INSURER_REVIEW','PARTIALLY_APPROVED','APPROVED')
    when p_from = 'PARTIALLY_APPROVED' then p_to in ('APPROVED','PATIENT_PAYMENT')
    when p_from = 'APPROVED' then p_to in ('PATIENT_PAYMENT','SERVICE_SCHEDULED')
    when p_from = 'PATIENT_PAYMENT' then p_to in ('SERVICE_SCHEDULED')
    when p_from = 'SERVICE_SCHEDULED' then p_to in ('CLOSED')
    else false
  end
$$;

create or replace function public.audit_quote_version_creation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (
    new.organization_id, auth.uid(), 'CREATE_QUOTE_VERSION', 'quote_version', new.id::text,
    'Versión de cotización creada.',
    jsonb_build_object('quote_id', new.quote_id, 'version', new.version, 'previous_version_id', new.previous_version_id, 'revision_reason', new.revision_reason)
  );
  return new;
end
$$;

drop trigger if exists audit_quote_version_creation on public.quote_versions;
create trigger audit_quote_version_creation
after insert on public.quote_versions
for each row execute function public.audit_quote_version_creation();

create or replace function public.audit_quote_draft_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not old.immutable and not new.immutable then
    insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
    values (
      new.organization_id, auth.uid(), 'UPDATE_QUOTE_DRAFT', 'quote_version', new.id::text,
      'Borrador de cotización actualizado.',
      jsonb_build_object('quote_id', new.quote_id, 'version', new.version)
    );
  end if;
  return new;
end
$$;

drop trigger if exists audit_quote_draft_update on public.quote_versions;
create trigger audit_quote_draft_update
after update on public.quote_versions
for each row execute function public.audit_quote_draft_update();

create or replace function public.create_quote_revision(
  p_quote_id uuid,
  p_source_version_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_quote public.quotes%rowtype;
  v_source public.quote_versions%rowtype;
  v_version integer;
  v_new_version_id uuid;
begin
  if not public.has_permission('quotes:write') then
    raise exception 'No tiene permiso para versionar cotizaciones.';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'El motivo de la nueva versión es obligatorio.';
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and organization_id = v_organization_id
  for update;
  if not found then raise exception 'Cotización no disponible.'; end if;

  select * into v_source
  from public.quote_versions
  where id = p_source_version_id
    and quote_id = p_quote_id
    and organization_id = v_organization_id;
  if not found then raise exception 'Versión origen no disponible.'; end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.quote_versions
  where quote_id = p_quote_id;

  insert into public.quote_versions (
    organization_id, quote_id, previous_version_id, version, status_snapshot,
    subtotal, discount_amount, total, insurer_amount, patient_amount,
    discount_snapshot, comments, immutable, revision_reason, snapshot, created_by
  ) values (
    v_organization_id, p_quote_id, v_source.id, v_version, 'DRAFT',
    v_source.subtotal, v_source.discount_amount, v_source.total, v_source.insurer_amount, v_source.patient_amount,
    v_source.discount_snapshot, v_source.comments, false, btrim(p_reason), v_source.snapshot, auth.uid()
  ) returning id into v_new_version_id;

  insert into public.quote_items (
    organization_id, quote_version_id, catalog_item_id, category, description,
    quantity, unit_price, discount_amount
  ) select
    v_organization_id, v_new_version_id, catalog_item_id, category, description,
    quantity, unit_price, discount_amount
  from public.quote_items
  where quote_version_id = v_source.id;

  update public.quotes
  set current_version = v_version, status = 'DRAFT', sent_at = null, updated_at = now()
  where id = p_quote_id;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (
    v_organization_id, auth.uid(), 'CREATE_QUOTE_REVISION', 'quote_version', v_new_version_id::text,
    'Nueva versión de cotización creada sin sobrescribir la versión anterior.',
    jsonb_build_object('quote_id', p_quote_id, 'previous_version_id', v_source.id, 'version', v_version, 'reason', btrim(p_reason))
  );
  return v_new_version_id;
end
$$;

create or replace function public.send_quote_version(
  p_quote_id uuid,
  p_quote_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_quote public.quotes%rowtype;
  v_version public.quote_versions%rowtype;
  v_subtotal numeric(14,2);
  v_total numeric(14,2);
begin
  if not public.has_permission('quotes:write') then
    raise exception 'No tiene permiso para enviar cotizaciones.';
  end if;
  select * into v_quote from public.quotes
  where id = p_quote_id and organization_id = v_organization_id for update;
  if not found then raise exception 'Cotización no disponible.'; end if;
  select * into v_version from public.quote_versions
  where id = p_quote_version_id and quote_id = p_quote_id and organization_id = v_organization_id for update;
  if not found then raise exception 'Versión no disponible.'; end if;
  if v_version.immutable or v_version.status_snapshot not in ('DRAFT','READY_TO_SEND') then
    raise exception 'Sólo se puede enviar una versión editable.';
  end if;
  if v_version.version <> v_quote.current_version or v_quote.status not in ('DRAFT','READY_TO_SEND') then
    raise exception 'La versión no es la versión vigente editable.';
  end if;
  select coalesce(sum(line_total), 0)::numeric(14,2) into v_subtotal
  from public.quote_items where quote_version_id = v_version.id;
  v_total := round(v_subtotal - v_version.discount_amount, 2);
  if v_version.discount_amount < 0
    or v_version.discount_amount > v_subtotal
    or v_version.subtotal <> v_subtotal
    or v_version.total <> v_total
    or v_version.insurer_amount < 0
    or v_version.insurer_amount > v_total
    or v_version.patient_amount <> round(v_total - v_version.insurer_amount, 2) then
    raise exception 'Los totales de la versión no coinciden con sus ítems. Actualice el borrador antes de enviarlo.';
  end if;

  update public.quote_versions
  set immutable = true, status_snapshot = 'SENT_TO_PATIENT', sent_at = now(), sent_by = auth.uid(),
      snapshot = jsonb_build_object(
        'version', v_version.version, 'status', 'SENT_TO_PATIENT', 'subtotal', v_version.subtotal,
        'discount_amount', v_version.discount_amount, 'total', v_version.total,
        'insurer_amount', v_version.insurer_amount, 'patient_amount', v_version.patient_amount,
        'discount', v_version.discount_snapshot, 'comments', v_version.comments
      )
  where id = v_version.id;

  update public.quotes set status = 'SENT_TO_PATIENT', sent_at = now(), updated_at = now() where id = v_quote.id;
  insert into public.quote_status_events (organization_id, quote_id, from_status, to_status, note, metadata, created_by)
  values (v_organization_id, v_quote.id, v_quote.status, 'SENT_TO_PATIENT', 'Versión enviada y bloqueada.', jsonb_build_object('quote_version_id', v_version.id), auth.uid());
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_organization_id, auth.uid(), 'SEND_QUOTE_VERSION', 'quote_version', v_version.id::text, 'Versión de cotización enviada y marcada inmutable.', jsonb_build_object('quote_id', v_quote.id, 'version', v_version.version));
end
$$;

create or replace function public.transition_quote_status(
  p_quote_id uuid,
  p_to_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_quote public.quotes%rowtype;
  v_requires_insurance boolean := p_to_status in ('SENT_TO_INSURER','INSURER_REVIEW','INFO_REQUIRED','PARTIALLY_APPROVED','APPROVED','REJECTED');
begin
  if (v_requires_insurance and not public.has_permission('insurance:write'))
    or (not v_requires_insurance and not public.has_permission('quotes:write')) then
    raise exception 'No tiene permiso para esta transición de cotización.';
  end if;
  select * into v_quote from public.quotes
  where id = p_quote_id and organization_id = v_organization_id for update;
  if not found then raise exception 'Cotización no disponible.'; end if;
  if not public.quote_transition_allowed(v_quote.status, p_to_status) then
    raise exception 'Transición de estado no permitida: % a %.', v_quote.status, p_to_status;
  end if;
  update public.quotes set status = p_to_status, updated_at = now() where id = v_quote.id;
  insert into public.quote_status_events (organization_id, quote_id, from_status, to_status, note, created_by)
  values (v_organization_id, v_quote.id, v_quote.status, p_to_status, nullif(btrim(p_note), ''), auth.uid());
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_organization_id, auth.uid(), 'TRANSITION_QUOTE_STATUS', 'quote', v_quote.id::text, 'Transición de estado de cotización auditada.', jsonb_build_object('from_status', v_quote.status, 'to_status', p_to_status, 'note', p_note));
end
$$;

-- Clinical direct updates are limited to drafts; signing, correction and voiding use audited RPCs.
drop policy if exists clinical_documents_write on public.clinical_documents;
drop policy if exists clinical_documents_insert_draft on public.clinical_documents;
create policy clinical_documents_insert_draft on public.clinical_documents for insert
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and status = 'DRAFT');
drop policy if exists clinical_documents_update_draft on public.clinical_documents;
create policy clinical_documents_update_draft on public.clinical_documents for update
using (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and status = 'DRAFT')
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and status = 'DRAFT');
drop policy if exists clinical_documents_delete_draft on public.clinical_documents;
create policy clinical_documents_delete_draft on public.clinical_documents for delete
using (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and status = 'DRAFT');

drop policy if exists nursing_notes_write on public.nursing_notes;
drop policy if exists nursing_notes_insert_draft on public.nursing_notes;
create policy nursing_notes_insert_draft on public.nursing_notes for insert
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and status = 'DRAFT');
drop policy if exists nursing_notes_update_draft on public.nursing_notes;
create policy nursing_notes_update_draft on public.nursing_notes for update
using (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and status = 'DRAFT')
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and status = 'DRAFT');
drop policy if exists nursing_notes_delete_draft on public.nursing_notes;
create policy nursing_notes_delete_draft on public.nursing_notes for delete
using (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and status = 'DRAFT');

drop policy if exists medication_cards_write on public.medication_cards;
drop policy if exists medication_cards_insert_draft on public.medication_cards;
create policy medication_cards_insert_draft on public.medication_cards for insert
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and document_status = 'DRAFT');
drop policy if exists medication_cards_update_draft on public.medication_cards;
create policy medication_cards_update_draft on public.medication_cards for update
using (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and document_status = 'DRAFT')
with check (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and document_status = 'DRAFT');
drop policy if exists medication_cards_delete_draft on public.medication_cards;
create policy medication_cards_delete_draft on public.medication_cards for delete
using (organization_id = public.current_organization_id() and public.has_permission('clinical:write') and document_status = 'DRAFT');

drop policy if exists medication_card_items_write on public.medication_card_items;
drop policy if exists medication_card_items_insert_draft on public.medication_card_items;
create policy medication_card_items_insert_draft on public.medication_card_items for insert
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('clinical:write')
  and exists (
    select 1 from public.medication_cards mc
    where mc.id = medication_card_id
      and mc.organization_id = public.current_organization_id()
      and mc.document_status = 'DRAFT'
  )
);
drop policy if exists medication_card_items_update_draft on public.medication_card_items;
create policy medication_card_items_update_draft on public.medication_card_items for update
using (
  organization_id = public.current_organization_id()
  and public.has_permission('clinical:write')
  and exists (
    select 1 from public.medication_cards mc
    where mc.id = medication_card_id
      and mc.organization_id = public.current_organization_id()
      and mc.document_status = 'DRAFT'
  )
)
with check (
  organization_id = public.current_organization_id()
  and public.has_permission('clinical:write')
  and exists (
    select 1 from public.medication_cards mc
    where mc.id = medication_card_id
      and mc.organization_id = public.current_organization_id()
      and mc.document_status = 'DRAFT'
  )
);
drop policy if exists medication_card_items_delete_draft on public.medication_card_items;
create policy medication_card_items_delete_draft on public.medication_card_items for delete
using (
  organization_id = public.current_organization_id()
  and public.has_permission('clinical:write')
  and exists (
    select 1 from public.medication_cards mc
    where mc.id = medication_card_id
      and mc.organization_id = public.current_organization_id()
      and mc.document_status = 'DRAFT'
  )
);

create or replace function public.prevent_signed_clinical_document_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' and old.status <> 'DRAFT' then
    raise exception 'Un documento clínico firmado o anulado no puede eliminarse.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'SIGNED' and not (
    new.status = 'VOIDED'
    and nullif(btrim(new.void_reason), '') is not null
    and new.title is not distinct from old.title
    and new.summary is not distinct from old.summary
    and new.content is not distinct from old.content
    and new.version is not distinct from old.version
    and new.signed_by is not distinct from old.signed_by
    and new.signed_at is not distinct from old.signed_at
    and new.signature_metadata is not distinct from old.signature_metadata
  ) then
    raise exception 'Documento firmado inmutable: cree una corrección auditada.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'VOIDED' then
    raise exception 'Un documento anulado es inmutable.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists protect_signed_clinical_documents on public.clinical_documents;
create trigger protect_signed_clinical_documents
before update or delete on public.clinical_documents
for each row execute function public.prevent_signed_clinical_document_mutation();

create or replace function public.prevent_signed_nursing_note_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' and old.status <> 'DRAFT' then
    raise exception 'Una nota firmada o anulada no puede eliminarse.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'SIGNED' and not (
    new.status = 'VOIDED'
    and nullif(btrim(new.void_reason), '') is not null
    and new.note_text is not distinct from old.note_text
    and new.signed_at is not distinct from old.signed_at
    and new.signature_metadata is not distinct from old.signature_metadata
  ) then
    raise exception 'Nota firmada inmutable: cree una corrección auditada.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'VOIDED' then
    raise exception 'Una nota anulada es inmutable.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists protect_signed_nursing_notes on public.nursing_notes;
create trigger protect_signed_nursing_notes
before update or delete on public.nursing_notes
for each row execute function public.prevent_signed_nursing_note_mutation();

create or replace function public.prevent_signed_medication_card_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' and old.document_status <> 'DRAFT' then
    raise exception 'Una tarjeta firmada o anulada no puede eliminarse.';
  end if;
  if tg_op = 'UPDATE' and old.document_status = 'SIGNED' and not (
    new.document_status = 'VOIDED'
    and nullif(btrim(new.void_reason), '') is not null
    and new.status is not distinct from old.status
    and new.version is not distinct from old.version
    and new.signed_by is not distinct from old.signed_by
    and new.signed_at is not distinct from old.signed_at
    and new.signature_metadata is not distinct from old.signature_metadata
  ) then
    raise exception 'Tarjeta firmada inmutable: cree una corrección auditada.';
  end if;
  if tg_op = 'UPDATE' and old.document_status = 'VOIDED' then
    raise exception 'Una tarjeta anulada es inmutable.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists protect_signed_medication_cards on public.medication_cards;
create trigger protect_signed_medication_cards
before update or delete on public.medication_cards
for each row execute function public.prevent_signed_medication_card_mutation();

create or replace function public.prevent_signed_medication_card_item_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_document_status text;
  v_card_id uuid;
begin
  v_card_id := case when tg_op = 'DELETE' then old.medication_card_id else new.medication_card_id end;
  select document_status into v_document_status from public.medication_cards where id = v_card_id;
  if v_document_status <> 'DRAFT' then
    raise exception 'Los ítems de una tarjeta firmada o anulada son inmutables.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists protect_signed_medication_card_items on public.medication_card_items;
create trigger protect_signed_medication_card_items
before insert or update or delete on public.medication_card_items
for each row execute function public.prevent_signed_medication_card_item_mutation();

create or replace function public.sign_clinical_record(
  p_subject_type text,
  p_subject_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_metadata jsonb := jsonb_build_object('method', 'APPLICATION_SIGNATURE_METADATA', 'legal_validation', 'NEEDS_CLIENT_CONFIRMATION', 'signed_by', auth.uid(), 'signed_at', now());
  v_count integer := 0;
begin
  if not public.has_permission('clinical:sign') then raise exception 'No tiene permiso para firmar.'; end if;
  if p_subject_type = 'CLINICAL_DOCUMENT' then
    update public.clinical_documents set status = 'SIGNED', signed_by = auth.uid(), signed_at = now(), signature_metadata = v_metadata
    where id = p_subject_id and organization_id = v_organization_id and status = 'DRAFT';
  elsif p_subject_type = 'NURSING_NOTE' then
    update public.nursing_notes set status = 'SIGNED', signed_at = now(), signature_metadata = v_metadata
    where id = p_subject_id and organization_id = v_organization_id and status = 'DRAFT';
  elsif p_subject_type = 'MEDICATION_CARD' then
    update public.medication_cards set document_status = 'SIGNED', signed_by = auth.uid(), signed_at = now(), signature_metadata = v_metadata
    where id = p_subject_id and organization_id = v_organization_id and document_status = 'DRAFT';
  else
    raise exception 'Tipo de registro clínico no válido.';
  end if;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Registro clínico no disponible para firma.'; end if;
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_organization_id, auth.uid(), 'SIGN_CLINICAL_RECORD', lower(p_subject_type), p_subject_id::text, 'Registro clínico firmado y bloqueado.', v_metadata);
end
$$;

create or replace function public.create_clinical_record_correction(
  p_subject_type text,
  p_subject_id uuid,
  p_correction_kind text,
  p_reason text,
  p_content jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_prior uuid;
  v_id uuid;
  v_signed boolean := false;
  v_author_role text;
begin
  if not public.has_permission('clinical:correct_signed') then raise exception 'No tiene permiso para corregir registros firmados.'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'El motivo de la corrección es obligatorio.'; end if;
  if coalesce(p_content, '{}'::jsonb) = '{}'::jsonb then raise exception 'El contenido corregido o complementario es obligatorio.'; end if;
  if p_correction_kind not in ('AMENDMENT','ADDENDUM','ERRATA') then raise exception 'Tipo de corrección no válido.'; end if;
  if p_subject_type = 'CLINICAL_DOCUMENT' then
    select exists(select 1 from public.clinical_documents where id = p_subject_id and organization_id = v_organization_id and status = 'SIGNED') into v_signed;
  elsif p_subject_type = 'NURSING_NOTE' then
    select exists(select 1 from public.nursing_notes where id = p_subject_id and organization_id = v_organization_id and status = 'SIGNED') into v_signed;
  elsif p_subject_type = 'MEDICATION_CARD' then
    select exists(select 1 from public.medication_cards where id = p_subject_id and organization_id = v_organization_id and document_status = 'SIGNED') into v_signed;
  else
    raise exception 'Tipo de registro clínico no válido.';
  end if;
  if not v_signed then raise exception 'Sólo se puede corregir un registro firmado de la organización actual.'; end if;

  select string_agg(r.code, ',' order by r.code) into v_author_role
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid() and ur.organization_id = v_organization_id;

  select id into v_prior from public.clinical_record_corrections
  where organization_id = v_organization_id
    and ((p_subject_type = 'CLINICAL_DOCUMENT' and clinical_document_id = p_subject_id)
      or (p_subject_type = 'NURSING_NOTE' and nursing_note_id = p_subject_id)
      or (p_subject_type = 'MEDICATION_CARD' and medication_card_id = p_subject_id))
  order by created_at desc limit 1;

  insert into public.clinical_record_corrections (
    organization_id, subject_type, clinical_document_id, nursing_note_id, medication_card_id,
    previous_correction_id, correction_kind, reason, content, author_id, author_role
  ) values (
    v_organization_id, p_subject_type,
    case when p_subject_type = 'CLINICAL_DOCUMENT' then p_subject_id end,
    case when p_subject_type = 'NURSING_NOTE' then p_subject_id end,
    case when p_subject_type = 'MEDICATION_CARD' then p_subject_id end,
    v_prior, p_correction_kind, btrim(p_reason), p_content, auth.uid(), coalesce(v_author_role, 'UNASSIGNED')
  ) returning id into v_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_organization_id, auth.uid(), 'CREATE_CLINICAL_CORRECTION', lower(p_subject_type), p_subject_id::text, 'Corrección clínica append-only creada.', jsonb_build_object('correction_id', v_id, 'previous_correction_id', v_prior, 'kind', p_correction_kind, 'reason', btrim(p_reason)));
  return v_id;
end
$$;

create or replace function public.void_clinical_record(
  p_subject_type text,
  p_subject_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_count integer;
begin
  if not public.has_permission('clinical:correct_signed') then raise exception 'No tiene permiso para anular registros firmados.'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'El motivo de la anulación es obligatorio.'; end if;
  if p_subject_type = 'CLINICAL_DOCUMENT' then
    update public.clinical_documents set status = 'VOIDED', void_reason = btrim(p_reason), voided_by = auth.uid(), voided_at = now()
    where id = p_subject_id and organization_id = v_organization_id and status = 'SIGNED';
  elsif p_subject_type = 'NURSING_NOTE' then
    update public.nursing_notes set status = 'VOIDED', void_reason = btrim(p_reason), voided_by = auth.uid(), voided_at = now()
    where id = p_subject_id and organization_id = v_organization_id and status = 'SIGNED';
  elsif p_subject_type = 'MEDICATION_CARD' then
    update public.medication_cards set document_status = 'VOIDED', void_reason = btrim(p_reason), voided_by = auth.uid(), voided_at = now()
    where id = p_subject_id and organization_id = v_organization_id and document_status = 'SIGNED';
  else
    raise exception 'Tipo de registro clínico no válido.';
  end if;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Sólo se puede anular un registro firmado de la organización actual.'; end if;
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_organization_id, auth.uid(), 'VOID_CLINICAL_RECORD', lower(p_subject_type), p_subject_id::text, 'Registro clínico anulado sin eliminar la versión firmada.', jsonb_build_object('reason', btrim(p_reason)));
end
$$;

revoke all on function public.create_quote_revision(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.send_quote_version(uuid, uuid) from public, anon, authenticated;
revoke all on function public.transition_quote_status(uuid, text, text) from public, anon, authenticated;
revoke all on function public.sign_clinical_record(text, uuid) from public, anon, authenticated;
revoke all on function public.create_clinical_record_correction(text, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.void_clinical_record(text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_quote_revision(uuid, uuid, text) to authenticated;
grant execute on function public.send_quote_version(uuid, uuid) to authenticated;
grant execute on function public.transition_quote_status(uuid, text, text) to authenticated;
grant execute on function public.sign_clinical_record(text, uuid) to authenticated;
grant execute on function public.create_clinical_record_correction(text, uuid, text, text, jsonb) to authenticated;
grant execute on function public.void_clinical_record(text, uuid, text) to authenticated;
