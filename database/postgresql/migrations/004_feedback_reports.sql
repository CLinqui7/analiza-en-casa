CREATE TABLE analiza.feedback_reports (
  organization_id text NOT NULL,
  id text NOT NULL,
  user_id text NOT NULL,
  module text NOT NULL CHECK (module IN ('DASHBOARD','PATIENTS','AGENDA','HOSPITALIZATIONS','QUOTES','RECEIVABLES','PAYABLES','PAYMENTS','INSURANCE','CLINICAL','NURSING','MEDICATIONS','DOCTORS','INVENTORY','PURCHASES','CATALOGS','REPORTS','FILES','ACCESS','NAVIGATION','OTHER')),
  category text NOT NULL CHECK (category IN ('ERROR','QUESTION','NEW_FEATURE','CHANGE','IMPROVEMENT')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 4000),
  image_name text,
  image_mime text,
  image_bytes bytea,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','REVIEWING','RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (user_id,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id),
  CHECK (
    (image_bytes IS NULL AND image_name IS NULL AND image_mime IS NULL)
    OR
    (image_bytes IS NOT NULL AND image_name IS NOT NULL AND image_mime IN ('image/jpeg','image/png','image/webp') AND octet_length(image_bytes)<=5242880)
  )
);

CREATE INDEX feedback_reports_user_time
  ON analiza.feedback_reports(organization_id,user_id,created_at DESC);

ALTER TABLE analiza.feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.feedback_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.feedback_reports
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
