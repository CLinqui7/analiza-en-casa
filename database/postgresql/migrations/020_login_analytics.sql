-- Successful-login analytics. This ledger deliberately excludes passwords, IP addresses,
-- user-agent strings and clinical/business payloads.
ALTER TABLE analiza.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE analiza.memberships
  ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('ADMIN','MANAGER','DOCTOR','NURSE','NURSE_MANAGER','INVENTORY','FINANCE','AUDITOR','ANALYTICS'));

CREATE UNIQUE INDEX memberships_single_active_analytics
  ON analiza.memberships(organization_id)
  WHERE active AND role='ANALYTICS';

CREATE TABLE analiza.login_events (
  organization_id text NOT NULL REFERENCES analiza.organizations(id),
  id uuid NOT NULL,
  user_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (user_id,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id)
);
CREATE INDEX login_events_org_user_time
  ON analiza.login_events(organization_id,user_id,occurred_at DESC);
CREATE INDEX login_events_org_time
  ON analiza.login_events(organization_id,occurred_at DESC);

ALTER TABLE analiza.login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.login_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.login_events
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));

