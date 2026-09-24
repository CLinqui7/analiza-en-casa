CREATE TABLE analiza.clinical_documents (
  organization_id text NOT NULL,
  id text NOT NULL,
  case_id text NOT NULL,
  patient_id text NOT NULL,
  root_document_id text NOT NULL,
  document_version integer NOT NULL CHECK (document_version > 0),
  status text NOT NULL CHECK (status IN ('DRAFT','SIGNED')),
  body jsonb NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  signed_by text,
  signed_at timestamptz,
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,root_document_id,document_version),
  FOREIGN KEY (organization_id,case_id)
    REFERENCES analiza.hospitalizations(organization_id,id),
  FOREIGN KEY (organization_id,patient_id)
    REFERENCES analiza.patients(organization_id,id),
  FOREIGN KEY (created_by,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id),
  FOREIGN KEY (signed_by,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id),
  CHECK (
    (status='DRAFT' AND signed_by IS NULL AND signed_at IS NULL)
    OR
    (status='SIGNED' AND signed_by IS NOT NULL AND signed_at IS NOT NULL)
  )
);

CREATE INDEX clinical_documents_case_time
  ON analiza.clinical_documents(organization_id,case_id,created_at DESC);

ALTER TABLE analiza.clinical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.clinical_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.clinical_documents
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));

CREATE FUNCTION analiza.enforce_clinical_document_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> 'DRAFT' OR NEW.status <> 'SIGNED'
     OR NEW.organization_id <> OLD.organization_id
     OR NEW.id <> OLD.id
     OR NEW.case_id <> OLD.case_id
     OR NEW.patient_id <> OLD.patient_id
     OR NEW.root_document_id <> OLD.root_document_id
     OR NEW.document_version <> OLD.document_version
     OR NEW.body <> OLD.body
     OR NEW.created_by <> OLD.created_by
     OR NEW.created_at <> OLD.created_at
     OR NEW.signed_by IS NULL
     OR NEW.signed_at IS NULL THEN
    RAISE EXCEPTION 'Clinical documents are immutable after creation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clinical_documents_immutable
BEFORE UPDATE ON analiza.clinical_documents
FOR EACH ROW EXECUTE FUNCTION analiza.enforce_clinical_document_immutability();
