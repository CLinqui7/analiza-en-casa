CREATE TABLE IF NOT EXISTS analiza.quote_decisions (
  organization_id text NOT NULL,
  id uuid NOT NULL,
  quote_id text NOT NULL,
  actor_user_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('APPROVED', 'NOT_APPROVED')),
  reason text CHECK (reason IN ('COST', 'DEATH', 'INSURER_NOT_APPROVED', 'OUT_OF_COVERAGE', 'CONTINUE_IN_HOSPITAL')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (organization_id,quote_id) REFERENCES analiza.quotes(organization_id,id),
  CONSTRAINT quote_decisions_state_reason_check CHECK (
    (decision='APPROVED' AND reason IS NULL) OR
    (decision='NOT_APPROVED' AND reason IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS quote_decisions_quote_time
  ON analiza.quote_decisions (organization_id,quote_id,created_at DESC,id DESC);
ALTER TABLE analiza.quote_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.quote_decisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON analiza.quote_decisions;
CREATE POLICY tenant_scope ON analiza.quote_decisions
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
