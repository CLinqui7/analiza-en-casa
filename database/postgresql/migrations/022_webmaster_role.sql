-- Additive administrative role for the private operational webmaster account.
-- WEBMASTER inherits application-level ADMIN permissions plus login analytics access.
ALTER TABLE analiza.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE analiza.memberships
  ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('ADMIN','MANAGER','DOCTOR','NURSE','NURSE_MANAGER','INVENTORY','FINANCE','AUDITOR','ANALYTICS','WEBMASTER'));

CREATE UNIQUE INDEX memberships_single_active_webmaster
  ON analiza.memberships(organization_id)
  WHERE active AND role='WEBMASTER';
