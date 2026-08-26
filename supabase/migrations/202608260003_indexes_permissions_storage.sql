-- Índices, permisos base y almacenamiento privado

insert into public.permissions (code, module, description) values
  ('dashboard:read','dashboard','Ver indicadores operativos'),
  ('patients:read','patients','Consultar pacientes'),
  ('patients:write','patients','Crear y editar pacientes'),
  ('cases:read','cases','Consultar hospitalizaciones'),
  ('cases:write','cases','Crear y actualizar hospitalizaciones'),
  ('quotes:read','quotes','Consultar cotizaciones'),
  ('quotes:write','quotes','Crear, versionar y enviar cotizaciones'),
  ('insurance:read','insurance','Consultar preautorizaciones'),
  ('insurance:write','insurance','Actualizar estados de seguro'),
  ('payments:read','payments','Consultar cuentas y pagos'),
  ('payments:write','payments','Registrar pagos y ajustes'),
  ('clinical:read','clinical','Consultar expediente clínico'),
  ('clinical:write','clinical','Crear registros clínicos'),
  ('clinical:sign','clinical','Firmar documentos clínicos'),
  ('clinical:correct_signed','clinical','Corregir documentos firmados con auditoría'),
  ('agenda:read','agenda','Consultar agenda'),
  ('agenda:write','agenda','Programar y actualizar turnos'),
  ('purchases:read','purchases','Consultar compras'),
  ('purchases:write','purchases','Crear y aprobar compras'),
  ('inventory:read','inventory','Consultar inventario'),
  ('inventory:write','inventory','Registrar movimientos, kits y cierres'),
  ('catalogs:read','catalogs','Consultar catálogos y tarifas'),
  ('catalogs:write','catalogs','Administrar catálogos, precios y descuentos'),
  ('doctors:read','doctors','Consultar profesionales'),
  ('doctors:write','doctors','Administrar profesionales'),
  ('statements:read','statements','Consultar cuentas por pagar'),
  ('statements:write','statements','Generar y enviar estados de cuenta'),
  ('reports:read','reports','Consultar reportes'),
  ('audit:read','audit','Consultar auditoría'),
  ('qa:read','qa','Consultar matriz de cobertura'),
  ('settings:read','settings','Consultar configuración'),
  ('settings:write','settings','Administrar configuración')
on conflict (code) do update set module = excluded.module, description = excluded.description;

create index if not exists patients_org_name_idx on public.patients (organization_id, last_name, first_name);
create index if not exists patients_org_document_idx on public.patients (organization_id, document_number);
create index if not exists hospitalizations_org_status_idx on public.hospitalizations (organization_id, status, start_date desc);
create index if not exists hospitalizations_patient_idx on public.hospitalizations (patient_id, start_date desc);
create index if not exists quotes_org_status_idx on public.quotes (organization_id, status, created_at desc);
create index if not exists quotes_patient_idx on public.quotes (patient_id, created_at desc);
create index if not exists quote_events_quote_idx on public.quote_status_events (quote_id, created_at);
create index if not exists insurance_requests_org_status_idx on public.insurance_requests (organization_id, status, updated_at desc);
create index if not exists payments_quote_idx on public.payments (quote_id, paid_at desc);
create index if not exists clinical_documents_case_idx on public.clinical_documents (hospitalization_id, document_type, created_at desc);
create index if not exists vital_signs_case_idx on public.vital_signs (hospitalization_id, recorded_at desc);
create index if not exists nursing_notes_case_idx on public.nursing_notes (hospitalization_id, created_at desc);
create index if not exists shifts_org_dates_idx on public.shifts (organization_id, starts_at, ends_at);
create index if not exists purchases_org_status_idx on public.purchases (organization_id, status, purchase_date desc);
create index if not exists inventory_items_warehouse_idx on public.inventory_items (warehouse_id, catalog_item_id);
create index if not exists inventory_lots_expiry_idx on public.inventory_lots (organization_id, expires_at) where status = 'AVAILABLE';
create index if not exists inventory_movements_item_idx on public.inventory_movements (inventory_item_id, created_at desc);
create index if not exists inventory_movements_case_idx on public.inventory_movements (hospitalization_id, created_at desc);
create index if not exists inventory_reservations_case_idx on public.inventory_reservations (hospitalization_id, status);
create index if not exists doctor_services_doctor_idx on public.doctor_services (doctor_id, service_date desc);
create index if not exists notifications_retry_idx on public.notifications (status, next_retry_at, created_at) where status in ('QUEUED','FAILED');
create index if not exists audit_logs_org_date_idx on public.audit_logs (organization_id, created_at desc);
create index if not exists portal_links_expiry_idx on public.patient_portal_links (expires_at) where revoked_at is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('clinical-private','clinical-private',false,10485760,array['application/pdf','image/png','image/jpeg']),
  ('financial-private','financial-private',false,10485760,array['application/pdf','image/png','image/jpeg','text/csv']),
  ('templates-private','templates-private',false,5242880,array['text/html','application/json','application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Object names must start with the organization UUID:
-- <organization-id>/<module>/<entity-id>/<filename>
drop policy if exists private_files_select on storage.objects;
create policy private_files_select on storage.objects
for select to authenticated
using (
  bucket_id in ('clinical-private','financial-private','templates-private')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

drop policy if exists private_files_insert on storage.objects;
create policy private_files_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('clinical-private','financial-private','templates-private')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

drop policy if exists private_files_update on storage.objects;
create policy private_files_update on storage.objects
for update to authenticated
using (
  bucket_id in ('clinical-private','financial-private','templates-private')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
)
with check (
  bucket_id in ('clinical-private','financial-private','templates-private')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

-- Delete is restricted to settings administrators.
drop policy if exists private_files_delete on storage.objects;
create policy private_files_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('clinical-private','financial-private','templates-private')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and public.has_permission('settings:write')
);
