-- Administrative insurance observations are tenant-scoped and do not encode
-- coverage, approval, clinical, tax, or payment rules.
ALTER TABLE analiza.quotes
  ADD CONSTRAINT quotes_patient_reference UNIQUE (organization_id,id,patient_id);

CREATE TABLE analiza.insurance_requests (
  organization_id text NOT NULL,
  id text NOT NULL,
  quote_id text NOT NULL,
  patient_id text NOT NULL,
  body jsonb NOT NULL CHECK (
    jsonb_typeof(body)='object'
    AND body->>'id'=id
    AND body->>'quoteId'=quote_id
    AND body->>'patientId'=patient_id
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,quote_id),
  FOREIGN KEY (organization_id,quote_id,patient_id)
    REFERENCES analiza.quotes(organization_id,id,patient_id)
);

CREATE TABLE analiza.insurance_events (
  organization_id text NOT NULL,
  id text NOT NULL,
  request_id text NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 120),
  actor_user_id text NOT NULL,
  observed_at timestamptz NOT NULL,
  body jsonb NOT NULL CHECK (
    jsonb_typeof(body)='object'
    AND body->>'id'=id
    AND body->>'requestId'=request_id
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (organization_id,request_id)
    REFERENCES analiza.insurance_requests(organization_id,id),
  FOREIGN KEY (actor_user_id,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id)
);
CREATE INDEX insurance_events_request_time
  ON analiza.insurance_events(organization_id,request_id,observed_at DESC);

ALTER TABLE analiza.insurance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.insurance_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.insurance_requests
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
ALTER TABLE analiza.insurance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.insurance_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.insurance_events
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
