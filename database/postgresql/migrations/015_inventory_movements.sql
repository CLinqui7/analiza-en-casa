CREATE TABLE analiza.inventory_movements (
  organization_id text NOT NULL,
  id text NOT NULL,
  item_id text NOT NULL,
  warehouse_id text NOT NULL,
  idempotency_key text NOT NULL,
  delta integer NOT NULL CHECK (delta <> 0),
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (organization_id,item_id)
    REFERENCES analiza.catalog_items(organization_id,id),
  CHECK (body->>'id'=id),
  CHECK (body->>'itemId'=item_id),
  CHECK (body->>'warehouseId'=warehouse_id)
);

CREATE INDEX inventory_movements_item_time
  ON analiza.inventory_movements(organization_id,item_id,warehouse_id,created_at,id);

ALTER TABLE analiza.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.inventory_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.inventory_movements
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
