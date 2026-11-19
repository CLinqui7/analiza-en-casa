CREATE TABLE IF NOT EXISTS analiza.purchase_order_revisions (
  organization_id text NOT NULL,
  order_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  actor_user_id text NOT NULL REFERENCES analiza.users(id),
  action text NOT NULL CHECK (action IN ('edit','approve','receive','cancel')),
  previous_body jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,order_id,revision),
  FOREIGN KEY (organization_id,order_id) REFERENCES analiza.purchase_orders(organization_id,id)
);
ALTER TABLE analiza.purchase_order_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.purchase_order_revisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON analiza.purchase_order_revisions;
CREATE POLICY tenant_scope ON analiza.purchase_order_revisions
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));

CREATE INDEX IF NOT EXISTS purchases_order_lookup
  ON analiza.purchases (organization_id, (body->>'purchaseOrderId'))
  WHERE body ? 'purchaseOrderId';
CREATE INDEX IF NOT EXISTS purchases_supplier_document_lookup
  ON analiza.purchases (organization_id,(body->>'supplierCatalogItemId'),(coalesce(body->>'providerDocumentKind','INVOICE')),(upper(btrim(body->>'invoiceNumber'))));
