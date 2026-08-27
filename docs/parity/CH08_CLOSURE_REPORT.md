# Cierre secuencial de CH08

Fecha: 2026-08-27 (America/El_Salvador)

## Resultado

CH08 queda cerrado para iniciar CH09: sus 27 requisitos exactos y de endurecimiento tienen **0 `MISSING`** y **0 `CONFLICTS_WITH_VIDEO`**. Se distribuyen en 19 `IMPLEMENTED_EXACT`, 6 `IMPLEMENTED_PARTIAL` y 2 `NEEDS_CLIENT_CONFIRMATION`; todos los parciales están vinculados a preguntas explícitas del cliente.

## Evidencia revisada

- Se abrieron individualmente 95 event frames, 56 detail crops y 291 safety frames.
- Se revisaron 11 hojas de contacto de eventos, 19 hojas de seguridad, README, cobertura, instrucciones, manifiestos, transcripción y el clip exacto para resolver ambigüedades.
- La auditoría de sólo lectura abrió 477 archivos de evidencia requeridos distintos; existen 479 archivos físicos al incluir documentos auxiliares.
- `video-audit-reviews/CH08_perfil_administrativo_cuentas_por_cobrar_y_pagos/event_review_notes.csv` conserva una observación visual no vacía para CH08-E0001–CH08-E0095.

## Cambios cerrados

- `Poner en ejecución` abre el perfil administrativo de la cotización y hospitalización autorizadas; todos los campos observados están presentes y el guardado es remoto primero, idempotente y auditable.
- La RPC de ejecución valida organización, paciente, hospitalización, cotización raíz, versión y aseguradora; impide perfiles activos duplicados y no inventa transiciones financieras o clínicas.
- Cuentas por cobrar separa Cuentas y Pagos y expone métricas, búsqueda, ordenación, paginación 10/25/50, exportación total o filtrada y acciones por hospitalización.
- El generador de estado de cuenta filtra por paciente, hospitalización y rango; conserva selección entre Cotizaciones, Pagos y Documentos y recalcula el resumen desde registros confirmados.
- Los pagos y sus asignaciones, comprobantes y vínculos se reconstruyen correctamente desde Supabase.
- La creación y reversión de pagos son remotas primero. Los pagos confirmados no se editan ni eliminan: se revierten con motivo, actor, marca de tiempo, idempotencia y auditoría append-only.
- El resumen nunca interpreta el saldo negativo del video como crédito o anticipo; muestra cualquier excedente como no asignado y conserva la prohibición de sobrepago.
- Las opciones ambiguas se mantienen visibles y bloqueadas con explicación, sin simular reglas de negocio inexistentes.

## Bloqueos del cliente

`CH08-Q001`–`CH08-Q010` documentan: política de sobrepago/crédito; modalidades Particular/Mixto/Aseguradora/Empresa; semántica de Guardar cambios; periodicidad y corte del histórico; Archivar y Registro XPO; corrección de pagos; catálogos administrativos; código PI; formatos oficiales de exportación; y automatización segura del estado de cuenta.

## Verificación

- `npm test`: 54/54.
- `npm run qa`: 75/75.
- `npm run build:standalone`: artefacto generado, 542,475 bytes.
- `npm run test:browser:ch08`: 3/3; regresión acumulada CH01–CH08: 26/26 en Chrome headless.
- Desktop 1440×900 y móvil 390×844: menús, tablas, modales y reversión utilizables sin desbordamiento horizontal global.
- `npm run parity:generate`: 205 requisitos acumulados CH01–CH08; 78 `IMPLEMENTED_EXACT`, 75 `IMPLEMENTED_PARTIAL`, 15 `NOT_TESTABLE`, 37 `NEEDS_CLIENT_CONFIRMATION`, 0 `MISSING` y 0 `CONFLICTS_WITH_VIDEO`.
- `npm run audit:status`: 17/17 capítulos con recibos y notas completas.
- `npm run audit:verify`: 17/17 capítulos estructuralmente verificados.

## Límite explícito

El video muestra edición/eliminación de pagos y un saldo pendiente negativo. La implementación conserva esas superficies como referencia, pero aplica la regla no negociable del proyecto: los pagos no se sobrescriben ni eliminan y los estados financieros no se infieren. La corrección disponible es una reversión append-only; cualquier crédito, anticipo, reasignación o snapshot requiere una decisión documentada del cliente.
