CREATE TABLE analiza.nurse_profiles (
  organization_id text NOT NULL,
  user_id text NOT NULL,
  body jsonb NOT NULL CHECK (jsonb_typeof(body)='object'),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,user_id),
  FOREIGN KEY (user_id,organization_id)
    REFERENCES analiza.memberships(user_id,organization_id)
);

ALTER TABLE analiza.nurse_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analiza.nurse_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON analiza.nurse_profiles
  USING (organization_id = nullif(current_setting('analiza.organization_id',true),''))
  WITH CHECK (organization_id = nullif(current_setting('analiza.organization_id',true),''));
