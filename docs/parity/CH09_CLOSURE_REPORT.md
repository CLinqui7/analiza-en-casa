# Cierre secuencial de CH09

Fecha: 2026-08-27 (America/El_Salvador)

## Resultado

CH09 queda cerrado para iniciar CH10: sus 30 requisitos exactos y de endurecimiento tienen **0 `MISSING`** y **0 `CONFLICTS_WITH_VIDEO`**. Se distribuyen en 18 `IMPLEMENTED_EXACT`, 8 `IMPLEMENTED_PARTIAL`, 1 `NOT_TESTABLE` y 3 `NEEDS_CLIENT_CONFIRMATION`; todos los parciales están vinculados a preguntas explícitas del cliente.

## Evidencia revisada

- Se abrieron individualmente 137 event frames y 61 detail crops.
- Se revisaron 16 hojas de contacto de eventos, 24 hojas de seguridad, 381 safety frames, README, cobertura, instrucciones, manifiesto y transcripción.
- La auditoría de sólo lectura abrió 625 archivos de evidencia requeridos distintos. No fue necesario abrir el clip exacto porque los frames, recortes y transcripción resolvieron las superficies reproducibles; el resultado de impresión permanece explícitamente no verificable.
- `video-audit-reviews/CH09_hospitalizacion_clinica_y_reporte_de_salud/event_review_notes.csv` conserva una observación visual no vacía para CH09-E0001–CH09-E0137.
- Los nombres, documentos, teléfonos y aseguradoras con apariencia real que aparecen en evidencia inmutable no se copiaron a fixtures, pruebas, screenshots ni documentación de implementación.

## Cambios cerrados

- Hospitalización clínica cuenta con filtros, búsqueda, paginación y tabla separada del estado administrativo; muestra el menú observado y bloquea explícitamente acciones sin contrato clínico aprobado.
- Perfiles Clínicos mantiene historial append-only y permite crear un nuevo borrador con fechas, profesionales, diagnóstico documentado, triage, grupos, responsables, frecuencias, servicio, dispositivos y planificación de turnos.
- La creación del perfil es remota primero, idempotente, auditable y aislada por organización. La RPC valida hospitalización, paciente y todos los profesionales; RLS, grants y trigger deniegan actualización o eliminación directa.
- La plataforma no activa el perfil ni cambia la hospitalización automáticamente. Roles, coexistencia y transiciones quedan bloqueados hasta resolver CH09-Q002, Q003 y Q010.
- Los rangos invertidos que aparecen en el video se rechazan en navegador, dominio, constraint y RPC. El rango del reporte espera además validación autoritativa de organización/hospitalización en Supabase. Las fechas de calendario ya no retroceden un día por conversión de zona horaria.
- Reporte de salud ofrece listado, búsqueda, paginación 10/25/50, menú clínico, selección de rango con procesamiento y seis secciones longitudinales derivadas sólo de registros autorizados.
- Configuration report permite añadir, quitar y reordenar títulos; inicia con las seis secciones observadas y genera una vista de impresión estable sin reproducir la confirmación de salida errónea del video.
- Adjuntos, catálogo diagnóstico, catálogos clínicos, acciones externas, secciones obligatorias y validez legal de PDF permanecen bloqueados y trazados, sin inventar reglas.
- Los documentos clínicos firmados y su flujo de correcciones auditadas permanecen intactos.

## Bloqueos del cliente

`CH09-Q001`–`CH09-Q010` documentan: terminología diagnóstica; roles y perfiles activos; estados/triage; catálogos clínicos; límites del rango; semántica de acciones clínicas; secciones y orden de impresión; políticas de adjuntos; plantilla/firma legal de PDF; y corrección/versionado por estado.

## Verificación

- `npm test`: 59/59.
- `npm run qa`: 75/75.
- `npm run build:standalone`: artefacto generado, 591,645 bytes.
- `npm run test:browser:ch09`: 2/2; regresión acumulada CH01–CH09: 28/28 en Chrome headless.
- Desktop 1440×900 y móvil 390×844: tablas, menú, perfil, rango y configuración de reporte utilizables sin desbordamiento horizontal global.
- Screenshots: `docs/parity/screenshots/ch09-clinical-profile-1440x900.png` y `docs/parity/screenshots/ch09-health-report-390x844.png`.
- `npm run parity:generate`: 235 requisitos acumulados CH01–CH09; 96 `IMPLEMENTED_EXACT`, 83 `IMPLEMENTED_PARTIAL`, 16 `NOT_TESTABLE`, 40 `NEEDS_CLIENT_CONFIRMATION`, 0 `MISSING` y 0 `CONFLICTS_WITH_VIDEO`.
- `npm run audit:status`: 17/17 capítulos con recibos y notas completas.
- `npm run audit:verify`: 17/17 capítulos estructuralmente verificados.

## Límite explícito

El video acepta un rango de turnos invertido y, al imprimir, muestra una confirmación de salida incorrecta sin demostrar un PDF final. La implementación rechaza el rango inválido y entrega una impresión derivada funcional, pero no afirma paridad con un documento que la evidencia nunca muestra ni validez legal sin aprobación del cliente.
