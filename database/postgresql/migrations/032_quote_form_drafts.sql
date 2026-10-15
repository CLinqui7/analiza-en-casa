CREATE TABLE IF NOT EXISTS analiza.quote_form_drafts (
  organization_id text NOT NULL,
  user_id text NOT NULL,
  draft_key text NOT NULL,
  body jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, draft_key),
  CONSTRAINT quote_form_drafts_key_length CHECK (char_length(draft_key) BETWEEN 1 AND 200),
  CONSTRAINT quote_form_drafts_body_size CHECK (octet_length(body::text) <= 65536)
);

ALTER TABLE analiza.quote_form_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.quote_form_drafts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_quote_form_draft ON analiza.quote_form_drafts;
CREATE POLICY own_quote_form_draft ON analiza.quote_form_drafts
  USING (
    organization_id = nullif(current_setting('analiza.organization_id', true), '')
    AND user_id = nullif(current_setting('analiza.user_id', true), '')
  )
  WITH CHECK (
    organization_id = nullif(current_setting('analiza.organization_id', true), '')
    AND user_id = nullif(current_setting('analiza.user_id', true), '')
  );
