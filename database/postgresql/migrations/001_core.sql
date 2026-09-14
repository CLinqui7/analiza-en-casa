-- Analiza-owned schema. Apply explicitly with the migration identity, NEVER at web startup.
-- No corporate schema, existing records, clinical rules, passwords or blobs are modified here.
CREATE SCHEMA IF NOT EXISTS analiza;
REVOKE ALL ON SCHEMA analiza FROM PUBLIC;
CREATE TABLE analiza.organizations (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE analiza.users (
  id text PRIMARY KEY, email_normalized text NOT NULL UNIQUE, password_hash text NOT NULL,
  display_name text NOT NULL DEFAULT '', disabled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE analiza.memberships (
  user_id text NOT NULL REFERENCES analiza.users(id), organization_id text NOT NULL REFERENCES analiza.organizations(id),
  role text NOT NULL CHECK (role IN ('ADMIN','DOCTOR','NURSE','NURSE_MANAGER','INVENTORY','FINANCE','AUDITOR')),
  active boolean NOT NULL DEFAULT true, PRIMARY KEY (user_id,organization_id)
);
CREATE INDEX memberships_org_active ON analiza.memberships(organization_id,active,user_id);
CREATE TABLE analiza.sessions (
  session_hash text PRIMARY KEY, csrf_hash text NOT NULL, user_id text NOT NULL,
  organization_id text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
  FOREIGN KEY (user_id,organization_id) REFERENCES analiza.memberships(user_id,organization_id)
);
CREATE INDEX sessions_expiry ON analiza.sessions(expires_at);
CREATE TABLE analiza.auth_rate_limits (key text PRIMARY KEY, window_started_at timestamptz NOT NULL, attempts integer NOT NULL CHECK(attempts>0));
CREATE TABLE analiza.patients (
  organization_id text NOT NULL REFERENCES analiza.organizations(id), id text NOT NULL,
  document_key text NOT NULL, body jsonb NOT NULL CHECK (jsonb_typeof(body)='object' AND body->>'id'=id),
  version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,id), UNIQUE(organization_id,document_key)
);
CREATE TABLE analiza.doctors (
  organization_id text NOT NULL REFERENCES analiza.organizations(id), id text NOT NULL,
  body jsonb NOT NULL CHECK (jsonb_typeof(body)='object' AND body->>'id'=id),
  version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,id)
);
CREATE TABLE analiza.nursing_resources (
  organization_id text NOT NULL REFERENCES analiza.organizations(id), id text NOT NULL,
  user_id text NOT NULL, body jsonb NOT NULL CHECK (body->>'id'=id AND body->>'userId'=user_id),
  PRIMARY KEY(organization_id,id), FOREIGN KEY(user_id,organization_id) REFERENCES analiza.memberships(user_id,organization_id)
);
CREATE TABLE analiza.hospitalizations (
  organization_id text NOT NULL, id text NOT NULL, patient_id text NOT NULL,
  body jsonb NOT NULL CHECK (body->>'id'=id AND body->>'patientId'=patient_id),
  version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,id), FOREIGN KEY(organization_id,patient_id) REFERENCES analiza.patients(organization_id,id)
);
CREATE INDEX hospitalizations_patient ON analiza.hospitalizations(organization_id,patient_id);
CREATE TABLE analiza.hospitalization_nurses (
  organization_id text NOT NULL, hospitalization_id text NOT NULL, resource_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(organization_id,hospitalization_id,resource_id),
  FOREIGN KEY(organization_id,hospitalization_id) REFERENCES analiza.hospitalizations(organization_id,id),
  FOREIGN KEY(organization_id,resource_id) REFERENCES analiza.nursing_resources(organization_id,id)
);
CREATE TABLE analiza.shifts (
  organization_id text NOT NULL, id text NOT NULL, resource_id text NOT NULL, patient_id text,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
  status text NOT NULL CHECK(status IN ('SCHEDULED','CANCELLED','COMPLETED')),
  body jsonb NOT NULL CHECK(body->>'id'=id), PRIMARY KEY(organization_id,id),
  FOREIGN KEY(organization_id,resource_id) REFERENCES analiza.nursing_resources(organization_id,id),
  FOREIGN KEY(organization_id,patient_id) REFERENCES analiza.patients(organization_id,id)
);
CREATE INDEX shifts_resource_time ON analiza.shifts(organization_id,resource_id,starts_at,ends_at) WHERE status<>'CANCELLED';
CREATE TABLE analiza.commands (
  organization_id text NOT NULL REFERENCES analiza.organizations(id), idempotency_key text NOT NULL,
  payload_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,idempotency_key)
);
CREATE TABLE analiza.configuration_entries (
  organization_id text NOT NULL REFERENCES analiza.organizations(id), id text NOT NULL,
  body jsonb NOT NULL CHECK(body->>'id'=id), PRIMARY KEY(organization_id,id)
);
CREATE TABLE analiza.catalog_items (
  organization_id text NOT NULL REFERENCES analiza.organizations(id), id text NOT NULL,
  body jsonb NOT NULL CHECK(body->>'id'=id), PRIMARY KEY(organization_id,id)
);
CREATE TABLE analiza.file_metadata (
  organization_id text NOT NULL REFERENCES analiza.organizations(id), id text NOT NULL,
  owner_type text NOT NULL CHECK(owner_type IN ('patient','doctor','hospitalization')), owner_id text NOT NULL,
  storage_key text NOT NULL UNIQUE, name text NOT NULL, mime_type text NOT NULL, size bigint NOT NULL CHECK(size>=0 AND size<=26214400),
  sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), created_by text NOT NULL REFERENCES analiza.users(id), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,id)
);
CREATE INDEX files_owner ON analiza.file_metadata(organization_id,owner_type,owner_id,created_at);
CREATE TABLE analiza.audit_events (
  organization_id text NOT NULL REFERENCES analiza.organizations(id), id text NOT NULL,
  actor_user_id text NOT NULL REFERENCES analiza.users(id), action text NOT NULL, resource_type text NOT NULL,
  resource_id text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,id)
);
CREATE INDEX audit_org_time ON analiza.audit_events(organization_id,occurred_at DESC);
-- Identity lookup is restricted to this private schema and the server auth store. Domain data
-- additionally uses transaction-scoped RLS. Runtime must NEVER own tables or have BYPASSRLS.
DO $$ DECLARE relation text; BEGIN
  FOREACH relation IN ARRAY ARRAY['patients','doctors','nursing_resources','hospitalizations','hospitalization_nurses','shifts','commands','configuration_entries','catalog_items','file_metadata','audit_events'] LOOP
    EXECUTE format('ALTER TABLE analiza.%I ENABLE ROW LEVEL SECURITY',relation);
    EXECUTE format('ALTER TABLE analiza.%I FORCE ROW LEVEL SECURITY',relation);
    EXECUTE format('CREATE POLICY tenant_scope ON analiza.%I USING (organization_id = nullif(current_setting(''analiza.organization_id'',true),'''')) WITH CHECK (organization_id = nullif(current_setting(''analiza.organization_id'',true),''''))',relation);
  END LOOP;
END $$;
