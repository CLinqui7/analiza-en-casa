-- Private documents stay on their authorized patient, with an explicit dependent association.
ALTER TABLE analiza.file_metadata ADD COLUMN IF NOT EXISTS dependent_id uuid;
ALTER TABLE analiza.file_metadata ADD COLUMN IF NOT EXISTS document_kind text;
ALTER TABLE analiza.file_metadata DROP CONSTRAINT IF EXISTS file_dependent_document_check;
ALTER TABLE analiza.file_metadata ADD CONSTRAINT file_dependent_document_check CHECK (
  (dependent_id IS NULL AND document_kind IS NULL) OR
  (owner_type='patient' AND dependent_id IS NOT NULL AND document_kind IS NOT NULL
   AND document_kind IN ('BIRTH_CERTIFICATE','CONSENT'))
);
