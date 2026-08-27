-- CH12: close direct financial writes until the professional-payables state
-- machine, tariff sources, approval roles and reversal rules are approved.

alter table public.doctor_statement_items enable row level security;

drop policy if exists doctor_statement_items_read on public.doctor_statement_items;
create policy doctor_statement_items_read
on public.doctor_statement_items
for select
using (
  public.has_permission('statements:read')
  and exists (
    select 1
    from public.doctor_statements statement
    where statement.id = doctor_statement_items.statement_id
      and statement.organization_id = public.current_organization_id()
  )
);

-- A service cannot be included in more than one professional statement. This
-- is a structural duplicate-payment guard, not a tariff or payroll rule.
create unique index if not exists doctor_statement_items_one_statement_per_service_idx
  on public.doctor_statement_items (doctor_service_id);

drop policy if exists doctor_services_write on public.doctor_services;
drop policy if exists doctor_statements_write on public.doctor_statements;

revoke insert, update, delete on public.doctor_services from authenticated;
revoke insert, update, delete on public.doctor_statements from authenticated;
revoke insert, update, delete on public.doctor_statement_items from authenticated;

grant select on public.doctor_services to authenticated;
grant select on public.doctor_statements to authenticated;
grant select on public.doctor_statement_items to authenticated;

comment on table public.doctor_statement_items is
  'CH12 financial detail: tenant-readable through its parent statement; direct writes are closed pending an audited, idempotent RPC.';
