-- Manual one-person survey links may be handed to a person who is not yet in the directory.
ALTER TABLE analiza.survey_invitations
  ALTER COLUMN target_id DROP NOT NULL,
  ALTER COLUMN consent_attested_at DROP DEFAULT,
  ALTER COLUMN consent_attested_at DROP NOT NULL;

ALTER TABLE analiza.survey_invitations
  ADD COLUMN respondent_name text,
  ADD CONSTRAINT survey_respondent_name_check
    CHECK (respondent_name IS NULL OR length(btrim(respondent_name)) BETWEEN 2 AND 120);
