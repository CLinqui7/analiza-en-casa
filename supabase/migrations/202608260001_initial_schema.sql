-- Analiza en Casa · esquema inicial
-- Datos de salud: aplicar políticas legales, privacidad y retención antes de usar en producción.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  currency char(3) not null default 'USD',
  timezone text not null default 'America/El_Salvador',
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  code text not null,
  address text,
  phone text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete set null,
  full_name text not null default '',
  phone text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','INVITED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.permissions (
  code text primary key,
  module text not null,
  description text not null
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (role_id, permission_code)
);

create table if not exists public.user_roles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id, role_id)
);

create table if not exists public.insurers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  tax_id text,
  contact_name text,
  phone text,
  email text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insurance_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  insurer_id uuid not null references public.insurers(id) on delete restrict,
  name text not null,
  coverage_note text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  unique (organization_id, insurer_id, name)
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  document_type text not null default 'DUI',
  document_number text not null,
  first_name text not null,
  last_name text not null,
  birth_date date,
  sex text check (sex is null or sex in ('F','M','O','U')),
  blood_type text,
  nationality text,
  phone text,
  email text,
  triage text not null default 'BAJA' check (triage in ('BAJA','MEDIA','ALTA')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DECEASED')),
  notify_whatsapp boolean not null default false,
  notify_sms boolean not null default false,
  notify_email boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, document_type, document_number)
);

create table if not exists public.patient_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete cascade,
  full_name text not null,
  relationship text,
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.patient_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete cascade,
  label text not null default 'Domicilio',
  address_line text not null,
  department text,
  municipality text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  reference text,
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.patient_insurances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete cascade,
  insurer_id uuid not null references public.insurers(id) on delete restrict,
  plan_id uuid references public.insurance_plans(id) on delete set null,
  policy_number text,
  member_number text,
  valid_from date,
  valid_until date,
  is_primary boolean not null default true,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','EXPIRED')),
  created_at timestamptz not null default now()
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  specialty text,
  license_number text,
  phone text,
  email text,
  rate_type text not null default 'PER_VISIT' check (rate_type in ('PER_VISIT','HOURLY','FIXED','CUSTOM')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospitalizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  patient_id uuid not null references public.patients(id) on delete restrict,
  account_type text not null check (account_type in ('SEGURO','PARTICULAR','EMPRESA')),
  insurer_id uuid references public.insurers(id) on delete set null,
  administrative_manager_id uuid references auth.users(id) on delete set null,
  administrative_manager_name text,
  contracting_doctor_id uuid references public.doctors(id) on delete set null,
  start_date date not null,
  end_date date,
  status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','PENDING_CLOSE','CLOSED','CANCELLED')),
  priority text not null default 'MEDIA' check (priority in ('BAJA','MEDIA','ALTA')),
  diagnosis_summary text,
  next_action text,
  devices jsonb not null default '[]'::jsonb,
  supervisors jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.hospitalization_status_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  bucket text not null,
  object_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  classification text not null default 'PRIVATE' check (classification in ('PRIVATE','CLINICAL','FINANCIAL','PUBLIC_TEMPLATE')),
  checksum text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, object_path)
);

create table if not exists public.hospitalization_documents (
  hospitalization_id uuid not null references public.hospitalizations(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  document_type text not null,
  created_at timestamptz not null default now(),
  primary key (hospitalization_id, file_id)
);

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sku text not null,
  category text not null check (category in ('SERVICES','STUDIES','MEDICATIONS','SUPPLIES','EQUIPMENT','FEES','EXTRAS')),
  name text not null,
  description text,
  unit text not null default 'unidad',
  cost numeric(14,2) not null default 0 check (cost >= 0),
  base_price numeric(14,2) not null default 0 check (base_price >= 0),
  taxable boolean not null default false,
  requires_lot boolean not null default false,
  requires_serial boolean not null default false,
  internal_use boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table if not exists public.price_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  currency char(3) not null default 'USD',
  valid_from date not null,
  valid_until date,
  status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete restrict,
  price numeric(14,2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  unique (price_list_id, catalog_item_id)
);

create table if not exists public.discount_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  rule_type text not null default 'PROFILE',
  category_percentages jsonb not null default '{}'::jsonb,
  requires_reason boolean not null default true,
  requires_approval boolean not null default true,
  valid_from date,
  valid_until date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT','READY_TO_SEND','SENT_TO_PATIENT','SENT_TO_INSURER','INSURER_REVIEW','INFO_REQUIRED','PARTIALLY_APPROVED','APPROVED','REJECTED','PATIENT_PAYMENT','SERVICE_SCHEDULED','CLOSED','CANCELLED')),
  current_version integer not null default 1 check (current_version > 0),
  currency char(3) not null default 'USD',
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  insurer_amount numeric(14,2) not null default 0,
  patient_amount numeric(14,2) not null default 0,
  comments text,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  check (subtotal >= 0 and discount_amount >= 0 and total >= 0 and insurer_amount >= 0 and patient_amount >= 0)
);

create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  version integer not null check (version > 0),
  status_snapshot text not null,
  subtotal numeric(14,2) not null,
  discount_amount numeric(14,2) not null,
  total numeric(14,2) not null,
  insurer_amount numeric(14,2) not null,
  patient_amount numeric(14,2) not null,
  discount_snapshot jsonb not null default '{}'::jsonb,
  comments text,
  immutable boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (quote_id, version)
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  quote_version_id uuid not null references public.quote_versions(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id) on delete restrict,
  category text not null,
  description text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  line_total numeric(14,2) generated always as (round((quantity * unit_price - discount_amount)::numeric, 2)) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_status_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.insurance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  insurer_id uuid not null references public.insurers(id) on delete restrict,
  status text not null,
  claim_number text,
  requested_amount numeric(14,2) not null default 0,
  approved_amount numeric(14,2) not null default 0,
  submitted_at timestamptz,
  responded_at timestamptz,
  last_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id)
);

create table if not exists public.insurance_request_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  insurance_request_id uuid not null references public.insurance_requests(id) on delete cascade,
  status text not null,
  note text,
  file_id uuid references public.files(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  method text not null,
  payer text,
  external_reference text,
  status text not null default 'APPLIED' check (status in ('PENDING','APPLIED','REVERSED','REFUNDED')),
  receipt_code text not null,
  receipt_file_id uuid references public.files(id) on delete set null,
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique (organization_id, external_reference)
);

create table if not exists public.financial_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  adjustment_type text not null check (adjustment_type in ('ADVANCE','DISCOUNT','CREDIT','DEBIT','REFUND','WRITE_OFF')),
  amount numeric(14,2) not null,
  reason text not null,
  status text not null default 'APPLIED' check (status in ('PENDING','APPLIED','REVERSED')),
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  document_type text not null,
  version integer not null default 1,
  html_template text not null,
  schema jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','ARCHIVED')),
  created_at timestamptz not null default now(),
  unique (organization_id, code, version)
);

create table if not exists public.clinical_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  document_type text not null check (document_type in ('HEALTH_REPORT','MEDICAL_ORDER','CARE_PLAN','CLINICAL_EVOLUTION','LAB_REQUEST','NURSING_NOTE')),
  title text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','SIGNED','VOIDED')),
  version integer not null default 1,
  summary text,
  content jsonb not null default '{}'::jsonb,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  signed_by uuid references auth.users(id) on delete set null,
  signed_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vital_signs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  temperature numeric(4,1),
  heart_rate smallint,
  respiratory_rate smallint,
  systolic smallint,
  diastolic smallint,
  spo2 smallint,
  pain smallint check (pain is null or pain between 0 and 10),
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  recorded_at timestamptz not null default now()
);

create table if not exists public.medication_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.medication_card_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  medication_card_id uuid not null references public.medication_cards(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id) on delete restrict,
  medication_name text not null,
  dose text not null,
  route text not null,
  frequency text not null,
  schedule jsonb not null default '[]'::jsonb,
  start_date date,
  end_date date,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table if not exists public.medication_administrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  medication_card_item_id uuid not null references public.medication_card_items(id) on delete restrict,
  scheduled_at timestamptz,
  administered_at timestamptz,
  status text not null check (status in ('PENDING','ADMINISTERED','OMITTED','REFUSED','DELAYED')),
  observation text,
  administered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.nursing_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  note_text text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','SIGNED','VOIDED')),
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  signed_at timestamptz,
  shared_at timestamptz,
  share_status text not null default 'NOT_SHARED',
  created_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  resource_user_id uuid references auth.users(id) on delete set null,
  resource_name text not null,
  shift_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  tax_id text,
  contact_name text,
  phone text,
  email text,
  payment_terms text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  invoice_number text,
  invoice_file_id uuid references public.files(id) on delete set null,
  purchase_date date not null,
  payment_type text not null default 'CREDIT',
  status text not null default 'PENDING_APPROVAL' check (status in ('DRAFT','PENDING_APPROVAL','APPROVED','RECEIVED','CANCELLED')),
  subtotal numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete restrict,
  description text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  tax_rate numeric(6,3) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  location text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  catalog_item_id uuid not null references public.catalog_items(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  stock numeric(14,3) not null default 0,
  committed numeric(14,3) not null default 0,
  minimum_stock numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  unique (catalog_item_id, warehouse_id),
  check (stock >= 0 and committed >= 0 and committed <= stock)
);

create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  lot_number text,
  serial_number text,
  expires_at date,
  quantity numeric(14,3) not null default 0,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','QUARANTINED','EXPIRED','CONSUMED','DISPOSED')),
  created_at timestamptz not null default now(),
  check (quantity >= 0)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  hospitalization_id uuid references public.hospitalizations(id) on delete restrict,
  movement_type text not null check (movement_type in ('PURCHASE_ENTRY','PATIENT_COMMITMENT','PATIENT_CONSUMPTION','RETURN_TO_STOCK','TRANSFER','POSITIVE_ADJUSTMENT','NEGATIVE_ADJUSTMENT','EXPIRY_DISPOSAL')),
  quantity numeric(14,3) not null check (quantity > 0),
  warehouse_from_id uuid references public.warehouses(id) on delete restrict,
  warehouse_to_id uuid references public.warehouses(id) on delete restrict,
  lot_id uuid references public.inventory_lots(id) on delete set null,
  reference text,
  note text,
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(14,3) not null default 0,
  delivered numeric(14,3) not null default 0,
  consumed numeric(14,3) not null default 0,
  returned numeric(14,3) not null default 0,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED','CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity >= 0 and delivered >= 0 and consumed >= 0 and returned >= 0)
);

create table if not exists public.inventory_closures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete restrict,
  closure_type text not null check (closure_type in ('PARTIAL','TOTAL')),
  status text not null default 'PENDING_REVIEW' check (status in ('DRAFT','PENDING_REVIEW','APPROVED','REJECTED')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_closure_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  closure_id uuid not null references public.inventory_closures(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  delivered numeric(14,3) not null default 0,
  consumed numeric(14,3) not null default 0,
  returned numeric(14,3) not null default 0,
  difference numeric(14,3) not null default 0
);

create table if not exists public.supply_kits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.supply_kit_items (
  kit_id uuid not null references public.supply_kits(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  primary key (kit_id, catalog_item_id)
);

create table if not exists public.doctor_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  hospitalization_id uuid not null references public.hospitalizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  service_date date not null,
  service_name text not null,
  quantity numeric(14,3) not null default 1,
  rate numeric(14,2) not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','IN_STATEMENT','PAID','REJECTED')),
  created_at timestamptz not null default now()
);

create table if not exists public.doctor_statements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  gross numeric(14,2) not null default 0,
  adjustments numeric(14,2) not null default 0,
  withholdings numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  status text not null default 'DRAFT' check (status in ('DRAFT','READY_TO_SEND','SENT','PARTIALLY_PAID','PAID','VOIDED')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.doctor_statement_items (
  statement_id uuid not null references public.doctor_statements(id) on delete cascade,
  doctor_service_id uuid not null references public.doctor_services(id) on delete restrict,
  amount numeric(14,2) not null,
  primary key (statement_id, doctor_service_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  channel text not null check (channel in ('WHATSAPP','SMS','EMAIL')),
  template_code text not null,
  destination_masked text not null,
  entity_type text,
  entity_id uuid,
  status text not null default 'QUEUED' check (status in ('QUEUED','SENT','DELIVERED','READ','FAILED','RETRYING','CANCELLED')),
  payload jsonb not null default '{}'::jsonb,
  provider_message_id text,
  attempts integer not null default 0,
  next_retry_at timestamptz,
  last_error text,
  idempotency_key text default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists public.patient_portal_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  token_hash text not null unique,
  verification_code_hash text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  max_attempts smallint not null default 5,
  failed_attempts smallint not null default 0,
  last_access_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.patient_portal_access_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  portal_link_id uuid references public.patient_portal_links(id) on delete set null,
  success boolean not null,
  ip_hash text,
  user_agent_hash text,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);
