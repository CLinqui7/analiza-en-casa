CREATE TABLE IF NOT EXISTS analiza.purchase_orders (
  organization_id text NOT NULL,
  id uuid NOT NULL,
  created_by text NOT NULL,
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  CONSTRAINT purchase_orders_body_size CHECK (octet_length(body::text) <= 262144)
);

CREATE INDEX IF NOT EXISTS purchase_orders_org_date
  ON analiza.purchase_orders (organization_id, created_at DESC);

ALTER TABLE analiza.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.purchase_orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_purchase_orders ON analiza.purchase_orders;
CREATE POLICY organization_purchase_orders ON analiza.purchase_orders
  USING (organization_id = nullif(current_setting('analiza.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id', true), ''));
