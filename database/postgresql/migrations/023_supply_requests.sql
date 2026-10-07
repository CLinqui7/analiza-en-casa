-- Internal nursing requests; no external notification or clinical instructions are sent.
CREATE TABLE IF NOT EXISTS analiza.supply_requests (
  organization_id text NOT NULL REFERENCES analiza.organizations(id),
  id text NOT NULL,
  idempotency_key text NOT NULL,
  requested_by text NOT NULL,
  patient_id text NOT NULL,
  catalog_item_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
  priority text NOT NULL CHECK (priority IN ('LOW','MEDIUM','HIGH')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status = 'RECEIVED'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (requested_by,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id),
  FOREIGN KEY (organization_id,patient_id)
    REFERENCES analiza.patients(organization_id,id),
  FOREIGN KEY (organization_id,catalog_item_id)
    REFERENCES analiza.catalog_items(organization_id,id)
);

CREATE INDEX IF NOT EXISTS supply_requests_inbox
  ON analiza.supply_requests(organization_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS supply_requests_requester
  ON analiza.supply_requests(organization_id,requested_by,created_at DESC);

ALTER TABLE analiza.supply_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.supply_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON analiza.supply_requests;
CREATE POLICY tenant_scope ON analiza.supply_requests
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
