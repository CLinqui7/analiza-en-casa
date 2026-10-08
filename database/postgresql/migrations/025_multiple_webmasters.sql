-- Multiple explicitly provisioned WEBMASTER accounts may coexist in one organization.
-- Each still requires an active membership and server-side authorization.
DROP INDEX IF EXISTS analiza.memberships_single_active_webmaster;
