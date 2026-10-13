ALTER TABLE analiza.import_batches ADD COLUMN source_sha256 text
  CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$');
CREATE UNIQUE INDEX import_batches_org_source ON analiza.import_batches(organization_id,source_sha256)
  WHERE source_sha256 IS NOT NULL;
ALTER TABLE analiza.import_records DROP CONSTRAINT import_records_source_row_check;
ALTER TABLE analiza.import_records ADD CONSTRAINT import_records_source_row_check CHECK(source_row >= 1);

CREATE TABLE analiza.import_record_links (
  organization_id text NOT NULL,
  source_dataset text NOT NULL,
  source_record_id text NOT NULL,
  relation text NOT NULL,
  target_dataset text NOT NULL,
  target_record_id text NOT NULL,
  PRIMARY KEY(organization_id,source_dataset,source_record_id,relation),
  FOREIGN KEY(organization_id,source_dataset,source_record_id)
    REFERENCES analiza.import_records(organization_id,dataset,record_id),
  FOREIGN KEY(organization_id,target_dataset,target_record_id)
    REFERENCES analiza.import_records(organization_id,dataset,record_id)
);
ALTER TABLE analiza.import_record_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.import_record_links FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.import_record_links
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
