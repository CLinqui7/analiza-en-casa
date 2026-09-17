DROP TRIGGER IF EXISTS memberships_designated_admin ON analiza.memberships;
DROP FUNCTION IF EXISTS analiza.enforce_designated_admin();

ALTER TABLE analiza.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE analiza.memberships
  ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('ADMIN','MANAGER','DOCTOR','NURSE','NURSE_MANAGER','INVENTORY','FINANCE','AUDITOR'));

UPDATE analiza.memberships AS membership
SET role = 'ADMIN'
FROM analiza.users AS account
WHERE account.id = membership.user_id
  AND account.email_normalized IN ('linquicarloss@gmail.com', 'pruebaadmin@analiza.com');
