-- Append-only captures of the supplied Studio forms. No clinical score or classification is stored.
ALTER TABLE analiza.hospitalizations
  ADD CONSTRAINT hospitalization_patient_reference UNIQUE (organization_id,id,patient_id);

CREATE TABLE analiza.clinical_scale_captures (
  organization_id text NOT NULL,
  id text NOT NULL,
  patient_id text NOT NULL,
  case_id text,
  scale_id text NOT NULL,
  source_row integer NOT NULL CHECK (source_row BETWEEN 22 AND 31),
  source_version text NOT NULL,
  observed_at timestamptz NOT NULL,
  values jsonb NOT NULL CHECK (jsonb_typeof(values)='object'),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  clinical_validated boolean NOT NULL DEFAULT false CHECK (clinical_validated=false),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (organization_id,patient_id)
    REFERENCES analiza.patients(organization_id,id),
  FOREIGN KEY (organization_id,case_id,patient_id)
    REFERENCES analiza.hospitalizations(organization_id,id,patient_id),
  FOREIGN KEY (created_by,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id)
);

CREATE INDEX clinical_scale_captures_patient_time
  ON analiza.clinical_scale_captures(organization_id,patient_id,observed_at DESC,created_at DESC);

ALTER TABLE analiza.clinical_scale_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.clinical_scale_captures FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.clinical_scale_captures
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
