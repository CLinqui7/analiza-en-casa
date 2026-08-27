# Cierre secuencial de CH05

Fecha: 2026-08-27 (America/El_Salvador)

## Resultado

CH05 queda cerrado para iniciar CH06: sus 22 requisitos trazados tienen **0 `MISSING`** y **0 `CONFLICTS_WITH_VIDEO`** no bloqueados. Se distribuyen en 10 `IMPLEMENTED_EXACT`, 6 `IMPLEMENTED_PARTIAL`, 5 `NEEDS_CLIENT_CONFIRMATION` y 1 `NOT_TESTABLE`.

## Evidencia revisada

- Se abrieron individualmente los 87 event frames y 71 detail crops.
- Se abrieron las 10 hojas de contacto de eventos y las 15 hojas de seguridad, que representan 236 safety frames.
- Se revisaron README, cobertura, instrucciones, manifiestos, transcripción y el clip exacto 11:04–11:06 para resolver la ambigüedad de Invanz.
- `video-audit-reviews/CH05_cotizacion_servicios_estudios_y_medicamentos/event_review_notes.csv` conserva una observación no vacía para CH05-E0001–CH05-E0087.

## Cambios cerrados

- Las siete categorías conservan generales y líneas; Servicios y Medicamentos tienen búsqueda incremental, estado `No results found` recuperable, precio no editable, cantidad validada y overlay `Procesando...`.
- El ledger permite varias líneas, filtro Item/Todos y muestra Tipo, Código, Item, Cantidad, Precio, Subtotal, Desc. %, Desc. $, Impuesto y Total.
- La etiqueta de catálogo expone código, nombre, unidad y fabricante configurable con datos sintéticos.
- El dominio rechaza concepto, categoría, descripción, cantidad o precio manipulados y normaliza desde el catálogo activo.
- Alta, edición y revisión en Supabase usan RPC transaccionales, derivan organización, exigen lista activa/vigente, resuelven precio en servidor, recalculan importes, registran procedencia y revocan mutaciones directas.
- En modo Supabase el store confirma el RPC antes de modificar estado financiero local o mostrar éxito, y reconcilia UUID de cotización/versión.
- No se infirieron impuestos, disponibilidad, reservas, dosis ni reglas clínicas.

## Bloqueos del cliente

`CH05-Q001`–`CH05-Q009` documentan listas por socio, taxonomía, unidades, impuestos, inventario/conteos, controles clínicos, ambigüedad de Invanz, resultado de Guardar y permisos finos de línea.

## Verificación

- `npm test`: 43/43.
- `npm run test:browser:ch05`: 3/3 en Chrome headless.
- Desktop 1440×900 y móvil 390×844: compositor y ledger utilizables sin desbordamiento horizontal global.
- `npm run parity:generate`: 128 requisitos acumulados; 0 `MISSING`, 0 `CONFLICTS_WITH_VIDEO`.
- `npm run audit:verify`: 17/17 capítulos estructuralmente verificados.
- `git diff --check`: sin errores de whitespace (sólo advertencias esperadas LF/CRLF de Git en archivos existentes).

## Límite explícito

No se copiaron precios, impuestos, existencias, nombres de pacientes ni reglas clínicas del video. La migración y el adaptador tienen pruebas contractuales estáticas; ejecutar los RPC contra un proyecto Supabase sintético conectado sigue pendiente de infraestructura y no se presenta como validación runtime.
