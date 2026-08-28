-- CH10: transactional medical-order and medication-card draft creation.
-- Clinical catalog rules, dose rules, PMC and administration workflows remain configurable/open.

alter table public.clinical_documents
  add column if not exists idempotency_key text;

alter table public.medication_cards
  add column if not exists idempotency_key text,
  add column if not exists treating_doctor_id uuid references public.doctors(id) on delete restrict,
  add column if not exists other_doctor_ids uuid[] not null default '{}'::uuid[],
  add column if not exists diagnosis text;

alter table public.medication_card_items
  add column if not exists prescribing_doctor_id uuid references public.doctors(id) on delete restrict,
  add column if not exists duration_days integer,
  add column if not exists chronic boolean not null default false,
  add column if not exists indications text,
  add column if not exists dilutions text;

create unique index if not exists clinical_documents_org_idempotency_idx
  on public.clinical_documents (organization_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists medication_cards_org_idempotency_idx
  on public.medication_cards (organization_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists medication_cards_org_case_created_idx
  on public.medication_cards (organization_id, hospitalization_id, created_at desc);
create index if not exists medication_card_items_card_created_idx
  on public.medication_card_items (medication_card_id, created_at, id);

create or replace function public.create_clinical_document_draft(
  p_hospitalization_id uuid,
  p_document_type text,
  p_title text,
  p_summary text,
  p_content jsonb,
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
  v_document public.clinical_documents%rowtype;
  v_doctor_id text;
  v_author_name text;
begin
  if v_org is null or not public.has_permission('clinical:write') then
    raise exception 'No tiene permiso para crear documentos clínicos.';
  end if;
  if p_document_type not in ('HEALTH_REPORT','MEDICAL_ORDER','CARE_PLAN','CLINICAL_EVOLUTION','LAB_REQUEST','NURSING_NOTE')
    or nullif(btrim(coalesce(p_title,'')), '') is null or length(p_title) > 300
    or length(coalesce(p_summary,'')) > 5000
    or jsonb_typeof(coalesce(p_content,'{}'::jsonb)) <> 'object'
    or (p_content ? 'other_doctor_ids' and jsonb_typeof(p_content -> 'other_doctor_ids') <> 'array')
    or (p_document_type = 'MEDICAL_ORDER' and nullif(btrim(coalesce(p_content ->> 'treating_doctor_id','')), '') is null)
    or pg_column_size(coalesce(p_content,'{}'::jsonb)) > 100000
    or nullif(btrim(coalesce(p_idempotency_key,'')), '') is null or length(p_idempotency_key) > 160 then
    raise exception 'Revise los datos del documento clínico.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':clinical-document:' || p_idempotency_key, 0));
  select * into v_document from public.clinical_documents
  where organization_id = v_org and idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_document); end if;

  select * into v_hospitalization from public.hospitalizations
  where id = p_hospitalization_id and organization_id = v_org for share;
  if not found then raise exception 'Hospitalización no disponible.'; end if;

  for v_doctor_id in
    select value from jsonb_array_elements_text(
      coalesce(p_content -> 'other_doctor_ids', '[]'::jsonb)
    )
    union all
    select p_content ->> 'treating_doctor_id'
  loop
    if nullif(btrim(coalesce(v_doctor_id,'')), '') is not null then
      if v_doctor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'Profesional no disponible en la organización.';
      end if;
      if not exists (select 1 from public.doctors where id = v_doctor_id::uuid and organization_id = v_org and status = 'ACTIVE') then
        raise exception 'Profesional no disponible en la organización.';
      end if;
    end if;
  end loop;

  select full_name into v_author_name from public.profiles where id = auth.uid() and organization_id = v_org;
  insert into public.clinical_documents (
    organization_id, hospitalization_id, patient_id, document_type, title, status,
    version, summary, content, author_id, author_name, idempotency_key
  ) values (
    v_org, v_hospitalization.id, v_hospitalization.patient_id, p_document_type,
    btrim(p_title), 'DRAFT', 1, nullif(btrim(coalesce(p_summary,'')), ''),
    coalesce(p_content,'{}'::jsonb), auth.uid(), v_author_name, p_idempotency_key
  ) returning * into v_document;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, auth.uid(), 'CREATE_CLINICAL_DOCUMENT', 'clinical_document', v_document.id::text,
    'Documento clínico creado en borrador.',
    jsonb_build_object('hospitalization_id', v_hospitalization.id, 'document_type', p_document_type, 'idempotency_key', p_idempotency_key));
  return to_jsonb(v_document);
end
$$;

create or replace function public.create_medication_card_draft(
  p_hospitalization_id uuid,
  p_header jsonb,
  p_items jsonb,
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
  v_card public.medication_cards%rowtype;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_doctor_id text;
  v_start date;
  v_end date;
  v_duration integer;
  v_item_id uuid;
begin
  if v_org is null or not public.has_permission('clinical:write') then
    raise exception 'No tiene permiso para crear tarjetas de medicamentos.';
  end if;
  if jsonb_typeof(coalesce(p_header,'{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_items,'[]'::jsonb)) not between 1 and 100
    or pg_column_size(coalesce(p_items,'[]'::jsonb)) > 500000
    or (p_header ? 'other_doctor_ids' and jsonb_typeof(p_header -> 'other_doctor_ids') <> 'array')
    or nullif(btrim(coalesce(p_header ->> 'treating_doctor_id','')), '') is null
    or length(coalesce(p_header ->> 'diagnosis','')) > 5000
    or nullif(btrim(coalesce(p_idempotency_key,'')), '') is null or length(p_idempotency_key) > 160 then
    raise exception 'Revise los datos de la tarjeta de medicamentos.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':medication-card:' || p_idempotency_key, 0));
  select * into v_card from public.medication_cards
  where organization_id = v_org and idempotency_key = p_idempotency_key;
  if found then
    select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at, i.id), '[]'::jsonb) into v_items
    from public.medication_card_items i where i.medication_card_id = v_card.id;
    return to_jsonb(v_card) || jsonb_build_object('items', v_items);
  end if;

  select * into v_hospitalization from public.hospitalizations
  where id = p_hospitalization_id and organization_id = v_org for share;
  if not found then raise exception 'Hospitalización no disponible.'; end if;

  for v_doctor_id in
    select value from jsonb_array_elements_text(coalesce(p_header -> 'other_doctor_ids', '[]'::jsonb))
    union all select p_header ->> 'treating_doctor_id'
  loop
    if nullif(btrim(coalesce(v_doctor_id,'')), '') is not null then
      if v_doctor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'Profesional no disponible en la organización.';
      end if;
      if not exists (select 1 from public.doctors where id = v_doctor_id::uuid and organization_id = v_org and status = 'ACTIVE') then
        raise exception 'Profesional no disponible en la organización.';
      end if;
    end if;
  end loop;

  insert into public.medication_cards (
    organization_id, hospitalization_id, patient_id, status, document_status, version,
    created_by, treating_doctor_id, other_doctor_ids, diagnosis, idempotency_key
  ) values (
    v_org, v_hospitalization.id, v_hospitalization.patient_id, 'ACTIVE', 'DRAFT', 1,
    auth.uid(), nullif(p_header ->> 'treating_doctor_id','')::uuid,
    array(select value::uuid from jsonb_array_elements_text(coalesce(p_header -> 'other_doctor_ids','[]'::jsonb))),
    nullif(btrim(coalesce(p_header ->> 'diagnosis','')), ''), p_idempotency_key
  ) returning * into v_card;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or nullif(btrim(coalesce(v_item ->> 'medication','')), '') is null
      or nullif(btrim(coalesce(v_item ->> 'dose','')), '') is null
      or nullif(btrim(coalesce(v_item ->> 'route','')), '') is null
      or nullif(btrim(coalesce(v_item ->> 'frequency','')), '') is null
      or length(coalesce(v_item ->> 'medication','')) > 500
      or length(coalesce(v_item ->> 'dose','')) > 500
      or length(coalesce(v_item ->> 'route','')) > 500
      or length(coalesce(v_item ->> 'frequency','')) > 500
      or length(coalesce(v_item ->> 'indications','')) > 5000
      or length(coalesce(v_item ->> 'dilutions','')) > 5000
      or (nullif(v_item ->> 'start_date','') is null) <> (nullif(v_item ->> 'end_date','') is null)
      or (nullif(v_item ->> 'start_date','') is not null and (
        coalesce(v_item ->> 'start_date','') !~ '^\d{4}-\d{2}-\d{2}$'
        or coalesce(v_item ->> 'end_date','') !~ '^\d{4}-\d{2}-\d{2}$'))
      or jsonb_typeof(coalesce(v_item -> 'schedule','[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(v_item -> 'schedule','[]'::jsonb)) > 96
      or coalesce(v_item ->> 'chronic','false') not in ('true','false') then
      raise exception 'Tratamiento documentado no válido.';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(coalesce(v_item -> 'schedule','[]'::jsonb)) value
      where length(value) > 20
    ) then raise exception 'Horario documentado no válido.'; end if;
    v_start := nullif(v_item ->> 'start_date','')::date;
    v_end := nullif(v_item ->> 'end_date','')::date;
    if v_start is not null and v_end < v_start then raise exception 'El fin del tratamiento no puede ser anterior al inicio.'; end if;
    if nullif(v_item ->> 'duration_days','') is not null then
      if (v_item ->> 'duration_days') !~ '^\d+$' then raise exception 'Duración no válida.'; end if;
      v_duration := (v_item ->> 'duration_days')::integer;
      if v_duration not between 1 and 3660 then raise exception 'Duración fuera del rango técnico permitido.'; end if;
      if v_start is null then raise exception 'La duración requiere un calendario documentado.'; end if;
    else v_duration := null;
    end if;
    v_doctor_id := nullif(v_item ->> 'doctor_id','');
    if v_doctor_id is not null then
      if v_doctor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'Prescriptor no disponible en la organización.';
      end if;
      if not exists (select 1 from public.doctors where id = v_doctor_id::uuid and organization_id = v_org and status = 'ACTIVE') then
        raise exception 'Prescriptor no disponible en la organización.';
      end if;
    end if;

    insert into public.medication_card_items (
      organization_id, medication_card_id, medication_name, prescribing_doctor_id,
      dose, route, frequency, schedule, start_date, end_date, duration_days,
      chronic, indications, dilutions, status
    ) values (
      v_org, v_card.id, btrim(v_item ->> 'medication'), v_doctor_id::uuid,
      btrim(v_item ->> 'dose'), btrim(v_item ->> 'route'), btrim(v_item ->> 'frequency'),
      coalesce(v_item -> 'schedule','[]'::jsonb), v_start, v_end, v_duration,
      coalesce((v_item ->> 'chronic')::boolean, false), nullif(btrim(coalesce(v_item ->> 'indications','')), ''),
      nullif(btrim(coalesce(v_item ->> 'dilutions','')), ''), 'ACTIVE'
    ) returning id into v_item_id;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at, i.id), '[]'::jsonb) into v_items
  from public.medication_card_items i where i.medication_card_id = v_card.id;
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, auth.uid(), 'CREATE_MEDICATION_CARD', 'medication_card', v_card.id::text,
    'Tarjeta de medicamentos creada en borrador.',
    jsonb_build_object('hospitalization_id', v_hospitalization.id, 'item_count', jsonb_array_length(p_items), 'idempotency_key', p_idempotency_key));
  return to_jsonb(v_card) || jsonb_build_object('items', v_items);
end
$$;

revoke all on function public.create_clinical_document_draft(uuid, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.create_medication_card_draft(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_clinical_document_draft(uuid, text, text, text, jsonb, text) to authenticated;
grant execute on function public.create_medication_card_draft(uuid, jsonb, jsonb, text) to authenticated;

-- Draft creation is RPC-only so organization/patient linkage and idempotency are atomic.
revoke insert on public.clinical_documents from authenticated;
revoke insert on public.medication_cards from authenticated;
revoke insert on public.medication_card_items from authenticated;
