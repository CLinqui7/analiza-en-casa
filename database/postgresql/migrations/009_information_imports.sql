CREATE TABLE analiza.import_batches (
  organization_id text NOT NULL REFERENCES analiza.organizations(id),
  id text NOT NULL,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  imported_by text NOT NULL REFERENCES analiza.users(id),
  total_rows integer NOT NULL CHECK (total_rows > 0 AND total_rows <= 2000),
  counts jsonb NOT NULL CHECK (jsonb_typeof(counts) = 'object'),
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id)
);

CREATE INDEX import_batches_org_time
  ON analiza.import_batches(organization_id,imported_at DESC);

CREATE TABLE analiza.import_records (
  organization_id text NOT NULL REFERENCES analiza.organizations(id),
  dataset text NOT NULL CHECK (
    dataset IN ('SERVICES','SUPPLIERS','INSURERS','PRODUCTS','RATES','SUPPLIER_PURCHASES','STAFF')
  ),
  record_id text NOT NULL CHECK (char_length(record_id) BETWEEN 1 AND 120),
  batch_id text NOT NULL,
  source_sheet text NOT NULL,
  source_row integer NOT NULL CHECK (source_row >= 6),
  body jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object'),
  imported_by text NOT NULL REFERENCES analiza.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,dataset,record_id),
  FOREIGN KEY (organization_id,batch_id)
    REFERENCES analiza.import_batches(organization_id,id)
);

CREATE INDEX import_records_batch
  ON analiza.import_records(organization_id,batch_id,dataset);

ALTER TABLE analiza.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.import_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.import_batches
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));

ALTER TABLE analiza.import_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.import_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.import_records
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
