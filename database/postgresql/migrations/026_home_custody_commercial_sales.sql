-- Home custody stays separate from sellable warehouse stock. Commercial metrics are
-- based on explicit, referenced confirmations, never inferred from sent quotes.
CREATE TABLE analiza.home_custodies (
  organization_id text NOT NULL REFERENCES analiza.organizations(id),
  id text NOT NULL, patient_id text NOT NULL, item_id text NOT NULL,
  warehouse_id text NOT NULL, idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  body jsonb NOT NULL CHECK (body->>'id'=id AND body->>'patientId'=patient_id),
  sent_at timestamptz NOT NULL, closed_at timestamptz,
  PRIMARY KEY (organization_id,id), UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (organization_id,patient_id) REFERENCES analiza.patients(organization_id,id),
  FOREIGN KEY (organization_id,item_id) REFERENCES analiza.catalog_items(organization_id,id),
  FOREIGN KEY (organization_id,warehouse_id) REFERENCES analiza.warehouses(organization_id,id)
);
CREATE INDEX home_custodies_patient_time ON analiza.home_custodies(organization_id,patient_id,sent_at DESC);
CREATE TABLE analiza.home_return_holds (
  organization_id text NOT NULL, id text NOT NULL, custody_id text NOT NULL,
  item_id text NOT NULL, quantity integer NOT NULL CHECK(quantity > 0),
  condition_note text NOT NULL, received_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id,id), UNIQUE (organization_id,custody_id),
  FOREIGN KEY (organization_id,custody_id) REFERENCES analiza.home_custodies(organization_id,id),
  FOREIGN KEY (organization_id,item_id) REFERENCES analiza.catalog_items(organization_id,id)
);
CREATE TABLE analiza.commercial_access (
  organization_id text NOT NULL, user_id text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('REP','MANAGER')),
  PRIMARY KEY (organization_id,user_id),
  FOREIGN KEY (user_id,organization_id) REFERENCES analiza.memberships(user_id,organization_id)
);
INSERT INTO analiza.commercial_access(organization_id,user_id,scope)
SELECT m.organization_id,m.user_id,
  CASE WHEN u.email_normalized IN ('sissy.chavez@labanaliza.com','sissy.chavez@analizaencasa.com')
    THEN 'MANAGER' ELSE 'REP' END
FROM analiza.memberships m JOIN analiza.users u ON u.id=m.user_id
WHERE m.active AND u.email_normalized IN (
  'claudia.pinzon@labanaliza.com','claudia.pinzon@analizaencasa.com',
  'sissy.chavez@labanaliza.com','sissy.chavez@analizaencasa.com'
);
CREATE TABLE analiza.commercial_visits (
  organization_id text NOT NULL, id text NOT NULL, doctor_id text NOT NULL,
  actor_user_id text NOT NULL, idempotency_key text NOT NULL,
  body jsonb NOT NULL CHECK(body->>'id'=id), occurred_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id,id), UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (organization_id,doctor_id) REFERENCES analiza.doctors(organization_id,id),
  FOREIGN KEY (actor_user_id,organization_id) REFERENCES analiza.memberships(user_id,organization_id)
);
CREATE INDEX commercial_visits_time ON analiza.commercial_visits(organization_id,occurred_at DESC,id);
CREATE TABLE analiza.commercial_admissions (
  organization_id text NOT NULL, id text NOT NULL, hospitalization_id text NOT NULL,
  idempotency_key text NOT NULL, body jsonb NOT NULL CHECK(body->>'id'=id),
  admitted_at date NOT NULL,
  PRIMARY KEY (organization_id,id), UNIQUE (organization_id,hospitalization_id),
  UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (organization_id,hospitalization_id) REFERENCES analiza.hospitalizations(organization_id,id)
);
CREATE INDEX commercial_admissions_time ON analiza.commercial_admissions(organization_id,admitted_at DESC,id);
CREATE TABLE analiza.commercial_goals (
  organization_id text NOT NULL, id text NOT NULL, period text NOT NULL,
  period_start date NOT NULL, idempotency_key text NOT NULL,
  body jsonb NOT NULL CHECK(body->>'id'=id),
  PRIMARY KEY (organization_id,id), UNIQUE (organization_id,period,period_start),
  UNIQUE (organization_id,idempotency_key),
  CHECK(period IN ('WEEK','MONTH'))
);
CREATE TABLE analiza.confirmed_sales (
  organization_id text NOT NULL, id text NOT NULL,
  reference_normalized text NOT NULL, idempotency_key text NOT NULL,
  amount_cents bigint NOT NULL CHECK(amount_cents > 0),
  body jsonb NOT NULL CHECK(body->>'id'=id), occurred_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id,id), UNIQUE (organization_id,reference_normalized),
  UNIQUE (organization_id,idempotency_key)
);
CREATE INDEX confirmed_sales_time ON analiza.confirmed_sales(organization_id,occurred_at DESC,id);
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'home_custodies','home_return_holds','commercial_access','commercial_visits',
    'commercial_admissions','commercial_goals','confirmed_sales'
  ] LOOP
    EXECUTE format('ALTER TABLE analiza.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE analiza.%I FORCE ROW LEVEL SECURITY',table_name);
    EXECUTE format(
      'CREATE POLICY tenant_scope ON analiza.%I USING (organization_id = nullif(current_setting(''analiza.organization_id'',true),'''')) WITH CHECK (organization_id = nullif(current_setting(''analiza.organization_id'',true),''''))',
      table_name
    );
  END LOOP;
END $$;
