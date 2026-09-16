UPDATE analiza.memberships
SET role = 'ADMIN'
WHERE role <> 'ADMIN';

CREATE OR REPLACE FUNCTION analiza.force_admin_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, analiza
AS $$
BEGIN
  NEW.role := 'ADMIN';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION analiza.force_admin_membership() FROM PUBLIC;

DROP TRIGGER IF EXISTS memberships_force_admin ON analiza.memberships;
CREATE TRIGGER memberships_force_admin
BEFORE INSERT OR UPDATE OF role ON analiza.memberships
FOR EACH ROW
EXECUTE FUNCTION analiza.force_admin_membership();
