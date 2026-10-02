-- A new patient may receive a quote before any hospitalization exists. The patient remains
-- mandatory; an optional case, when present, must still belong to the same organization/patient.
ALTER TABLE analiza.quotes DROP CONSTRAINT IF EXISTS quotes_organization_id_case_id_fkey;
ALTER TABLE analiza.quotes ALTER COLUMN case_id DROP NOT NULL;
ALTER TABLE analiza.quotes DROP CONSTRAINT IF EXISTS quotes_body_check;
ALTER TABLE analiza.quotes
  ADD CONSTRAINT quotes_body_check CHECK (
    jsonb_typeof(body) = 'object'
    AND body->>'id' = id
    AND body->>'patientId' = patient_id
    AND (
      (case_id IS NULL AND NOT body ? 'caseId')
      OR (case_id IS NOT NULL AND body->>'caseId' = case_id)
    )
  );
ALTER TABLE analiza.quotes
  ADD CONSTRAINT quotes_organization_id_case_id_fkey
  FOREIGN KEY (organization_id,case_id)
  REFERENCES analiza.hospitalizations(organization_id,id);
