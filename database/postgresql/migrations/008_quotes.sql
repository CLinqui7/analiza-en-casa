CREATE TABLE analiza.quotes (
  organization_id text NOT NULL REFERENCES analiza.organizations(id),
  id text NOT NULL,
  case_id text NOT NULL,
  patient_id text NOT NULL,
  root_quote_id text NOT NULL,
  quote_version integer NOT NULL CHECK (quote_version > 0),
  body jsonb NOT NULL CHECK (
    jsonb_typeof(body) = 'object'
    AND body->>'id' = id
    AND body->>'caseId' = case_id
    AND body->>'patientId' = patient_id
  ),
  record_version integer NOT NULL DEFAULT 1 CHECK (record_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,root_quote_id,quote_version),
  FOREIGN KEY (organization_id,case_id) REFERENCES analiza.hospitalizations(organization_id,id),
  FOREIGN KEY (organization_id,patient_id) REFERENCES analiza.patients(organization_id,id)
);

CREATE INDEX quotes_created ON analiza.quotes(organization_id,created_at DESC);
ALTER TABLE analiza.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.quotes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.quotes
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
