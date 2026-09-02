-- B1: campos administrativos solicitados por el cliente. No convierten el
-- documento de un contacto en un factor de acceso ni validan reglas no aprobadas.
alter table public.patient_contacts
  add column if not exists document_type text,
  add column if not exists document_number text;

alter table public.patient_contacts
  drop constraint if exists patient_contacts_document_pair;
alter table public.patient_contacts
  add constraint patient_contacts_document_pair
  check ((document_type is null and document_number is null) or (document_type is not null and btrim(document_number) <> ''));
