# Lote 2026-10-08 · domicilios, ventas, metas y feedback

## Decisión de producto confirmada

El cliente eligió “ventas confirmadas con referencia” para el indicador económico. Se creó un registro interno append-only con referencia única por organización, monto decimal en centavos, fecha, categoría, actor y auditoría. Una cotización enviada puede respaldarlo, pero no se convierte automáticamente en venta. Los importes no se etiquetan como utilidad, cobro ni factura fiscal. Semanas desde lunes y calendario `America/El_Salvador`.

## Nuevos reportes consultados en `/api/feedback` (2026-10-07)

| ID | Reporte | Cambio implementado | Certificación |
| --- | --- | --- | --- |
| `1a505f73-d815-430c-bdf1-b0c8cffad65d` | Perfil administrativo: significado de “Tipo”, medios de pago y error al guardar | Campo descriptivo aclarado; Efectivo/Cheque/Transferencia/Tarjeta; errores dentro del formulario y preservación de campos administrativos no editados. | Prueba de contrato y navegador sintético; requiere verificación posterior al despliegue antes de marcar RESUELTO. |
| `06923a9d-4554-4c1e-be6f-ac78da7f1708` | Cotización de paciente nuevo no visible en hospitalización | Anexado explícito al expediente del mismo paciente; el servidor valida organización, paciente y caso. La versión enviada permanece inmutable. | Prueba Mongo de vínculo y validación; requiere prueba productiva sin alterar expedientes reales. |
| `37e64616-d0a8-4998-8a44-936273ff771b` | PDF de cotización más comprensible para paciente | Tabla por categorías, concepto, cantidad, precio, descuento, subtotal y total destacado; encabezado repetido en multipágina. | Prueba PDF y render visual sintético de dos páginas; requiere verificar ruta desplegada. |
| `7bb83834-1c0a-40ce-8f59-06496d65246b` | Visitas, ingresos y gráficas comerciales | Nuevo tablero exclusivo de Claudia/Sissy con médicos contactados únicos, ingresos vinculados a hospitalización y ventas confirmadas vinculadas a visita. Dashboard general muestra ventas semanales y mensuales. | Pruebas de fechas/métricas y de permisos/duplicados; facturación fiscal sigue pendiente de definición. |

Los demás reportes en revisión sobre WhatsApp y facturación fiscal siguen abiertos: no hay proveedor, consentimiento, campos ni reglas autorizadas. No se cambia un estado a RESUELTO por la mera presencia de una pantalla.

Consulta productiva del 2026-10-08: 64 reportes, los mismos tres nuevos y seis en revisión; no surgió un reporte adicional. Tras desplegar y comprobar las rutas, los tres nuevos se pasaron a `REVIEWING` con una respuesta factual y la verificación pendiente de cada uno. Resultado: 0 nuevos, 9 en revisión, sin declarar ninguno `RESOLVED`.

## Movimiento domiciliario y evidencia de video

`CH14-E0018` (00:40:39) muestra origen/destino/paciente; `CH14-E0151` (00:45:27) muestra acuse con paciente, hospitalización, bodega, artículo y cantidad; `CH14-E0042` (00:41:43) muestra cierres. Las evidencias están en `references/video-audit/chapters/CH14_inventario_movimientos_acuses_cierres_bodegas_y_kits/event_frames/` y no se modificaron. El nuevo flujo de custodia domiciliaria es **adicional**, no certifica la paridad exacta de Acuses/Cierres del video: aquéllos incluyen más estados, áreas, aprobaciones y acciones no definidas. Se conservaron las superficies anteriores.

Al despachar se verifica paciente, artículo, bodega, existencia y lote vigente/liberado; se descuenta en una transacción y se audita en Kárdex. Al cerrar se registra cantidad físicamente recibida; se crea una retención de cuarentena, sin ingreso a existencias disponibles. La diferencia queda como no devuelta, sin presumir consumo clínico. Todo usa claves idempotentes y RLS por organización.

## Comprobaciones y límites

- `npm run check`: 133 pruebas, 76 controles QA y build standalone, aprobados.
- `npm run test:react`: 207 pruebas, aprobadas.
- `npm run audit:verify`: 17/17 capítulos aprobados; `npm run qa:video-parity`: 210/210 requisitos trazados, sin declarar nueva paridad exacta.
- Navegador sintético: 8/8 flujos de botones/feedback anteriores y 25/25 flujos CH14/ayuda/móvil aprobados. La regresión completa con build de producción tuvo 207/208 aprobados; el único fallo fue una expectativa anterior que suponía que el rol NURSE aterrizaba en Dashboard. El flujo actualizado, que confirma llegada a Pacientes y ausencia de botones de cotización, pasó aparte (1/1).
- Build Next.js: 53 páginas generadas, incluidas rutas nuevas.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run security:scan` y los gates de cliente/video aprobaron. La migración 026 se aplicó a PostgreSQL de producción y se verificaron RLS y FORCE RLS en sus siete tablas. No se insertaron datos de pacientes ni ventas reales durante esa comprobación.
- Despliegue productivo final `dpl_BcunSvarLt39GkAej8yiYuz5LkFQ` en `https://analiza-en-casa-demo.vercel.app`: estado READY, `/api/health` listo con PostgreSQL y las rutas de entregas, visitas/metas, ventas y feedback respondiendo 200; `/api/operations/access` respondió 401 sin sesión. Esto certifica despliegue y rechazo anónimo, no una mutación de negocio autenticada.
- La compilación detectó dos alertas altas de dependencias de producción, corregidas localmente fijando `sharp@0.35.5` y `source-map-js@1.2.2`; `npm audit --omit=dev --audit-level=high` ya no reporta alertas. Persisten cinco alertas altas en dependencias de desarrollo de ESLint, sin inclusión en el runtime de producción; requieren seguimiento separado sin forzar versiones incompatibles.
- Capturas sintéticas del build de producción: `docs/release/field-operations-dashboard.png` y `docs/release/field-operations-home-deliveries.png`. No contienen datos reales ni sustituyen las pruebas autenticadas pendientes.
- `npm run test:postgresql`: no pudo iniciar por ausencia del servicio Docker Desktop. No se atribuye un resultado favorable a esta prueba.

Quedan por validar: pruebas de extremo a extremo de mutaciones con cuentas de Claudia/Sissy y datos sintéticos en una base aislada, verificación productiva del PDF/feedback y del problema de guardado del perfil administrativo. Sólo después procede actualizar los reportes resueltos. Las pruebas móviles sintéticas de las rutas nuevas pasaron sin desbordamiento horizontal.
