DROP TRIGGER IF EXISTS memberships_force_admin ON analiza.memberships;
DROP FUNCTION IF EXISTS analiza.force_admin_membership();

UPDATE analiza.memberships AS membership
SET role = CASE
  WHEN account.email_normalized = 'pruebaadmin@analiza.com' THEN 'ADMIN'
  ELSE 'NURSE'
END
FROM analiza.users AS account
WHERE account.id = membership.user_id;

CREATE OR REPLACE FUNCTION analiza.enforce_designated_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, analiza
AS $$
DECLARE
  account_email text;
BEGIN
  SELECT email_normalized INTO account_email
  FROM analiza.users
  WHERE id = NEW.user_id;

  IF account_email = 'pruebaadmin@analiza.com' THEN
    NEW.role := 'ADMIN';
  ELSIF NEW.role = 'ADMIN' THEN
    NEW.role := 'NURSE';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION analiza.enforce_designated_admin() FROM PUBLIC;

CREATE TRIGGER memberships_designated_admin
BEFORE INSERT OR UPDATE OF role ON analiza.memberships
FOR EACH ROW
EXECUTE FUNCTION analiza.enforce_designated_admin();
