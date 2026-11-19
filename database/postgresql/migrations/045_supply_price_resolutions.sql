-- One final catalogue decision per pending request line, including an explicitly confirmed zero.
CREATE TABLE IF NOT EXISTS analiza.supply_price_resolutions (
  organization_id text NOT NULL,
  request_id text NOT NULL,
  quote_id text NOT NULL,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  actor_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,request_id),
  FOREIGN KEY (organization_id,request_id) REFERENCES analiza.supply_request_assignments(organization_id,request_id),
  FOREIGN KEY (organization_id,quote_id) REFERENCES analiza.quotes(organization_id,id)
);
ALTER TABLE analiza.supply_price_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.supply_price_resolutions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON analiza.supply_price_resolutions;
CREATE POLICY tenant_scope ON analiza.supply_price_resolutions
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
CREATE INDEX IF NOT EXISTS supply_request_by_catalog
  ON analiza.supply_requests(organization_id,catalog_item_id,id);
CREATE INDEX IF NOT EXISTS supply_pending_price_audit
  ON analiza.audit_events(organization_id,resource_id)
  WHERE action='SUPPLY_REQUEST_PRICE_PENDING' AND resource_type='supply_request';
