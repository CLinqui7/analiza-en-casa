# Cierre secuencial de CH07

Fecha: 2026-08-27 (America/El_Salvador)

## Resultado

CH07 queda cerrado para iniciar CH08: sus 24 requisitos trazados tienen **0 `MISSING`** y **0 `CONFLICTS_WITH_VIDEO`** no bloqueados. Se distribuyen en 13 `IMPLEMENTED_EXACT`, 5 `IMPLEMENTED_PARTIAL`, 3 `NEEDS_CLIENT_CONFIRMATION` y 3 `NOT_TESTABLE`.

## Evidencia revisada

- Se abrieron individualmente los 18 event frames, 11 detail crops y 106 safety frames.
- Se revisaron las 2 hojas de contacto de eventos, 7 hojas de seguridad, README, cobertura, instrucciones, manifiestos, transcripción y el clip exacto en los tramos ambiguos.
- Total de archivos de evidencia distintos abiertos por la auditoría de sólo lectura: 153; 144 son imágenes estáticas.
- `video-audit-reviews/CH07_preautorizacion_seguro_y_reclamo/event_review_notes.csv` conserva una observación no vacía para CH07-E0001–CH07-E0018.

## Cambios cerrados

- La búsqueda de cotizaciones incluye nombre y documento del paciente además de número, estado y comentarios.
- Cada fila expone el menú observado: edición/nueva versión, duplicación bloqueada, versiones, impresión, envío, seguro, historial y eliminación bloqueada.
- El submenú de impresión conserva Excel, Detalle de servicio, Cotización, Factura y variantes internacionales; sólo Cotización queda habilitada hasta definir formatos fiscales y operativos.
- E-mail y WhatsApp usan una cola de plantilla genérica; no incluyen servicios, medicamentos, estudios ni otro contenido clínico sensible.
- El envío autoritativo bloquea la versión y encola la notificación en una sola RPC transaccional e idempotente; el cliente no muestra éxito ni muta su espejo antes de confirmación.
- La transición de seguro valida estado, observación, monto, referencia e idempotencia; actualiza o crea `insurance_requests`, agrega ambos historiales, auditoría y notificación en una transacción.
- Las políticas RLS niegan mutaciones directas de solicitudes y eventos de seguro para roles autenticados.
- Monto aprobado y número de reclamo se almacenan en el expediente de seguro sin reescribir totales, distribución ni ítems de la versión enviada.
- Reintentos idénticos devuelven el resultado previo y la reutilización de una clave con otro payload se rechaza.

## Bloqueos del cliente

`CH07-Q001`–`CH07-Q013` documentan máquina y catálogo de estados, activación tras Guardar, permisos finos, documentación por aseguradora, formato de reclamo, aprobación parcial, formatos de impresión, proveedor/SLA de mensajería, enlace seguro en vez de adjunto clínico, badge PIC, columna ambigua y vigencia de Preadmisión.

## Verificación

- `npm test`: 50/50.
- `npm run qa`: 75/75.
- `npm run build:standalone`: artefacto generado, 503,086 bytes.
- `npm run test:browser:ch07`: 3/3; regresión acumulada CH01–CH07: 23/23 en Chrome headless.
- Desktop 1440×900 y móvil 390×844: tabla, menús y transiciones utilizables sin desbordamiento horizontal global.
- `npm run parity:generate`: 178 requisitos acumulados; 0 `MISSING`, 0 `CONFLICTS_WITH_VIDEO`.
- `npm run audit:status`: 17/17 capítulos con recibos y notas completas.
- `npm run audit:verify`: 17/17 capítulos estructuralmente verificados.
- `git diff --check`: sin errores de whitespace; sólo advertencias de normalización LF→CRLF del entorno Windows.

## Límite explícito

El audio solicita generar el PDF y enviarlo por WhatsApp en un clic. Como la cotización visible contiene medicamentos, estudios y servicios, adjuntarla literalmente contraviene la regla del proyecto que prohíbe contenido clínico sensible en WhatsApp, SMS o email. La implementación conserva el acceso de un clic, pero sólo encola una plantilla genérica destinada a un canal registrado y deja el documento detrás de acceso seguro. La confirmación del contrato exacto queda en `CH07-Q010`.
