# Cierre secuencial de CH11

Fecha: 2026-08-27 (America/El_Salvador)

## Resultado

CH11 queda cerrado para iniciar CH12: sus 9 features consolidadas y 13 requisitos exactos/endurecimiento tienen **0 `MISSING`** y **0 `CONFLICTS_WITH_VIDEO`**. La matriz feature-level queda en 3 `IMPLEMENTED_EXACT`, 3 `IMPLEMENTED_PARTIAL` y 3 `NEEDS_CLIENT_CONFIRMATION`. La matriz exacta CH11, incluidos tres controles de endurecimiento, queda en 8 exactos, 2 parciales, 1 no verificable y 2 decisiones de cliente. Todo comportamiento no completado depende de reglas operativas, clínicas o financieras no demostradas y está bloqueado explícitamente.

## Evidencia revisada

- Se abrieron individualmente 71 event frames y 38 detail crops.
- Se revisaron 8 hojas de contacto de eventos, 8 hojas de seguridad que cubren 114 muestras, README, cobertura, inventario, manifiestos y transcripción.
- La auditoría de sólo lectura abrió 125 imágenes y 7 artefactos textuales, 132 archivos de evidencia en total. No fue necesario abrir el clip exacto porque frames, recortes, hojas y transcripción resolvieron la secuencia visible.
- `video-audit-reviews/CH11_agenda_y_turnos/event_review_notes.csv` conserva 71 observaciones no vacías, una por CH11-E0001–CH11-E0071, con timestamp y ruta literal del manifiesto.
- No se copiaron a fixtures, pruebas, screenshots ni documentación nombres, documentos o datos con apariencia identificable de la evidencia inmutable.

## Cambios cerrados

- Agenda reproduce el selector buscable de paciente, filtro de recurso, eventos coloreados, navegación anterior/hoy/siguiente y las vistas Mes, Semana, Lista por semana y Lista por día.
- Se conservaron los destinos visibles Agenda, Disponibilidades, Control de Visitas, Asignación de turnos y Nueva Agenda. Los cuatro destinos no abiertos en el video permanecen bloqueados sin simular una página exitosa.
- Crear turno deriva paciente, documento, empresa y hospitalización desde el caso autorizado; captura inicio, fin, frecuencia, cantidad, clasificación Puntual/Turno y el catálogo amplio de servicios observado.
- El dominio valida organización, intervalo y catálogos, admite una sola ocurrencia e impide afirmar recurrencia hasta confirmar frecuencia, cruces, zona horaria, reintentos, edición y cancelación de series.
- El guardado de visita usa confirmación remota antes del espejo local. La RPC es idempotente, deriva organización y paciente en servidor, serializa por clave y registra evento y auditoría append-only.
- El detalle conserva pestañas Agenda/Actualizaciones, datos de visita, recurso y observaciones. La asignación acepta sólo recursos activos de enfermería o medicina del tenant y usa confirmación remota, idempotencia y auditoría.
- Las visitas finalizadas o canceladas no pueden reasignarse ni modificar observaciones silenciosamente.
- Tipo de turno, tarifa, descuento y ajustes al pago profesional se muestran como superficie observada, pero permanecen deshabilitados hasta confirmar sus reglas; no existe una liquidación ficticia.
- Eliminar visitas, Pool y enlace permanecen visibles con bloqueo informativo hasta definir selección, confirmación, motivo, permisos, revocación y auditoría.

## Persistencia y seguridad

- `supabase/migrations/202608270007_ch11_agenda_visits.sql` añade claves idempotentes, clasificación, frecuencia, cantidad, observaciones y eventos de turno con RLS.
- `create_shift_visit` y `assign_shift_resource` son `SECURITY DEFINER` con `search_path` seguro, organización derivada, permisos, bloqueo asesor, validación de referencias y grants estrechos.
- Las escrituras directas de `shifts` y `shift_events` se revocan para que creación y asignación sólo ocurran mediante las RPC auditables.
- El adaptador reconstruye correctamente hospitalización, recurso, intervalo y tipo desde los nombres de columna Supabase; se eliminó la inserción directa no idempotente del baseline.

## Bloqueos del cliente

`CH11-Q001`–`CH11-Q008` documentan: recurrencia y zona horaria; estados/finalización/secuencia; tarifa, descuento y liquidación; Eliminar/Pool/enlace; destinos no abiertos; roles mutadores; notificaciones de finalización; y elegibilidad, disponibilidad, solapamientos y concurrencia de recursos.

## Verificación

- `npm run codex:preflight`: PASS, 17 capítulos y 1,359 eventos inventariados, sin advertencias.
- `npm test`: 67/67.
- `npm run qa`: 75/75.
- `npm run build:standalone`: 648,373 bytes.
- `npm run test:browser:ch11`: 2/2.
- Regresión acumulada CH01–CH11: 32/32 en Chrome headless.
- Desktop 1440×900 y móvil 390×844: calendario/lista, filtros, acciones y tarjetas utilizables; sin overflow horizontal global.
- Screenshots: `docs/parity/screenshots/ch11-agenda-1440x900.png` y `docs/parity/screenshots/ch11-agenda-mobile-390x844.png`.
- `npm run parity:generate`: 262 requisitos acumulados CH01–CH11; 109 `IMPLEMENTED_EXACT`, 89 `IMPLEMENTED_PARTIAL`, 18 `NOT_TESTABLE`, 46 `NEEDS_CLIENT_CONFIRMATION`, 0 `MISSING` y 0 `CONFLICTS_WITH_VIDEO`.
- `npm run audit:status`: 17/17 capítulos con recibos y notas completas.
- `npm run audit:verify`: 17/17 capítulos verificados, 0 pendientes y 0 fallos.
- Maestro: 210 features, 94 preguntas abiertas y 6 hallazgos de seguridad trazados.

## Límite explícito

El video muestra las superficies de recurrencia, finalización, secuencia, tarifa, descuento, pago y notificación, pero no demuestra sus reglas, efectos persistidos, permisos ni correcciones. La implementación entrega agenda y asignación seguras y comprobables, mantiene esas superficies visibles y bloquea cualquier efecto no confirmado.
