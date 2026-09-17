ALTER TABLE analiza.file_metadata
  DROP CONSTRAINT IF EXISTS file_metadata_owner_type_check;
ALTER TABLE analiza.file_metadata
  ADD CONSTRAINT file_metadata_owner_type_check
  CHECK(owner_type IN ('patient','doctor','hospitalization','nursing_resource'));

WITH defaults(id,sku,name) AS (
  VALUES
    ('default-insurer-acsa','ASE-0001','ACSA'),
    ('default-insurer-panamerican','ASE-0002','PanAmerican Life'),
    ('default-insurer-mapfre','ASE-0003','Mapfre'),
    ('default-insurer-asesuisa','ASE-0004','Asesuisa SURA'),
    ('default-insurer-assa','ASE-0005','ASSA'),
    ('default-insurer-sisa','ASE-0006','SISA'),
    ('default-insurer-abank','ASE-0007','ABANK'),
    ('default-insurer-azul','ASE-0008','Seguros Azul'),
    ('default-insurer-vumi','ASE-0009','VUMI'),
    ('default-insurer-bupa','ASE-0010','Bupa'),
    ('default-insurer-mired','ASE-0011','Mi Red'),
    ('default-insurer-mediprocesos','ASE-0012','Mediprocesos'),
    ('default-insurer-cel','ASE-0013','CEL'),
    ('default-insurer-bienestar','ASE-0014','Bienestar Magisterial')
)
INSERT INTO analiza.catalog_items(organization_id,id,body)
SELECT organization.id,defaults.id,jsonb_build_object(
  'id',defaults.id,
  'sku',defaults.sku,
  'name',defaults.name,
  'category','INSURERS',
  'status','ACTIVE',
  'createdAt',now()::text
)
FROM analiza.organizations organization
CROSS JOIN defaults
ON CONFLICT (organization_id,id) DO NOTHING;
