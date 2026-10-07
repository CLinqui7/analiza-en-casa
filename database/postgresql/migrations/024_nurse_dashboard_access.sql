-- Dashboard access is account-specific for nurses. Other roles retain their existing access.
-- New nurse memberships start without the Dashboard; grant access explicitly per account.
ALTER TABLE analiza.memberships
  ADD COLUMN IF NOT EXISTS dashboard_access boolean NOT NULL DEFAULT false;
