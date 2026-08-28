# Cierre secuencial de CH06

Fecha: 2026-08-27 (America/El_Salvador)

## Resultado

CH06 queda cerrado para iniciar CH07: sus 26 requisitos trazados tienen **0 `MISSING`** y **0 `CONFLICTS_WITH_VIDEO`** no bloqueados. Se distribuyen en 14 `IMPLEMENTED_EXACT`, 3 `IMPLEMENTED_PARTIAL`, 7 `NEEDS_CLIENT_CONFIRMATION` y 2 `NOT_TESTABLE`.

## Evidencia revisada

- Se abrieron individualmente los 115 event frames y 75 detail crops.
- Se abrieron las 13 hojas de contacto de eventos y las 12 hojas de seguridad, que representan 186 safety frames.
- Se revisaron README, cobertura, instrucciones, lotes, manifiesto, transcripción y el clip exacto completo hasta su último fotograma para resolver la ambigüedad de Guardar.
- Total de archivos de evidencia únicos abiertos por la auditoría de solo lectura: 222.
- `video-audit-reviews/CH06_cotizacion_insumos_equipos_honorarios_extras_y_totales/event_review_notes.csv` conserva una observación no vacía para CH06-E0001–CH06-E0115.

## Cambios cerrados

- Las siete categorías conservan generales, ledger y totales al alternar pestañas.
- Insumos, Estudios Dx y Honorarios tienen búsqueda incremental, vacío recuperable, precio no editable, cantidad validada, alta con `Procesando...` y reset del compositor.
- Las opciones de Insumos exponen código, nombre, unidad y fabricante sintético configurable; Honorarios identifica concepto y profesional sintético.
- El ledger agrupa por categoría, filtra Todos/Item y presenta código, cantidad, precio, subtotal, descuento e impuesto visible pero bloqueado.
- El motor aplica descuentos configurados por categoría; reglas con aprobación pendiente se bloquean y el store ignora porcentajes arbitrarios enviados por el navegador.
- El store rechaza descuentos de línea no finitos, negativos o superiores al importe bruto.
- Se corrigió un defecto de interacción donde el `change` de comentarios reconstruía el botón entre `mousedown` y `mouseup`; Guardar ahora funciona con un clic físico y navega sólo tras éxito.
- No se infirieron tasa fiscal, stock, lista por socio ni perfil automático del paciente.

## Bloqueos del cliente

`CH06-Q001`–`CH06-Q010` documentan socios/listas, impuesto y redondeo, asignación automática de descuento/referido, disponibilidad, cambio de paciente con ledger existente, reglas de Honorarios, Equipos/Extras, resultado de Guardar, Atrás con cambios y permisos finos.

## Verificación

- `npm test`: 46/46 antes del cierre documental.
- `npm run test:browser:ch06`: 3/3 en Chrome headless; regresión acumulada CH01–CH06: 20/20.
- Desktop 1440×900 y móvil 390×844: categorías y ledger utilizables sin desbordamiento horizontal global.
- `npm run parity:generate`: 154 requisitos acumulados; 0 `MISSING`, 0 `CONFLICTS_WITH_VIDEO`.
- `npm run audit:verify`: 17/17 capítulos estructuralmente verificados.
- `git diff --check`: sin errores de whitespace en la revisión previa al cierre.

## Límite explícito

Los importes del video se conservaron únicamente como evidencia, no como tarifario ni regla. Aunque el ejemplo visual parece aplicar 13% de impuesto sobre el neto agregado y 15% de descuento a Servicios e Insumos, ambos requieren configuración y aprobación del cliente. Equipos y Extras sólo aparecen como pestañas y no son flujos ejercitados en CH06.
