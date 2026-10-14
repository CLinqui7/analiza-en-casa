-- Staff classification of imported patient records. Missing rows mean PENDING.
-- This does not change the patient record or authorize clinical decisions.
CREATE TABLE analiza.patient_origin_reviews (
  organization_id text NOT NULL,
  patient_id text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('REAL','TEST')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  reviewed_by text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL CHECK (version > 0),
  PRIMARY KEY (organization_id,patient_id),
  FOREIGN KEY (organization_id,patient_id)
    REFERENCES analiza.patients(organization_id,id),
  FOREIGN KEY (reviewed_by,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id)
);

CREATE TABLE analiza.patient_origin_review_events (
  organization_id text NOT NULL,
  id text NOT NULL,
  patient_id text NOT NULL,
  previous_classification text CHECK (previous_classification IS NULL OR previous_classification IN ('REAL','TEST')),
  classification text NOT NULL CHECK (classification IN ('REAL','TEST')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  reviewed_by text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (organization_id,patient_id)
    REFERENCES analiza.patients(organization_id,id),
  FOREIGN KEY (reviewed_by,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id)
);
CREATE INDEX patient_origin_review_events_patient_time
  ON analiza.patient_origin_review_events(organization_id,patient_id,occurred_at DESC);

ALTER TABLE analiza.patient_origin_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.patient_origin_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.patient_origin_reviews
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
ALTER TABLE analiza.patient_origin_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.patient_origin_review_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.patient_origin_review_events
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
