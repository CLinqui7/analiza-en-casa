# Cierre secuencial de CH13

Fecha: 2026-08-27 (America/El_Salvador)

## Resultado

CH13 queda cerrado para iniciar CH14. Sus 11 features consolidadas quedan en 4 `IMPLEMENTED_EXACT`, 4 `IMPLEMENTED_PARTIAL` y 3 `NEEDS_CLIENT_CONFIRMATION`. Sus 23 requisitos exactos/endurecimiento quedan en 14 `IMPLEMENTED_EXACT`, 3 `IMPLEMENTED_PARTIAL`, 1 `NOT_TESTABLE` y 5 `NEEDS_CLIENT_CONFIRMATION`, con 0 `MISSING` y 0 `CONFLICTS_WITH_VIDEO`. Todo efecto no demostrado o que depende de reglas de negocio permanece visible y bloqueado.

## Evidencia revisada

- Se abrieron 92/92 event frames y 44/44 detail crops individuales.
- Se revisaron 11/11 hojas de contacto de eventos y 12/12 hojas de seguridad que cubren 190 muestras.
- Se revisaron README, cobertura, manifiestos, transcripción y demás artefactos textuales aplicables: 167 archivos únicos de evidencia, 159 imágenes únicas y 171 aperturas visuales.
- No fue necesario reproducir un segmento del clip exacto: frames, recortes, hojas y transcripción resolvieron las ambigüedades. El recibo conserva la comprobación de disponibilidad e integridad del clip.
- `event_review_notes.csv` mantiene 92 observaciones no vacías, una por CH13-E0001–CH13-E0092, con timestamp y ruta literal.
- Los fixtures, pruebas y capturas usan exclusivamente datos sintéticos.

## Cambios cerrados

- Compras reproduce la tabla observada con Acciones, Tipo, Número, Proveedor, Total, # Factura, Fecha, Estado y Registro PT; incorpora búsqueda, cantidad de registros, paginación y exportación CSV compatible con Excel.
- Nuevo abre el selector exacto entre Orden de compra y Caja menuda.
- El compositor de orden captura fecha, factura, observaciones y múltiples líneas con catálogo buscable, proveedor, presentación, costo y cantidad.
- Caja menuda añade proveedor de cabecera, control de archivo explícitamente bloqueado, importes manuales de impuesto y descuento, Extra y resumen vivo de totales.
- No se infiere una tasa de IVA, precio histórico, estado, Registro PT, recepción ni entrada de inventario.
- Guardar crea únicamente un borrador; Atrás abandona sin persistir.
- El detalle de sólo lectura muestra cabecera, adjunto, líneas y desglose financiero.
- El menú conserva Ver, Editar detalles, Copiar, Imprimir PDF, Imprimir con montos, Imprimir en Excel y Anular. Las mutaciones y salidas oficiales sin reglas confirmadas permanecen bloqueadas o provisionales.

## Persistencia y seguridad

- `createPurchase` valida permisos, modalidad, fecha, factura, límites, referencias organizacionales, importes no negativos e idempotencia; en modo Supabase no actualiza el espejo local ni muestra éxito antes de la confirmación remota.
- El bootstrap normaliza proveedores, catálogo, compras y líneas desde snake_case para evitar listas vacías o fallos por `items` ausentes.
- `202608270009_ch13_purchase_drafts.sql` crea una RPC transaccional `SECURITY DEFINER` con `search_path` seguro, bloqueo de idempotencia, derivación de organización y validación tenant-safe de proveedor y catálogo.
- La RPC recalcula subtotal, impuesto, descuento, extra y total a partir de importes monetarios explícitos; persiste cabecera, líneas, evento y auditoría en una sola transacción y sólo con estado `DRAFT`.
- Las políticas de lectura cruzan cada línea con su compra y organización padre. Se eliminan las políticas genéricas y se revoca DML directo sobre compras, líneas y eventos.
- La creación de borradores no genera aprobación, recepción ni movimiento de inventario.

## Bloqueos del cliente

`CH13-Q001`–`CH13-Q014` documentan: máquina de estados; evento de inventario; recepciones parciales, lotes y series; impuestos y redondeo; semántica de Extra; descuentos; adjuntos privados; unicidad de factura y numeración; Registro PT; edición y versionado; Copiar; formatos de salida; anulación; y precios históricos/presentaciones.

## Verificación

- `npm test`: PASS, 76/76.
- `npm run qa`: PASS, 75/75.
- `npm run build:standalone`: PASS, 695,512 bytes.
- `npm run test:browser:ch13`: PASS, 2/2.
- Regresión acumulada CH01–CH13: PASS, 36/36 en Chrome headless.
- Escritorio 1440×900 y móvil 390×844 revisados visualmente; la tabla usa scroll interno y no existe overflow horizontal global.
- Screenshots: `ch13-purchase-composer-1440x900.png`, `ch13-purchase-totals-1440x900.png`, `ch13-purchases-1440x900.png` y `ch13-purchases-mobile-390x844.png` en `docs/parity/screenshots/`.
- `npm run parity:generate`: 300 requisitos acumulados; 131 exactos, 97 parciales, 19 no verificables, 53 decisiones de cliente, 0 faltantes y 0 conflictos.
- `npm run audit:status`: 17/17 capítulos con recibos y 1,359/1,359 notas completas.
- `npm run audit:verify`: PASS, 17/17 capítulos, 0 pendientes y 0 fallos.
- Maestro: 210 features, 120 preguntas abiertas y 7 hallazgos de seguridad.
- La migración no se ejecutó contra una instancia Supabase real; concurrencia y RLS persistente siguen requiriendo validación en un proyecto configurado.

## Límite explícito

CH13 entrega únicamente borradores transaccionales, tenant-safe, idempotentes y auditados. Adjuntos, aprobación, recepción, Registro PT, edición, copia, anulación, formatos oficiales e inventario permanecen cerrados hasta que el cliente defina sus reglas y se validen en Supabase real.
