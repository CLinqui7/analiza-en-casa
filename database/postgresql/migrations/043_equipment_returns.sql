CREATE TABLE IF NOT EXISTS analiza.equipment_returns (
  organization_id text NOT NULL,
  id uuid NOT NULL,
  custody_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  received_at timestamptz NOT NULL,
  received_by text NOT NULL,
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (organization_id,custody_id) REFERENCES analiza.home_custodies(organization_id,id)
);
ALTER TABLE analiza.equipment_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.equipment_returns FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON analiza.equipment_returns;
CREATE POLICY tenant_scope ON analiza.equipment_returns USING (
  organization_id = nullif(current_setting('analiza.organization_id',true),'')
) WITH CHECK (
  organization_id = nullif(current_setting('analiza.organization_id',true),'')
);
