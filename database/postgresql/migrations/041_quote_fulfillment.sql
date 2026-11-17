CREATE TABLE IF NOT EXISTS analiza.supply_request_assignments (
  organization_id text NOT NULL REFERENCES analiza.organizations(id),
  request_id text NOT NULL,
  idempotency_key uuid NOT NULL,
  source_quote_id text NOT NULL,
  quote_id text NOT NULL,
  root_quote_id text NOT NULL,
  line_id text NOT NULL,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  actor_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,request_id),
  UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (organization_id,request_id) REFERENCES analiza.supply_requests(organization_id,id),
  FOREIGN KEY (organization_id,source_quote_id) REFERENCES analiza.quotes(organization_id,id),
  FOREIGN KEY (organization_id,quote_id) REFERENCES analiza.quotes(organization_id,id),
  FOREIGN KEY (organization_id,root_quote_id) REFERENCES analiza.quotes(organization_id,id)
);
CREATE TABLE IF NOT EXISTS analiza.received_order_deliveries (
  organization_id text NOT NULL REFERENCES analiza.organizations(id),
  id uuid NOT NULL,
  quote_id text NOT NULL,
  root_quote_id text NOT NULL,
  line_id text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  nursing_resource_id text NOT NULL,
  actor_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (organization_id,quote_id) REFERENCES analiza.quotes(organization_id,id),
  FOREIGN KEY (organization_id,root_quote_id) REFERENCES analiza.quotes(organization_id,id),
  FOREIGN KEY (organization_id,nursing_resource_id) REFERENCES analiza.nursing_resources(organization_id,id)
);
CREATE INDEX IF NOT EXISTS received_order_line ON analiza.received_order_deliveries(organization_id,root_quote_id,line_id);
DO $migration$
DECLARE relation text;
BEGIN
  FOREACH relation IN ARRAY ARRAY['supply_request_assignments','received_order_deliveries'] LOOP
    EXECUTE format('ALTER TABLE analiza.%I ENABLE ROW LEVEL SECURITY', relation);
    EXECUTE format('ALTER TABLE analiza.%I FORCE ROW LEVEL SECURITY', relation);
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON analiza.%I', relation);
    EXECUTE format('CREATE POLICY tenant_scope ON analiza.%I USING (organization_id = nullif(current_setting(''analiza.organization_id'',true),'''')) WITH CHECK (organization_id = nullif(current_setting(''analiza.organization_id'',true),''''))', relation);
  END LOOP;
END $migration$;
