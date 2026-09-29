CREATE TABLE analiza.inventory_trace_records (
  organization_id text NOT NULL,
  id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('LOT','SERIAL')),
  item_id text NOT NULL,
  supplier_catalog_item_id text NOT NULL,
  number_normalized text NOT NULL,
  quality_status text NOT NULL CHECK (quality_status IN ('QUARANTINED','AVAILABLE','BLOCKED','REJECTED')),
  expires_on date,
  received_at timestamptz NOT NULL,
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (organization_id,item_id)
    REFERENCES analiza.catalog_items(organization_id,id),
  FOREIGN KEY (organization_id,supplier_catalog_item_id)
    REFERENCES analiza.catalog_items(organization_id,id),
  CHECK (body->>'id'=id),
  CHECK (body->>'kind'=kind),
  CHECK (body->>'itemId'=item_id),
  CHECK (body->>'supplierCatalogItemId'=supplier_catalog_item_id),
  CHECK (upper(btrim(body->>'number'))=number_normalized),
  CHECK (body->>'qualityStatus'=quality_status),
  CHECK ((kind='LOT' AND expires_on IS NOT NULL) OR (kind='SERIAL' AND expires_on IS NULL))
);

CREATE UNIQUE INDEX inventory_trace_serial_unique
  ON analiza.inventory_trace_records(organization_id,number_normalized)
  WHERE kind='SERIAL';
CREATE INDEX inventory_trace_item_fefo
  ON analiza.inventory_trace_records(
    organization_id,item_id,quality_status,expires_on,received_at,id
  );
CREATE INDEX inventory_trace_supplier
  ON analiza.inventory_trace_records(organization_id,supplier_catalog_item_id,received_at,id);

CREATE TABLE analiza.inventory_trace_balances (
  organization_id text NOT NULL,
  trace_record_id text NOT NULL,
  warehouse_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,trace_record_id,warehouse_id),
  FOREIGN KEY (organization_id,trace_record_id)
    REFERENCES analiza.inventory_trace_records(organization_id,id),
  FOREIGN KEY (organization_id,warehouse_id)
    REFERENCES analiza.warehouses(organization_id,id)
);
CREATE INDEX inventory_trace_balances_warehouse
  ON analiza.inventory_trace_balances(organization_id,warehouse_id,trace_record_id)
  INCLUDE (quantity);

CREATE TABLE analiza.inventory_trace_events (
  organization_id text NOT NULL,
  id text NOT NULL,
  trace_record_id text,
  event_type text NOT NULL CHECK (
    event_type IN ('RECEIVED','RELEASED','BLOCKED','REJECTED','TRANSFERRED','ISSUED')
  ),
  idempotency_key text NOT NULL,
  body jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (organization_id,trace_record_id)
    REFERENCES analiza.inventory_trace_records(organization_id,id)
);
CREATE INDEX inventory_trace_events_record_time
  ON analiza.inventory_trace_events(organization_id,trace_record_id,occurred_at,id);

ALTER TABLE analiza.inventory_movements ADD COLUMN trace_record_id text;
ALTER TABLE analiza.inventory_movements
  ADD CONSTRAINT inventory_movements_trace_record_fk
  FOREIGN KEY (organization_id,trace_record_id)
  REFERENCES analiza.inventory_trace_records(organization_id,id);
ALTER TABLE analiza.inventory_movements
  ADD CONSTRAINT inventory_movements_trace_body_check
  CHECK (trace_record_id IS NULL OR body->>'traceRecordId'=trace_record_id);
CREATE INDEX inventory_movements_trace_time
  ON analiza.inventory_movements(organization_id,trace_record_id,created_at,id)
  WHERE trace_record_id IS NOT NULL;

ALTER TABLE analiza.inventory_trace_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.inventory_trace_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.inventory_trace_records
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));

ALTER TABLE analiza.inventory_trace_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.inventory_trace_balances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.inventory_trace_balances
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));

ALTER TABLE analiza.inventory_trace_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.inventory_trace_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.inventory_trace_events
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
