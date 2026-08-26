-- Datos completamente ficticios para QA.
-- Ejecutar después de las migraciones. No contiene usuarios de auth ni datos reales.

insert into public.organizations (id,name,slug,currency,timezone)
values ('00000000-0000-0000-0000-000000000001','Analiza en Casa · Demo','analiza-en-casa-demo','USD','America/El_Salvador')
on conflict (id) do nothing;

insert into public.branches (id,organization_id,name,code,address,phone)
values ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','Operación central','CENTRAL','San Salvador · dirección ficticia','+503 2200-0000')
on conflict (id) do nothing;

insert into public.roles (id,organization_id,code,name,description,is_system) values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','ADMIN','Administración','Acceso operativo integral',true),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','DOCTOR','Médico','Gestión clínica y consulta propia',true),
('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','NURSE','Enfermería','Atención y registro clínico operativo',true),
('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','INVENTORY','Inventario','Compras e inventario',true),
('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','FINANCE','Finanzas','Cobros, pagos y estados de cuenta',true),
('10000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','AUDITOR','Auditor','Consulta y auditoría',true)
on conflict (id) do nothing;

insert into public.role_permissions (role_id,permission_code)
select '10000000-0000-0000-0000-000000000001', code from public.permissions
on conflict do nothing;

insert into public.role_permissions (role_id,permission_code)
select '10000000-0000-0000-0000-000000000002', code from public.permissions
where code in ('dashboard:read','patients:read','cases:read','quotes:read','insurance:read','clinical:read','clinical:write','clinical:sign','agenda:read','doctors:read','statements:read')
on conflict do nothing;

insert into public.role_permissions (role_id,permission_code)
select '10000000-0000-0000-0000-000000000003', code from public.permissions
where code in ('dashboard:read','patients:read','patients:write','cases:read','clinical:read','clinical:write','agenda:read','inventory:read')
on conflict do nothing;

insert into public.role_permissions (role_id,permission_code)
select '10000000-0000-0000-0000-000000000004', code from public.permissions
where code in ('dashboard:read','patients:read','cases:read','purchases:read','purchases:write','inventory:read','inventory:write','catalogs:read','catalogs:write','reports:read')
on conflict do nothing;

insert into public.role_permissions (role_id,permission_code)
select '10000000-0000-0000-0000-000000000005', code from public.permissions
where code in ('dashboard:read','patients:read','cases:read','quotes:read','quotes:write','insurance:read','insurance:write','payments:read','payments:write','purchases:read','inventory:read','doctors:read','statements:read','statements:write','reports:read')
on conflict do nothing;

insert into public.role_permissions (role_id,permission_code)
select '10000000-0000-0000-0000-000000000006', code from public.permissions
where code like '%:read'
on conflict do nothing;

insert into public.insurers (id,organization_id,name,contact_name,phone,email) values
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Aseguradora Horizonte','Laura Campos','+503 2200-1000','preautorizaciones@horizonte.demo'),
('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Seguros Vida Integral','Mario Rivas','+503 2200-2000','salud@vidaintegral.demo'),
('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Protección Médica Regional','Sonia Aguilar','+503 2200-3000','autorizaciones@pmr.demo')
on conflict (id) do nothing;

insert into public.insurance_plans (id,organization_id,insurer_id,name,coverage_note) values
('21000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Hogar Plus','Cobertura registrada según carta de aprobación.'),
('21000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Integral Familiar','Requiere preautorización y resumen clínico.'),
('21000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','Regional Oro','Cobertura regional con carta de garantía.')
on conflict (id) do nothing;

insert into public.patients (id,organization_id,code,document_type,document_number,first_name,last_name,birth_date,sex,blood_type,nationality,phone,email,triage,notify_whatsapp,notify_email) values
('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','PAT-001','DUI','00000000-1','Elena','Morales','1958-04-12','F','O+','Salvadoreña','+503 7000-1001','elena.demo@example.com','ALTA',true,true),
('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','PAT-002','DUI','00000000-2','Roberto','Cáceres','1972-09-27','M','A+','Salvadoreña','+503 7000-1002','roberto.demo@example.com','MEDIA',true,false),
('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','PAT-003','PASAPORTE','P-DEMO-003','Claudia','Mendoza','1984-01-18','F','B+','Guatemalteca','+503 7000-1003','claudia.demo@example.com','BAJA',true,true)
on conflict (id) do nothing;

insert into public.patient_contacts (id,organization_id,patient_id,full_name,relationship,phone,is_primary) values
('31000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Daniel Morales','Hijo','+503 7000-2001',true),
('31000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','Marina Cáceres','Esposa','+503 7000-2002',true)
on conflict (id) do nothing;

insert into public.patient_addresses (id,organization_id,patient_id,address_line,department,municipality,latitude,longitude) values
('32000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Colonia Escalón · dirección ficticia','San Salvador','San Salvador',13.7012,-89.2308),
('32000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','Santa Tecla · dirección ficticia','La Libertad','Santa Tecla',13.6731,-89.2899)
on conflict (id) do nothing;

insert into public.patient_insurances (id,organization_id,patient_id,insurer_id,plan_id,policy_number,valid_until) values
('33000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','POL-DEMO-1488','2027-03-31'),
('33000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','POL-DEMO-2184','2026-12-31')
on conflict (id) do nothing;

insert into public.doctors (id,organization_id,full_name,specialty,phone,email,rate_type) values
('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Dra. Valeria Núñez','Medicina interna','+503 7100-1001','valeria.nunez@demo.example','PER_VISIT'),
('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Dr. Mauricio Rivas','Cirugía general','+503 7100-1002','mauricio.rivas@demo.example','PER_VISIT')
on conflict (id) do nothing;

insert into public.hospitalizations (id,organization_id,code,patient_id,account_type,insurer_id,administrative_manager_name,contracting_doctor_id,start_date,status,priority,diagnosis_summary,next_action,devices) values
('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','HOS-2026-0190','30000000-0000-0000-0000-000000000001','SEGURO','20000000-0000-0000-0000-000000000001','Andrea Mejía','40000000-0000-0000-0000-000000000001','2026-08-18','ACTIVE','ALTA','Recuperación posoperatoria con atención domiciliar.','Adjuntar carta de aprobación y programar enfermería.','["Catéter venoso periférico"]'),
('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','HOS-2026-0194','30000000-0000-0000-0000-000000000002','SEGURO','20000000-0000-0000-0000-000000000002','Andrea Mejía','40000000-0000-0000-0000-000000000002','2026-08-21','ACTIVE','MEDIA','Antibioticoterapia intravenosa en domicilio.','Esperar respuesta de preautorización.','["Bomba de infusión"]')
on conflict (id) do nothing;

insert into public.catalog_items (id,organization_id,sku,category,name,unit,cost,base_price,taxable,requires_lot,requires_serial) values
('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','SRV-ENF-12','SERVICES','Enfermería domiciliar 12 horas','turno',120,180,false,false,false),
('60000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','STD-HEM-01','STUDIES','Hemograma completo','estudio',8,18,false,false,false),
('60000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','MED-CEF-1G','MEDICATIONS','Ceftriaxona 1 g vial','vial',9.20,14.80,true,true,false),
('60000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','INS-CAN-01','SUPPLIES','Kit de canalización','kit',17.30,29,true,true,false),
('60000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','EQP-BOM-01','EQUIPMENT','Alquiler bomba de infusión','día',20,35,true,false,true),
('60000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','FEE-VIS-01','FEES','Visita médica domiciliar','visita',65,95,false,false,false),
('60000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','EXT-DEL-01','EXTRAS','Entrega fuera de zona','servicio',8,15,true,false,false)
on conflict (id) do nothing;

insert into public.price_lists (id,organization_id,name,currency,valid_from,status)
values ('61000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Tarifa general demo','USD','2026-01-01','ACTIVE')
on conflict (id) do nothing;

insert into public.price_list_items (organization_id,price_list_id,catalog_item_id,price)
select '00000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001',id,base_price
from public.catalog_items where organization_id='00000000-0000-0000-0000-000000000001'
on conflict do nothing;

insert into public.discount_rules (id,organization_id,name,rule_type,category_percentages,requires_approval)
values ('62000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Perfil convenio demo','PROFILE','{"SERVICES":15,"STUDIES":10,"MEDICATIONS":0,"SUPPLIES":5,"EQUIPMENT":10,"FEES":0,"EXTRAS":0}',true)
on conflict (id) do nothing;

insert into public.quotes (id,organization_id,code,hospitalization_id,patient_id,status,current_version,subtotal,discount_amount,total,insurer_amount,patient_amount,comments,sent_at) values
('70000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','QT-2026-0148','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','PARTIALLY_APPROVED',1,1325,66.25,1258.75,900,358.75,'Datos ficticios para validación del flujo.','2026-08-24 16:00:00+00')
on conflict (id) do nothing;

insert into public.quote_versions (id,organization_id,quote_id,version,status_snapshot,subtotal,discount_amount,total,insurer_amount,patient_amount,discount_snapshot,comments,immutable) values
('71000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',1,'PARTIALLY_APPROVED',1325,66.25,1258.75,900,358.75,'{"type":"PERCENT","value":5,"reason":"Perfil autorizado"}','Datos ficticios para validación del flujo.',true)
on conflict (id) do nothing;

insert into public.quote_items (id,organization_id,quote_version_id,catalog_item_id,category,description,quantity,unit_price) values
('72000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','SERVICES','Enfermería domiciliar 12 horas',5,180),
('72000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000003','MEDICATIONS','Ceftriaxona 1 g vial',10,14.80),
('72000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000004','SUPPLIES','Kit de canalización',3,29),
('72000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000006','FEES','Visita médica domiciliar',2,95)
on conflict (id) do nothing;

insert into public.quote_status_events (organization_id,quote_id,from_status,to_status,note,created_at) values
('00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',null,'DRAFT','Cotización creada.','2026-08-19 12:00:00+00'),
('00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','DRAFT','SENT_TO_INSURER','Cotización y resumen clínico enviados.','2026-08-19 13:10:00+00'),
('00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','INSURER_REVIEW','PARTIALLY_APPROVED','Carta de aprobación parcial recibida.','2026-08-22 17:15:00+00');

insert into public.insurance_requests (id,organization_id,quote_id,insurer_id,status,claim_number,requested_amount,approved_amount,submitted_at,responded_at,last_note)
values ('73000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','PARTIALLY_APPROVED','HZN-DEMO-8801',1258.75,900,'2026-08-19 13:10:00+00','2026-08-22 17:15:00+00','Aprobación parcial; deducible y copago aplicados.')
on conflict (id) do nothing;

insert into public.payments (id,organization_id,quote_id,patient_id,amount,method,payer,external_reference,status,receipt_code,idempotency_key,paid_at)
values ('74000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',250,'TRANSFER','Daniel Morales','TRX-DEMO-7781','APPLIED','REC-DEMO-001','payment-demo-001','2026-08-23 12:20:00+00')
on conflict (id) do nothing;

insert into public.clinical_documents (id,organization_id,hospitalization_id,patient_id,document_type,title,status,version,summary,content,author_name,signed_at) values
('80000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','HEALTH_REPORT','Reporte de salud inicial','SIGNED',1,'Paciente estable, dolor controlado, herida limpia y seca.','{"diagnosis":"Recuperación posoperatoria","background":["Hipertensión arterial"],"allergies":["Penicilina"],"devices":["Catéter venoso periférico"],"plan":"Vigilancia, analgesia y curación diaria."}','Dra. Valeria Núñez','2026-08-18 18:25:00+00'),
('80000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','MEDICAL_ORDER','Orden médica inicial','SIGNED',1,'Antibioticoterapia y analgesia.','{"diagnosis":"Posoperatorio","plan":"Ceftriaxona 1 g IV cada 24 horas; acetaminofén PRN."}','Dra. Valeria Núñez','2026-08-18 18:30:00+00')
on conflict (id) do nothing;

insert into public.vital_signs (id,organization_id,hospitalization_id,patient_id,temperature,heart_rate,respiratory_rate,systolic,diastolic,spo2,pain,author_name,recorded_at)
values ('81000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',36.7,78,17,122,76,97,2,'Lic. Sofía Duarte','2026-08-25 12:00:00+00')
on conflict (id) do nothing;

insert into public.nursing_notes (id,organization_id,hospitalization_id,patient_id,note_text,status,author_name,signed_at,share_status,shared_at)
values ('82000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Paciente consciente y orientada. Herida quirúrgica sin secreción. Se administró medicación indicada.','SIGNED','Lic. Sofía Duarte','2026-08-25 12:20:00+00','SHARED_WITH_DOCTOR','2026-08-25 12:30:00+00')
on conflict (id) do nothing;

insert into public.suppliers (id,organization_id,name,tax_id,contact_name,phone,email,payment_terms) values
('90000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Distribuidora Médica Demo','0614-DEMO-001','Sara López','+503 7200-1001','ventas@distribuidora.demo','30 días'),
('90000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Equipos Clínicos Demo','0614-DEMO-002','Luis Pérez','+503 7200-1002','ventas@equipos.demo','Contado')
on conflict (id) do nothing;

insert into public.purchases (id,organization_id,code,supplier_id,invoice_number,purchase_date,payment_type,status,subtotal,tax_amount,discount_amount,total)
values ('91000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','PUR-2026-0081','90000000-0000-0000-0000-000000000001','FAC-DEMO-8891','2026-08-22','CREDIT','RECEIVED',725,94.25,0,819.25)
on conflict (id) do nothing;

insert into public.purchase_items (id,organization_id,purchase_id,catalog_item_id,description,quantity,unit_cost,tax_rate,line_total) values
('92000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000003','Ceftriaxona 1 g vial',50,9.20,13,519.80),
('92000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000004','Kit de canalización',15,17.30,13,293.24)
on conflict (id) do nothing;

insert into public.warehouses (id,organization_id,code,name,location) values
('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','CENTRAL','Bodega central','San Salvador'),
('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','EMERG','Bodega de emergencia','Unidad móvil'),
('a0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','DOM','Inventario domiciliar','Pacientes activos')
on conflict (id) do nothing;

insert into public.inventory_items (id,organization_id,catalog_item_id,warehouse_id,stock,committed,minimum_stock) values
('a1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001',74,18,20),
('a1000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001',25,6,10),
('a1000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001',4,2,2)
on conflict (id) do nothing;

insert into public.inventory_lots (id,organization_id,inventory_item_id,lot_number,serial_number,expires_at,quantity,status) values
('a2000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','CEF-DEMO-A26',null,'2027-05-31',40,'AVAILABLE'),
('a2000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','CAN-DEMO-B26',null,'2028-01-31',20,'AVAILABLE'),
('a2000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003',null,'BOM-DEMO-001',null,1,'AVAILABLE')
on conflict (id) do nothing;

insert into public.inventory_reservations (id,organization_id,hospitalization_id,inventory_item_id,quantity,delivered,consumed,returned,status) values
('a3000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',8,10,7,1,'OPEN'),
('a3000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002',3,3,2,0,'OPEN')
on conflict (id) do nothing;

insert into public.supply_kits (id,organization_id,code,name) values
('a4000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','KIT-CAN-01','Kit de canalización periférica')
on conflict (id) do nothing;

insert into public.supply_kit_items (kit_id,catalog_item_id,quantity) values
('a4000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000004',1)
on conflict do nothing;

insert into public.doctor_services (id,organization_id,doctor_id,hospitalization_id,patient_id,service_date,service_name,quantity,rate,status) values
('b0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2026-08-19','Visita médica domiciliar',1,75,'APPROVED'),
('b0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2026-08-22','Seguimiento médico',1,75,'APPROVED')
on conflict (id) do nothing;

insert into public.doctor_statements (id,organization_id,doctor_id,period_start,period_end,gross,adjustments,withholdings,paid,status) values
('b1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2026-08-01','2026-08-31',150,0,15,0,'READY_TO_SEND')
on conflict (id) do nothing;

insert into public.doctor_statement_items (statement_id,doctor_service_id,amount) values
('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',75),
('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',75)
on conflict do nothing;

insert into public.document_templates (id,organization_id,code,name,document_type,version,html_template,status) values
('c0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','QUOTE-PROVISIONAL','Cotización provisional','QUOTE',1,'<h1>Cotización {{code}}</h1>','DRAFT'),
('c0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','HEALTH-REPORT-PROVISIONAL','Reporte de salud provisional','HEALTH_REPORT',1,'<h1>Reporte de salud</h1>','DRAFT'),
('c0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','MEDICATION-CARD-PROVISIONAL','Tarjeta de medicamentos provisional','MEDICATION_CARD',1,'<h1>Tarjeta de medicamentos</h1>','DRAFT')
on conflict (id) do nothing;

-- Para asociar un usuario real:
-- 1. Cree el usuario en Supabase Auth con metadata:
--    {"full_name":"Nombre","organization_id":"00000000-0000-0000-0000-000000000001"}
-- 2. Copie el UUID del usuario y ejecute:
-- insert into public.user_roles (organization_id,user_id,role_id)
-- values ('00000000-0000-0000-0000-000000000001','<AUTH_USER_UUID>','10000000-0000-0000-0000-000000000001');
