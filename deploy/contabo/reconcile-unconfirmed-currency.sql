-- One-time, guarded repair for the official Contabo staging import only.
-- Source prices remain unchanged in import_records; the USD operational field
-- is removed until the client confirms currency and rounding.
BEGIN;
DO $$
DECLARE
  source_batch record;
  expected integer;
  changed integer;
BEGIN
  SELECT organization_id,id,imported_by INTO source_batch
  FROM analiza.import_batches
  WHERE source_sha256='56acf4489cc5cd3652c735763ea6f72408458ae85e93282ab5cb37ec5715d012';
  IF (SELECT count(*) FROM analiza.import_batches
      WHERE source_sha256='56acf4489cc5cd3652c735763ea6f72408458ae85e93282ab5cb37ec5715d012') <> 1
  THEN RAISE EXCEPTION 'Expected exactly one official staging import batch'; END IF;

  SELECT count(*) INTO expected
  FROM analiza.catalog_items c
  JOIN analiza.import_records r ON r.organization_id=c.organization_id AND r.record_id=c.id
  WHERE r.organization_id=source_batch.organization_id AND r.batch_id=source_batch.id
    AND r.dataset='SERVICES' AND coalesce(r.body->>'moneda','') <> 'USD'
    AND c.body->>'status'='INACTIVE' AND c.body ? 'salePriceExcludingTax';
  IF expected <> 47 THEN RAISE EXCEPTION 'Expected 47 inactive service prices, found %',expected; END IF;

  UPDATE analiza.catalog_items c SET body=c.body-'salePriceExcludingTax'
  FROM analiza.import_records r
  WHERE r.organization_id=c.organization_id AND r.record_id=c.id
    AND r.organization_id=source_batch.organization_id AND r.batch_id=source_batch.id
    AND r.dataset='SERVICES' AND coalesce(r.body->>'moneda','') <> 'USD'
    AND c.body->>'status'='INACTIVE' AND c.body ? 'salePriceExcludingTax';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed <> 47 THEN RAISE EXCEPTION 'Currency repair changed % rows',changed; END IF;

  INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id)
  VALUES(source_batch.organization_id,gen_random_uuid()::text,source_batch.imported_by,
    'catalog.currency_unconfirmed_reconciled','import_batches',source_batch.id);
END $$;
COMMIT;
