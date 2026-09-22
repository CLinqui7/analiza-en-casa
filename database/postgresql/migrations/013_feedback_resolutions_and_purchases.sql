ALTER TABLE analiza.feedback_reports
  ADD COLUMN IF NOT EXISTS resolution_comment text,
  ADD COLUMN IF NOT EXISTS resolution_path text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE analiza.feedback_reports
  DROP CONSTRAINT IF EXISTS feedback_reports_resolution_comment_check,
  ADD CONSTRAINT feedback_reports_resolution_comment_check
    CHECK (resolution_comment IS NULL OR char_length(resolution_comment) BETWEEN 1 AND 4000),
  DROP CONSTRAINT IF EXISTS feedback_reports_resolution_path_check,
  ADD CONSTRAINT feedback_reports_resolution_path_check
    CHECK (resolution_path IS NULL OR (char_length(resolution_path) BETWEEN 1 AND 500 AND resolution_path LIKE '/%'));

CREATE TABLE IF NOT EXISTS analiza.purchases (
  organization_id text NOT NULL,
  id text NOT NULL,
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id)
);

CREATE INDEX IF NOT EXISTS purchases_time
  ON analiza.purchases(organization_id,created_at DESC);

ALTER TABLE analiza.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.purchases FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON analiza.purchases;
CREATE POLICY tenant_scope ON analiza.purchases
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
