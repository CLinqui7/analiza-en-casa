# Cierre secuencial de CH04

Fecha: 2026-08-27 (America/El_Salvador)

## Resultado

CH04 queda cerrado para poder iniciar CH05: sus 20 requisitos trazados tienen **0 `MISSING`** y **0 `CONFLICTS_WITH_VIDEO`** no bloqueados. Se distribuyen en 7 `IMPLEMENTED_EXACT`, 7 `IMPLEMENTED_PARTIAL`, 3 `NEEDS_CLIENT_CONFIRMATION` y 3 `NOT_TESTABLE`.

## Evidencia revisada

- Se abrieron los 35 event frames, los 30 detail crops, los 4 contact sheets de eventos y los 5 contact sheets de seguridad de CH04.
- Se revisaron README, cobertura, manifiesto y transcripción.
- `video-audit-reviews/CH04_cotizacion_datos_generales/event_review_notes.csv` conserva una observación no vacía para CH04-E0001–CH04-E0035.
- El clip exacto no fue necesario: la secuencia visible quedó resuelta; Guardar, errores, impresión y resultados del alta productiva no se ejecutan.

## Cambios cerrados

- Nueva cotización permanece como página completa.
- Paciente es buscable por documento/nombre, requiere coincidencia exacta y autocompleta DUI/NIT, Teléfono y Correo.
- Se eliminó el fallback inseguro al identificador oculto previo: una etiqueta no coincidente limpia paciente/caso y no puede guardarse.
- Fecha presenta selector con Cancelar/Seleccionar; Grupo de descuento inicia en Regular sin inventar elegibilidad o fórmulas.
- Referido por admite búsqueda autorizada, múltiples chips deduplicados y remoción. El selector normal rechaza texto libre.
- El botón `+` abre un alta provisional, local a la cotización y rotulada como sintética/configurable; no crea un maestro productivo.
- Giftcard conserva acción de limpieza pero no produce efecto financiero sin reglas aprobadas.
- Las siete categorías observadas son navegables; se muestran Solo disponibles en inventario y los campos iniciales de Servicios, manteniendo bloqueadas las reglas de CH05.
- Fecha, grupo de descuento, referido y comentarios se validan en UI, store y una migración Supabase ordenada. El trigger remoto verifica además paciente↔hospitalización↔organización y protege generales de versiones enviadas.

## Bloqueos del cliente

`CH04-Q001`–`CH04-Q009` documentan cotización abierta, snapshot de contactos, zona horaria/rangos, descuentos, tipología y alta de referencias, giftcard, comentarios y semántica final de Guardar.

## Verificación

- `npm test`: 41/41.
- `npm run test:browser:ch04`: 3/3 en Chrome headless.
- `npm run qa`: 75/75.
- Desktop 1440×900 y móvil 390×844: formulario utilizable sin desbordamiento horizontal global.
- `npm run parity:generate`: 106 requisitos acumulados; 0 `MISSING`, 0 `CONFLICTS_WITH_VIDEO`.
- `npm run audit:verify`: 17/17 capítulos estructuralmente verificados.

## Límite explícito

No se copiaron pacientes, referidores, aseguradoras, giftcards, fechas, precios ni reglas financieras del video. La persistencia Supabase se valida por contrato y migración, pero continúa `IMPLEMENTED_PARTIAL` hasta ejecutar contra un proyecto de ensayo conectado.
