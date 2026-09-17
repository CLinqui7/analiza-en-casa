WITH defaults(id,sku,name,category) AS (
  VALUES
    ('default-lab-hemogram','LAB-0001','Hemograma completo','LABORATORY'),
    ('default-lab-chemistry','LAB-0002','Química sanguínea','LABORATORY'),
    ('default-lab-urinalysis','LAB-0003','Examen general de orina','LABORATORY'),
    ('default-physio-evaluation','FIS-0001','Evaluación inicial de fisioterapia','PHYSIOTHERAPY'),
    ('default-physio-home','FIS-0002','Sesión de fisioterapia en domicilio','PHYSIOTHERAPY'),
    ('default-physio-respiratory','FIS-0003','Terapia respiratoria','PHYSIOTHERAPY'),
    ('default-imaging-xray','IMG-0001','Radiografía','IMAGING'),
    ('default-imaging-ultrasound','IMG-0002','Ultrasonografía','IMAGING'),
    ('default-imaging-tomography','IMG-0003','Tomografía computarizada','IMAGING')
)
INSERT INTO analiza.catalog_items(organization_id,id,body)
SELECT organization.id,defaults.id,jsonb_build_object(
  'id',defaults.id,
  'sku',defaults.sku,
  'name',defaults.name,
  'category',defaults.category,
  'status','ACTIVE',
  'createdAt',now()::text
)
FROM analiza.organizations organization
CROSS JOIN defaults
ON CONFLICT (organization_id,id) DO NOTHING;
