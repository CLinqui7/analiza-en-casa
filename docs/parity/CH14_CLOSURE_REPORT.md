# CH14 · Cierre exacto de inventario

## Resultado

CH14 queda cerrado para avanzar sólo después de este checkpoint. La auditoría exhaustiva abrió 152/152 event frames, 76/76 detail crops, 17/17 hojas de eventos y 22/22 hojas de seguridad: 267 imágenes únicas y 275 artefactos totales. No fue necesario abrir el clip exacto porque frames, crops y hojas resolvieron las ambigüedades.

La matriz exacta añade 29 requisitos CH14: 7 `IMPLEMENTED_EXACT`, 14 `IMPLEMENTED_PARTIAL`, 6 `NEEDS_CLIENT_CONFIRMATION`, 2 `NOT_TESTABLE`, 0 `MISSING` y 0 `CONFLICTS_WITH_VIDEO`. El último requisito cerrado es `CH14-H005`; el primero pendiente es `CH15-R001` y aún no se creó ni auditó.

## Implementación y límites seguros

- Inventario reproduce pestañas, cantidades disponible/comprometido/total, búsqueda, tabla, CSV y navegación.
- El historial por item muestra rango documental, lote/serie, origen, destino, cantidad, entrada/salida y estado sin alterar existencias.
- Acuses reproduce pestañas, tabla, acciones y formulario observado; todas las mutaciones cuyo contrato falta quedan bloqueadas.
- Cierres reproduce pestañas, tabla, advertencia y acciones; crear/aprobar/cancelar permanece bloqueado.
- Proveedores, bodegas, lotes/series y kits tienen superficies trazables con datos sintéticos; sus CRUD no afirman éxito.
- La carga Supabase reconstruye bodegas, items, lotes, movimientos, reservas, cierres y kits.
- El movimiento Supabase usa confirmación remota y la RPC idempotente/transaccional antes de reflejar éxito local.
- RLS y revocaciones cierran DML directo en inventario, reservas, cierres y kits; las lecturas validan tenant y padres.
- El P0 local detectado durante la revisión quedó cerrado: todo movimiento local de un catálogo `requiresLot` falla antes de modificar stock, lotes, movimientos o auditoría. Producción usa la RPC que valida lote, estado, vencimiento y cantidad.

## Bloqueos del cliente

Las 15 decisiones `CH14-Q001`–`CH14-Q015` cubren semántica de comprometido, ciclo de acuses y faltantes, impresión/Excel, recuperación y máquina de cierres, identidad y ciclo de proveedores/bodegas, lote/serie/FEFO, versionado y consumo atómico de kits, la frase ambigua de cotización y comportamiento de errores. Ninguna se convirtió en regla inventada.

## Evidencia de navegador

- `docs/parity/screenshots/ch14-inventory-1440x900.png`
- `docs/parity/screenshots/ch14-acknowledgements-mobile-390x844.png`

La tabla móvil usa scroll interno y no genera overflow horizontal global.

## Pruebas

- `node --test tests/ch14-inventory-boundaries.test.mjs`: PASS, 6/6.
- `npm run test:browser:ch14`: PASS, 2/2.
- `npm run check`: ejecutado una vez; detectó una prueba P0 obsoleta que seleccionaba un medicamento sin lote y se detuvo en 81/82. La prueba se alineó con el guard CH14; no se repitió el comando.
- Suite completa posterior: PASS, 82/82; QA: PASS, 75/75; standalone: PASS, 711,425 bytes.
- `npm run audit:verify`: PASS, 17/17 capítulos, 0 pendientes, 0 fallos.
- `npm run codex:preflight`: PASS, 6,498 archivos, 1,359 eventos, 730 recortes, 17 clips, 0 errores, 0 advertencias.

## Limitación de runtime

No se ejecutó Supabase real/local: no hay proyecto/CLI/base configurada en este entorno. La migración y los contratos SQL tienen validación estática, pero RLS, RPC y concurrencia permanecen `IMPLEMENTED_PARTIAL` en runtime hasta una prueba con dos organizaciones en una instancia autorizada.
