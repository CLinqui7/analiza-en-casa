# Cierre secuencial de CH12

Fecha: 2026-08-27 (America/El_Salvador)

## Resultado

CH12 queda cerrado para iniciar CH13. Sus 8 features consolidadas quedan en 3 `IMPLEMENTED_EXACT`, 3 `IMPLEMENTED_PARTIAL` y 2 `NEEDS_CLIENT_CONFIRMATION`; sus 15 requisitos exactos/endurecimiento tienen 0 `MISSING` y 0 `CONFLICTS_WITH_VIDEO`. Toda operación incompleta depende de reglas financieras, permisos, contenido de reportes o controles ocultos no demostrados y permanece explícitamente bloqueada.

## Evidencia revisada

- Se abrieron 51/51 event frames y 36/36 detail crops individuales.
- Se revisaron 6/6 hojas de contacto de eventos y 13/13 hojas de seguridad que cubren 196 muestras.
- Se abrieron README, instrucciones, lotes, cobertura, manifiestos y transcripción: 113 artefactos únicos de evidencia, 106 imágenes únicas y 115 aperturas visuales totales.
- No fue necesario abrir el clip exacto: frames, recortes, hojas y transcripción resolvieron los comportamientos; el nombre del control tapado se conserva como no demostrado.
- `event_review_notes.csv` mantiene 51 observaciones no vacías, una por CH12-E0001–CH12-E0051, con timestamp y ruta literal.
- No se copiaron nombres, documentos o importes de la evidencia a fixtures, pruebas o capturas; sólo se usaron datos sintéticos del baseline.

## Cambios cerrados

- Cuentas por pagar reproduce las pestañas Resumen y Pagos de Servicio.
- Resumen conserva Facturas y Reclamos, con vacío explícito donde el video no define la entidad de reclamo.
- Se muestran Generar planilla, Restricciones, Descargar y Limpiar Tabla. Sólo Descargar produce un CSV sintético provisional; las acciones con efecto desconocido se bloquean.
- Pagos de Servicio incorpora selección, búsqueda, cantidad de registros, paginación y columnas Recurso, Fecha Visita, Paciente, Monto, Estatus y Est. Visita.
- El filtro combina rango de fechas, recurso y estado, con Cerrar, Limpiar y Aplicar.
- Editar Grupo, Reporte Por Recurso y el reporte oculto permanecen visibles y bloqueados hasta confirmar selección, permisos, contenido y formato.
- El modal Pago de servicios profesionales presenta fecha, hospitalización, recurso, paciente, tarifa, monto, estatus, estado de visita, comentarios y conceptos.
- Agregar Concepto alterna Añadidura/Descuento y conserva todos los motivos legibles como rótulos documentales. No aplica fórmulas ni altera saldos.
- Cancelar no persiste. Guardar y Agregar informan un bloqueo financiero y nunca muestran éxito ficticio.

## Persistencia y seguridad

- `generateDoctorStatements` y `sendDoctorStatement` ya no mutan estados financieros en `localStorage` ni crean notificaciones tras una confirmación sólo local.
- El bootstrap Supabase carga `doctor_services` y normaliza servicios, estados, importes e ítems desde snake_case; Cuentas por pagar y Estados de cuenta no quedan vacíos ni fallan por el contrato productivo.
- `202608270008_ch12_professional_payables.sql` habilita RLS en `doctor_statement_items` y limita lectura al tenant derivado del estado padre.
- Un servicio sólo puede incluirse en un estado profesional mediante el índice único estructural, evitando doble inclusión.
- Se eliminan las políticas de escritura directa y se revoca INSERT/UPDATE/DELETE en servicios, estados e ítems para `authenticated`.
- No se inventó una RPC financiera: generación, ajuste, aprobación, desembolso, envío y reversión seguirán cerrados hasta aprobar máquina de estados, tarifas, permisos, período, contabilidad e idempotencia.

## Bloqueos del cliente

`CH12-Q001`–`CH12-Q012` documentan: reporte oculto; estados y reversión; elegibilidad por estado de visita; tarifa versionada; catálogos y evidencia; efecto contable/fiscal; roles; período/agrupación/concurrencia; Restricciones/Limpiar; formatos y minimización; entidad Reclamos; y ledger idempotente de desembolsos.

## Verificación

- `npm run codex:preflight`: PASS, 17 capítulos y 1,359 eventos, sin advertencias.
- `npm run check`: PASS; 71/71 pruebas unitarias/contratos, 75/75 QA y standalone de 667,388 bytes.
- `npm run test:browser:ch12`: 2/2.
- Regresión acumulada CH01–CH12: 34/34 en Chrome headless.
- Desktop 1440×900 y móvil 390×844 revisados visualmente; tabla con scroll interno y 0 overflow horizontal global.
- Screenshots: `docs/parity/screenshots/ch12-payables-1440x900.png` y `docs/parity/screenshots/ch12-payables-mobile-390x844.png`.
- `npm run parity:generate`: 277 requisitos acumulados; 117 exactos, 94 parciales, 18 no verificables, 48 decisiones de cliente, 0 faltantes y 0 conflictos.
- `npm run audit:status`: 17/17 capítulos con recibos y notas completas.
- `npm run audit:verify`: 17/17 capítulos verificados, 0 pendientes y 0 fallos.
- Maestro: 210 features, 106 preguntas abiertas y 6 hallazgos de seguridad; CH12 queda en 3 exactos, 3 parciales y 2 decisiones de cliente.

## Límite explícito

El video demuestra la superficie de pagos profesionales y catálogos de ajustes, pero no demuestra fórmulas, efectos contables/fiscales, autorización, generación de planilla, pago, reversión, formatos oficiales ni resultado persistido de Guardar. La implementación entrega revisión y navegación comprobables, cierra las fronteras financieras inseguras y conserva todo efecto monetario no confirmado como bloqueo explícito.
