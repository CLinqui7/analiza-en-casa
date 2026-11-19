CREATE TABLE IF NOT EXISTS analiza.survey_invitations (
  organization_id text NOT NULL,
  id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('PATIENT','DOCTOR')),
  target_id text NOT NULL,
  token_hash text NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consent_attested_at timestamptz NOT NULL DEFAULT now(),
  response jsonb CHECK (response IS NULL OR jsonb_typeof(response)='array'),
  responded_at timestamptz,
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (organization_id) REFERENCES analiza.organizations(id),
  UNIQUE (token_hash),
  CONSTRAINT survey_response_time_check CHECK ((response IS NULL) = (responded_at IS NULL))
);
CREATE INDEX IF NOT EXISTS survey_invitations_org_kind_time
  ON analiza.survey_invitations (organization_id,kind,created_at DESC);
ALTER TABLE analiza.survey_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.survey_invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON analiza.survey_invitations;
CREATE POLICY tenant_scope ON analiza.survey_invitations
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
