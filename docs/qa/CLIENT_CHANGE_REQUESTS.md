# Registro canónico de cambios del cliente

Fuente inmutable: `docs/client-change-requests/source/cambiosparte1analizacasa_AUDITADO.xlsx` (SHA-256 `d3a3f872b296aa9f722085f44f8ea11e364669ace3c26707d346a10b022aa6b3`).

El seguimiento de las 32 solicitudes se cerró por indicación del administrador. El estado técnico y la certificación se conservan por separado y no se consideran completados automáticamente.

| Cambio | Filas | Módulo | Seguimiento | Estado técnico | Interpretación normalizada |
|---|---:|---|---|---|---|
| CR-001 | 2 | Pacientes | COMPLETED | IMPLEMENTED_DEMO_ONLY | DUI en la plantilla de nuevo paciente |
| CR-002 | 3 | Pacientes | COMPLETED | PARTIAL | Agregar tipo de documento Carnet de residente |
| CR-003 | 4 | Pacientes · Exportación | COMPLETED | PARTIAL | Definir alcance y exportar pacientes autorizados ordenados |
| CR-004 | 5 | Pacientes · Contactos | COMPLETED | PARTIAL | Guardar tipo y número de documento del responsable |
| CR-005 | 6 | Administración · Médicos y recursos | COMPLETED | MISSING | Separar altas, rutas y modelos de médico y recurso |
| CR-006 | 7 | Administración · Médicos | COMPLETED | PARTIAL | Alta/edición de médico con adjuntos privados y auditoría |
| CR-007 | 8 | Administración · Profesionales | COMPLETED | MISSING | Catálogo buscable y persistente de especialidades/profesiones |
| CR-008 | 9 | Hospitalización | COMPLETED | PARTIAL | Adjuntar archivo privado a hospitalización con auditoría |
| CR-009 | 10 | Hospitalización | COMPLETED | PARTIAL | Ingreso/egreso; períodos múltiples sólo tras definición |
| CR-010 | 11 | Operación | COMPLETED | BLOCKED_CLIENT | Definir entidad Puntual, campos, duración, estados y relación |
| CR-011 | 12 | Cotizaciones | COMPLETED | IMPLEMENTED_DEMO_ONLY | Conservar categoría por línea de cotización |
| CR-012 | 13 | Cotizaciones · Paciente | COMPLETED | IMPLEMENTED_DEMO_ONLY | Refrescar pacientes autorizados, incluso creados por otro usuario |
| CR-013 | 14 | Cotizaciones · Honorarios | COMPLETED | MISSING | Vincular médico y honorario trazable a línea FEES |
| CR-014 | 15 | Dashboard | COMPLETED | BLOCKED_CLIENT | Definir fuente de facturación y estados mensuales antes de gráficas |
| CR-015 | 16 | Dashboard | COMPLETED | BLOCKED_CLIENT | Definir visita válida, meta, período y fórmula de cumplimiento |
| CR-016 | 17 | Dashboard | COMPLETED | MISSING | Métrica/gráfica con datos de seguro y permisos |
| CR-017 | 18 | Agenda y turnos | COMPLETED | IMPLEMENTED_DEMO_ONLY | Crear serie definida de turnos sin duplicados o colisiones |
| CR-018 | 19 | Agenda y turnos | COMPLETED | PARTIAL | Presets 6h/8h y Puntual sujeto a regla aprobada |
| CR-019 | 20 | Tarjeta de medicamentos | COMPLETED | BLOCKED_CLIENT | Observaciones por ítem/general en tarjeta clínica autorizada |
| CR-020 | 21 | Clínica | COMPLETED | MISSING | Entradas append-only por turno, totales 24h y cierre auditado |
| CR-021 | 22 | Clínica · Escalas | COMPLETED | PARTIAL | Escala EVA con versión institucional aprobada y selección única |
| CR-022 | 23 | Clínica · Escalas | COMPLETED | PARTIAL | Escala de Glasgow confirmada, versionada y con suma configurada |
| CR-023 | 24 | Clínica · Escalas | COMPLETED | PARTIAL | Escala Ramsay con formulario aprobado y selección única |
| CR-024 | 25 | Clínica · Escalas | COMPLETED | PARTIAL | Escala ECOG confirmada, versionada y con selección única |
| CR-025 | 26 | Clínica · Escalas | COMPLETED | PARTIAL | ESAS con dominios 0–10 según formulario aprobado |
| CR-026 | 27 | Clínica · Escalas | COMPLETED | PARTIAL | Escala Karnofsky confirmada y versionada |
| CR-027 | 28 | Clínica · Escalas | COMPLETED | PARTIAL | Escala Downton con formulario y cálculo aprobados |
| CR-028 | 29 | Clínica · Escalas | COMPLETED | SOURCE_CONFLICT | La captura parece ser Norton; confirmar nombre y versión antes de modelar |
| CR-029 | 30 | Clínica · Escalas | COMPLETED | SOURCE_CONFLICT | Índice Barthel por confirmar, incluida versión/puntuación institucional |
| CR-030 | 31 | Clínica · Escalas | COMPLETED | PARTIAL | Escala Braden confirmada y versionada |
| CR-031 | 33-34 | Pacientes · Multiusuario | COMPLETED | PARTIAL | Persistencia multiusuario por organización, RLS, refetch/Realtime y auditoría |
| CR-032 | 35 | Migración de datos | COMPLETED | MISSING | ETL idempotente con dry-run, conciliación, rollback y aprobación |

Los textos fuente se conservan en `source_text`; las normalizaciones no corrigen silenciosamente el Excel.
