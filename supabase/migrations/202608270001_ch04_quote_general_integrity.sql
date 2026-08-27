begin;

alter table public.quotes add column if not exists invoice_date date;
alter table public.quotes add column if not exists discount_group_id text;
alter table public.quotes add column if not exists referred_by text;
alter table public.quotes add column if not exists giftcard text;

create or replace function public.validate_quote_general_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_case_organization_id uuid;
  v_case_patient_id uuid;
begin
  select h.organization_id, h.patient_id
  into v_case_organization_id, v_case_patient_id
  from public.hospitalizations h
  where h.id = new.hospitalization_id;

  if not found
     or v_case_organization_id is distinct from new.organization_id
     or v_case_patient_id is distinct from new.patient_id then
    raise exception 'La hospitalización y el paciente no pertenecen al alcance autorizado.';
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = new.patient_id and p.organization_id = new.organization_id
  ) then
    raise exception 'El paciente no pertenece al alcance autorizado.';
  end if;

  if new.invoice_date is null then
    raise exception 'La fecha de cotización es obligatoria.';
  end if;
  if coalesce(btrim(new.discount_group_id), '') = '' then
    raise exception 'El grupo de descuento es obligatorio.';
  end if;
  if new.discount_group_id <> 'REGULAR' and not exists (
    select 1 from public.discount_rules d
    where d.id::text = new.discount_group_id
      and d.organization_id = new.organization_id
      and d.status = 'ACTIVE'
  ) then
    raise exception 'El grupo de descuento no está autorizado.';
  end if;
  if coalesce(btrim(new.referred_by), '') = '' then
    raise exception 'La referencia es obligatoria.';
  end if;
  if coalesce(btrim(new.comments), '') = '' then
    raise exception 'Los comentarios administrativos son obligatorios.';
  end if;
  return new;
end
$$;

revoke all on function public.validate_quote_general_integrity() from public, anon, authenticated;

drop trigger if exists validate_quote_general_fields on public.quotes;
create trigger validate_quote_general_fields
before insert or update of organization_id, hospitalization_id, patient_id, invoice_date, discount_group_id, referred_by, giftcard, comments
on public.quotes
for each row execute function public.validate_quote_general_integrity();

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
    or new.invoice_date is distinct from old.invoice_date
    or new.discount_group_id is distinct from old.discount_group_id
    or new.referred_by is distinct from old.referred_by
    or new.giftcard is distinct from old.giftcard
  ) then
    raise exception 'La cotización enviada conserva importes y datos históricos. Cree una nueva versión.';
  end if;
  return new;
end
$$;

revoke all on function public.prevent_sent_quote_financial_change() from public, anon, authenticated;

commit;
