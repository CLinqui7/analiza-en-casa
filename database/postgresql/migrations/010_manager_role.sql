ALTER TABLE analiza.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE analiza.memberships
  ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('ADMIN','MANAGER','DOCTOR','NURSE','NURSE_MANAGER','INVENTORY','FINANCE','AUDITOR'));
