-- Additive migration: preserve Core rows, roles and the immutable 001 migration.
CREATE TABLE analiza.workspace_profiles (
  organization_id text PRIMARY KEY REFERENCES analiza.organizations(id),
  profile jsonb CHECK (profile IS NULL OR jsonb_typeof(profile)='object'),
  version integer NOT NULL DEFAULT 0 CHECK (version>=0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE analiza.organization_staff (
  organization_id text NOT NULL REFERENCES analiza.organizations(id),
  id uuid NOT NULL, body jsonb NOT NULL CHECK (jsonb_typeof(body)='object' AND body->>'id'=id::text),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id)
);
CREATE TABLE analiza.organization_services (
  organization_id text NOT NULL REFERENCES analiza.organizations(id),
  id uuid NOT NULL, body jsonb NOT NULL CHECK (jsonb_typeof(body)='object' AND body->>'id'=id::text),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id)
);
DO $$ DECLARE relation text; BEGIN
  FOREACH relation IN ARRAY ARRAY['workspace_profiles','organization_staff','organization_services'] LOOP
    EXECUTE format('ALTER TABLE analiza.%I ENABLE ROW LEVEL SECURITY',relation);
    EXECUTE format('ALTER TABLE analiza.%I FORCE ROW LEVEL SECURITY',relation);
    EXECUTE format('CREATE POLICY tenant_scope ON analiza.%I USING (organization_id = nullif(current_setting(''analiza.organization_id'',true),'''')) WITH CHECK (organization_id = nullif(current_setting(''analiza.organization_id'',true),''''))',relation);
  END LOOP;
END $$;
