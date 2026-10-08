-- A full-workspace administrator may be excluded from the Dashboard without
-- losing any of the other administrator permissions. Existing accounts keep
-- their current Dashboard access unless explicitly changed by an operator.
ALTER TABLE analiza.memberships
  ADD COLUMN IF NOT EXISTS dashboard_restricted boolean NOT NULL DEFAULT false;

-- Append-only evidence for explicitly authorized membership changes. The
-- operator identity is recorded as an operator label, never impersonated as an
-- application user. No patient or clinical data is stored here.
CREATE TABLE analiza.membership_access_changes (
  organization_id text NOT NULL,
  id text NOT NULL,
  target_user_id text NOT NULL,
  previous_role text NOT NULL,
  next_role text NOT NULL,
  previous_dashboard_restricted boolean NOT NULL,
  next_dashboard_restricted boolean NOT NULL,
  operator_label text NOT NULL,
  source_reference text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (target_user_id,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id)
);
CREATE INDEX membership_access_changes_target_time
  ON analiza.membership_access_changes(organization_id,target_user_id,occurred_at DESC);
ALTER TABLE analiza.membership_access_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.membership_access_changes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.membership_access_changes
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
