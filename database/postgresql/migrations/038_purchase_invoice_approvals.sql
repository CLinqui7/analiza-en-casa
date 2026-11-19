CREATE TABLE IF NOT EXISTS analiza.purchase_invoice_approvals (
  organization_id text NOT NULL,
  invoice_group_id text NOT NULL,
  purchase_order_id uuid,
  invoice_number text NOT NULL,
  supplier_catalog_item_id text NOT NULL,
  total_cents bigint NOT NULL CHECK (total_cents >= 0),
  approved_by text NOT NULL REFERENCES analiza.users(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, invoice_group_id),
  FOREIGN KEY (organization_id, purchase_order_id)
    REFERENCES analiza.purchase_orders(organization_id, id)
);

CREATE INDEX IF NOT EXISTS purchase_invoice_approvals_order_idx
  ON analiza.purchase_invoice_approvals(organization_id, purchase_order_id);

ALTER TABLE analiza.purchase_invoice_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.purchase_invoice_approvals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON analiza.purchase_invoice_approvals;
CREATE POLICY tenant_scope ON analiza.purchase_invoice_approvals
  USING (organization_id = nullif(current_setting('analiza.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id', true), ''));
