CREATE TABLE analiza.warehouses (
  organization_id text NOT NULL,
  id text NOT NULL,
  code_normalized text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','INACTIVE')),
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,code_normalized),
  CHECK (body->>'id'=id),
  CHECK (upper(btrim(body->>'code'))=code_normalized),
  CHECK (body->>'status'=status)
);

CREATE INDEX warehouses_status_name
  ON analiza.warehouses(organization_id,status,lower(body->>'name'),id);

WITH warehouse_history AS (
  SELECT
    organization_id,
    warehouse_id,
    min(created_at) AS first_movement_at,
    max(created_at) AS last_movement_at,
    row_number() OVER (
      PARTITION BY organization_id,upper(btrim(warehouse_id))
      ORDER BY warehouse_id
    ) AS normalized_rank
  FROM analiza.inventory_movements
  GROUP BY organization_id,warehouse_id
), normalized_warehouses AS (
  SELECT
    *,
    CASE
      WHEN normalized_rank=1 AND char_length(warehouse_id) BETWEEN 2 AND 40 THEN warehouse_id
      ELSE left(warehouse_id,30) || '-' || substr(md5(warehouse_id),1,8)
    END AS warehouse_code
  FROM warehouse_history
)
INSERT INTO analiza.warehouses(
  organization_id,id,code_normalized,status,body,created_at,updated_at
)
SELECT
  organization_id,
  warehouse_id,
  upper(btrim(warehouse_code)),
  'ACTIVE',
  jsonb_build_object(
    'id',warehouse_id,
    'code',warehouse_code,
    'name',left(warehouse_id,120),
    'status','ACTIVE',
    'createdAt',to_char(first_movement_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt',to_char(last_movement_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ),
  first_movement_at,
  last_movement_at
FROM normalized_warehouses
ON CONFLICT (organization_id,id) DO NOTHING;

CREATE TABLE analiza.inventory_transfers (
  organization_id text NOT NULL,
  id text NOT NULL,
  item_id text NOT NULL,
  source_warehouse_id text NOT NULL,
  destination_warehouse_id text NOT NULL,
  idempotency_key text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (organization_id,item_id)
    REFERENCES analiza.catalog_items(organization_id,id),
  FOREIGN KEY (organization_id,source_warehouse_id)
    REFERENCES analiza.warehouses(organization_id,id),
  FOREIGN KEY (organization_id,destination_warehouse_id)
    REFERENCES analiza.warehouses(organization_id,id),
  CHECK (source_warehouse_id <> destination_warehouse_id),
  CHECK (body->>'id'=id),
  CHECK (body->>'itemId'=item_id),
  CHECK (body->>'sourceWarehouseId'=source_warehouse_id),
  CHECK (body->>'destinationWarehouseId'=destination_warehouse_id)
);

CREATE INDEX inventory_transfers_item_time
  ON analiza.inventory_transfers(organization_id,item_id,created_at,id);
CREATE INDEX inventory_transfers_source_time
  ON analiza.inventory_transfers(organization_id,source_warehouse_id,created_at,id);
CREATE INDEX inventory_transfers_destination_time
  ON analiza.inventory_transfers(organization_id,destination_warehouse_id,created_at,id);

ALTER TABLE analiza.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.warehouses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.warehouses
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));

ALTER TABLE analiza.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.inventory_transfers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.inventory_transfers
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
