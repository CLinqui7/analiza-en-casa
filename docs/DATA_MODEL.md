# Modelo de datos propuesto

## Identidad y acceso

- organizations
- branches
- profiles
- roles
- permissions
- user_roles
- audit_logs

## Pacientes

- patients
- patient_contacts
- patient_addresses
- insurers
- insurance_plans
- patient_insurances

## Operación

- hospitalizations
- hospitalization_status_events
- hospitalization_documents

## Catálogos y precios

- catalog_items
- catalog_item_categories
- price_lists
- price_list_items
- discount_rules

## Cotizaciones y seguros

- quotes
- quote_versions
- quote_items
- quote_status_events
- insurance_requests
- insurance_request_events
- insurance_documents

## Portal

- patient_portal_links
- patient_portal_verifications
- patient_portal_access_logs

## Finanzas

- payments
- payment_allocations
- payment_receipts
- financial_adjustments

## Clínica

- medical_orders
- health_reports
- care_plans
- medication_cards
- medication_card_items
- clinical_evolutions
- clinical_signatures

## Inventario

- warehouses
- inventory_items
- inventory_lots
- inventory_movements
- inventory_reservations
- supply_kits
- supply_kit_items

## Médicos

- doctors
- doctor_services
- doctor_statements
- doctor_statement_items
- doctor_payments

## Documentos y comunicaciones

- files
- document_templates
- generated_documents
- notifications
- notification_attempts

## Reglas técnicas

- UUID como llave primaria.
- Fechas en UTC y presentación en zona local.
- Soft delete solo cuando la norma lo permita.
- Eventos financieros y clínicos no se eliminan físicamente.
- Versiones inmutables de cotizaciones y documentos firmados.
- Montos en `numeric`, nunca en punto flotante.
- Índices por documento, paciente, caso, estado, fecha y referencias externas.
- Restricciones únicas para prevenir duplicados.
- RLS por organización y rol.
