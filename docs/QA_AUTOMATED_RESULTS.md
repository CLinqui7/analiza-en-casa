# Resultado automatizado de QA

- Estado: **PASSED**
- Controles: 76
- Aprobados: 76
- Fallidos: 0
- Generado: 2026-08-28T06:33:05.639Z

| Control | Resultado | Detalle |
|---|---|---|
| required:index.html | PASS | Archivo presente |
| required:app/main.js | PASS | Archivo presente |
| required:app/views.js | PASS | Archivo presente |
| required:app/store.js | PASS | Archivo presente |
| required:app/domain.js | PASS | Archivo presente |
| required:app/mock-data.js | PASS | Archivo presente |
| required:app/supabase-adapter.js | PASS | Archivo presente |
| required:app/templates.js | PASS | Archivo presente |
| required:app/styles.css | PASS | Archivo presente |
| required:api/runtime-config.js | PASS | Archivo presente |
| required:api/health.js | PASS | Archivo presente |
| required:api/notifications.js | PASS | Archivo presente |
| required:api/portal-status.js | PASS | Archivo presente |
| required:api/cron-retries.js | PASS | Archivo presente |
| required:supabase/migrations/202608260001_initial_schema.sql | PASS | Archivo presente |
| required:supabase/migrations/202608260002_security_rls_functions.sql | PASS | Archivo presente |
| required:supabase/migrations/202608260003_indexes_permissions_storage.sql | PASS | Archivo presente |
| required:supabase/seed.sql | PASS | Archivo presente |
| required:vercel.json | PASS | Archivo presente |
| required:.env.example | PASS | Archivo presente |
| required:README.md | PASS | Archivo presente |
| security:no-service-role-in-client | PASS | La clave de servicio solo aparece como nombre de variable, nunca con valor. |
| security:no-hardcoded-provider-secret | PASS | No hay secretos de proveedor en el cliente. |
| seed:synthetic-classification | PASS | SYNTHETIC_DEMO |
| parity:17-video-chapters | PASS | 17 capítulos de la matriz canónica |
| parity:no-unresolved-missing | PASS | 0 faltantes no bloqueados |
| seed:patients | PASS | 8 pacientes |
| seed:cases | PASS | 6 hospitalizaciones |
| seed:quotes | PASS | 6 cotizaciones |
| seed:all-patient-documents-marked-demo | PASS | Identificadores sintéticos |
| integrity:unique-patient-documents | PASS |  |
| integrity:unique-payment-references | PASS |  |
| integrity:quotes-have-items | PASS | Todas las cotizaciones tienen conceptos |
| integrity:quote-totals | PASS | Total = subtotal - descuento |
| integrity:coverage-sum | PASS | Total = seguro + paciente |
| integrity:committed-not-over-stock | PASS | Comprometido no supera existencia |
| integrity:closure-review-step | PASS | Los cierres no saltan revisión |
| ui:actions-have-handlers | PASS | 76 acciones cubiertas |
| ui:route-permission-enforcement | PASS | Rutas directas validan permisos |
| ui:quote-labels-normalized | PASS | Estados no renderizan objetos |
| ui:save-actions-no-generic-toast | PASS | Guardar no dispara aviso duplicado |
| ui:modal-backdrop-stack | PASS | Backdrop debajo del diálogo |
| ui:portal-full-responsive-canvas | PASS | Portal responsive |
| ui:quote-summary-contrast | PASS | Importes legibles |
| config:save-runtime-export | PASS | Formulario de configuración conectado |
| config:publishable-key-consistent | PASS | Nombre de clave consistente |
| sql:table:patients | PASS | Tabla incluida |
| sql:rls:patients | PASS | RLS o política incluida |
| sql:table:hospitalizations | PASS | Tabla incluida |
| sql:rls:hospitalizations | PASS | RLS o política incluida |
| sql:table:quotes | PASS | Tabla incluida |
| sql:rls:quotes | PASS | RLS o política incluida |
| sql:table:quote_versions | PASS | Tabla incluida |
| sql:rls:quote_versions | PASS | RLS o política incluida |
| sql:table:payments | PASS | Tabla incluida |
| sql:rls:payments | PASS | RLS o política incluida |
| sql:table:clinical_documents | PASS | Tabla incluida |
| sql:rls:clinical_documents | PASS | RLS o política incluida |
| sql:table:nursing_notes | PASS | Tabla incluida |
| sql:rls:nursing_notes | PASS | RLS o política incluida |
| sql:table:inventory_movements | PASS | Tabla incluida |
| sql:rls:inventory_movements | PASS | RLS o política incluida |
| sql:table:inventory_closures | PASS | Tabla incluida |
| sql:rls:inventory_closures | PASS | RLS o política incluida |
| sql:table:doctor_statements | PASS | Tabla incluida |
| sql:rls:doctor_statements | PASS | RLS o política incluida |
| sql:table:notifications | PASS | Tabla incluida |
| sql:rls:notifications | PASS | RLS o política incluida |
| sql:table:patient_portal_links | PASS | Tabla incluida |
| sql:rls:patient_portal_links | PASS | RLS o política incluida |
| sql:table:audit_logs | PASS | Tabla incluida |
| sql:rls:audit_logs | PASS | RLS o política incluida |
| sql:portal-security-definer | PASS | RPC del portal |
| sql:atomic-inventory | PASS | Movimiento transaccional |
| sql:signed-document-protection | PASS | Bloqueo de documentos firmados |
| sql:idempotency | PASS | Pagos, inventario y notificaciones |