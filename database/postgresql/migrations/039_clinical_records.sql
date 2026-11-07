-- Source: client PDF 31 Oct 2026. Append-only records; tenant-isolated references.
CREATE TABLE analiza.clinical_records (
  organization_id text NOT NULL,
  id text NOT NULL,
  patient_id text NOT NULL,
  case_id text NOT NULL,
  root_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  kind text NOT NULL,
  request_body jsonb NOT NULL,
  body jsonb NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (body->>'id'=id AND body->>'patientId'=patient_id AND body->>'caseId'=case_id AND body->'payload'->>'kind'=kind),
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,root_id,version),
  FOREIGN KEY (organization_id,case_id,patient_id) REFERENCES analiza.hospitalizations(organization_id,id,patient_id),
  FOREIGN KEY (created_by,organization_id) REFERENCES analiza.memberships(user_id,organization_id)
);
CREATE INDEX clinical_records_patient_date ON analiza.clinical_records(organization_id,patient_id,created_at DESC);
CREATE INDEX clinical_records_case_kind ON analiza.clinical_records(organization_id,case_id,kind,created_at DESC);
ALTER TABLE analiza.clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.clinical_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.clinical_records
 USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
 WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
CREATE FUNCTION analiza.prevent_clinical_record_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Clinical records are append-only; create an audited correction'; END;
$$;
CREATE TRIGGER clinical_records_immutable BEFORE UPDATE OR DELETE ON analiza.clinical_records
 FOR EACH ROW EXECUTE FUNCTION analiza.prevent_clinical_record_mutation();
