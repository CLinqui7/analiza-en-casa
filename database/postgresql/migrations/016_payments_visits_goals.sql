CREATE TABLE analiza.payments (
  organization_id text NOT NULL,
  id text NOT NULL,
  quote_id text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('APPLIED','VOIDED')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (organization_id,quote_id) REFERENCES analiza.quotes(organization_id,id),
  CHECK (body->>'id'=id),
  CHECK (body->>'quoteId'=quote_id),
  CHECK (body->>'status'=status)
);

CREATE INDEX payments_quote_time
  ON analiza.payments(organization_id,quote_id,created_at,id);

CREATE TABLE analiza.home_visits (
  organization_id text NOT NULL,
  id text NOT NULL,
  professional_user_id text NOT NULL,
  patient_id text NOT NULL,
  idempotency_key text NOT NULL,
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (professional_user_id,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id),
  FOREIGN KEY (organization_id,patient_id)
    REFERENCES analiza.patients(organization_id,id),
  CHECK (body->>'id'=id)
);

CREATE INDEX home_visits_professional_time
  ON analiza.home_visits(organization_id,professional_user_id,created_at,id);

CREATE TABLE analiza.visit_goals (
  organization_id text NOT NULL,
  id text NOT NULL,
  professional_user_id text NOT NULL,
  month text NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  body jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,professional_user_id,month),
  FOREIGN KEY (professional_user_id,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id),
  CHECK (body->>'id'=id),
  CHECK (body->>'month'=month)
);

ALTER TABLE analiza.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.payments
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));

ALTER TABLE analiza.home_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.home_visits FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.home_visits
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));

ALTER TABLE analiza.visit_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.visit_goals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.visit_goals
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
