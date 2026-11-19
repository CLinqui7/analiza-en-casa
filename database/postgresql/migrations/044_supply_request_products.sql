-- The first product retains the original request identity. All subsequent products
-- share its header and retain individual assignment/audit identities.
ALTER TABLE analiza.supply_requests ADD COLUMN IF NOT EXISTS group_id text;
ALTER TABLE analiza.supply_requests ADD COLUMN IF NOT EXISTS product_position integer NOT NULL DEFAULT 0;
ALTER TABLE analiza.supply_requests ALTER COLUMN catalog_item_id DROP NOT NULL;
ALTER TABLE analiza.supply_requests ADD COLUMN IF NOT EXISTS fee_service text;
ALTER TABLE analiza.supply_requests ADD COLUMN IF NOT EXISTS fee_amount numeric;
ALTER TABLE analiza.supply_requests ADD COLUMN IF NOT EXISTS added_in_review boolean NOT NULL DEFAULT false;
DO $migration$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='supply_request_group_fk' AND conrelid='analiza.supply_requests'::regclass) THEN
    ALTER TABLE analiza.supply_requests ADD CONSTRAINT supply_request_group_fk
      FOREIGN KEY (organization_id,group_id) REFERENCES analiza.supply_requests(organization_id,id),
      ADD CONSTRAINT supply_request_product_source CHECK (
        (catalog_item_id IS NOT NULL AND fee_service IS NULL AND fee_amount IS NULL) OR
        (catalog_item_id IS NULL AND fee_service IS NOT NULL AND fee_service IN ('Visita','Seguimiento') AND fee_amount IS NOT NULL AND fee_amount >= 0)),
      ADD CONSTRAINT supply_request_group_position CHECK (
        (group_id IS NULL AND product_position=0) OR
        (group_id IS NOT NULL AND group_id<>id AND product_position>0));
  END IF;
END $migration$;
CREATE UNIQUE INDEX IF NOT EXISTS supply_request_group_position_idx
  ON analiza.supply_requests(organization_id,group_id,product_position) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS supply_request_group_inbox
  ON analiza.supply_requests(organization_id,created_at DESC,id) WHERE group_id IS NULL;

ALTER TABLE analiza.supply_request_assignments ADD COLUMN IF NOT EXISTS command_hash text;
