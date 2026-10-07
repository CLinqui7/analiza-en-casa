-- Legacy drafts keep NULL: their physical destination was never recorded.
ALTER TABLE analiza.purchases
  ADD COLUMN warehouse_id text;

ALTER TABLE analiza.purchases
  ADD CONSTRAINT purchases_warehouse_fk
  FOREIGN KEY (organization_id,warehouse_id)
  REFERENCES analiza.warehouses(organization_id,id),
  ADD CONSTRAINT purchases_warehouse_body_check
  CHECK (
    (warehouse_id IS NULL AND NOT body ? 'warehouseId')
    OR (warehouse_id IS NOT NULL AND body->>'warehouseId'=warehouse_id)
  );

CREATE INDEX purchases_warehouse_time
  ON analiza.purchases(organization_id,warehouse_id,created_at DESC,id)
  WHERE warehouse_id IS NOT NULL;
