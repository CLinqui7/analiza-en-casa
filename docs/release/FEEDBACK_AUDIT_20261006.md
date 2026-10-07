# Auditoría individual de Feedback — 6 de octubre de 2026

Se consultaron los 60 reportes existentes en `/feedback` con una sesión WEBMASTER real. Al inicio había 8 nuevos, 4 en revisión y 48 marcados como resueltos. La columna «dictamen» distingue una función implementada y probada (`OK`) de una solicitud que sólo está cubierta en parte (`PARCIAL`). No se copian datos de pacientes ni adjuntos a este documento.

La prueba funcional enfocada de este lote es `apps/web/e2e/feedback-oct06.spec.ts` (5 casos) junto con `apps/web/e2e/ch13.spec.ts` (3 casos): 8/8 aprobados en modo sintético. Los controles de código, contratos y regresión cubren el resto; un `OK` antiguo indica evidencia de implementación y prueba de regresión, no una nueva transacción con datos de producción. Los casos parciales no deben figurar como resueltos aunque exista una parte de la interfaz.

| N.º | ID abreviado | Solicitud | Dictamen y comprobación |
| --- | --- | --- | --- |
| 01 | `470bff0c` | Impresión completa de cotización | OK: CSS de impresión libera alturas y desbordamiento; E2E de paginación. |
| 02 | `6f5307fb` | Filtro de catálogos | OK: filtro por nombre/código y estado; E2E. |
| 03 | `7835bae5` | Factura y búsqueda en compras | OK: número de factura y selector buscable; E2E. |
| 04 | `9f6fec2a` | Logo en cotización y estado de cuenta | OK: logo en PDF de cotización y estado individual; pruebas PDF. |
| 05 | `b223705c` | Etiquetas, factura, editar y anular compra previa | OK: edición/anulación sólo en borrador, motivo auditado; E2E y prueba Mongo. |
| 06 | `6bb3b449` | Misma plantilla al imprimir/descargar PDF | OK: una ruta PDF para versión enviada y visualización; prueba PDF multipágina. Borradores usan impresión CSS. |
| 07 | `463eeb43` | Honorarios de 0 y 15–300 en pasos de 5 | OK: lista controlada y valor legado visible al editar; E2E. |
| 08 | `a19a295d` | Estado individual de cuenta por paciente | OK: cargos y abonos del paciente seleccionado, PDF interno no fiscal; E2E y prueba PDF. |
| 09 | `2f7d88b6` | Enteros en días y porcentaje | OK: validación de cotización y regresión existente. |
| 10 | `b5733d2d` | Medios de pago y referencia | OK: efectivo/cheque/transferencia/tarjeta, referencia e idempotencia; pruebas de pagos. |
| 11 | `2d8d9561` | Editar visita | OK: agenda conserva edición; prueba de agenda. |
| 12 | `140d6902` | Cotizar paciente nuevo sin caso | OK: selector opcional y flujo de guardado; pruebas de cotización. |
| 13 | `1dd4e778` | Código corto de cotización | OK: listado/detalle muestran código; prueba de cotización. |
| 14 | `72dfa063` | Buscar abonos por paciente | OK: filtro en cuentas por cobrar; prueba de pagos. |
| 15 | `41774081` | Opción sin hospitalización | OK: formulario admite cotización sin caso; prueba de cotización. |
| 16 | `9120e6ea` | Guardar tras crear paciente | OK funcional; la respuesta anterior que decía «hospitalización obligatoria» es incorrecta y debe corregirse. |
| 17 | `7bb83834` | Indicadores de visitas, ingresos y facturación | PARCIAL: existen visitas/cobros, pero no una definición aprobada de facturación fiscal. `docs/OPEN_QUESTIONS.md`. |
| 18 | `11c6094e` | Bodegas y traslados | OK: CRUD y traslados atómicos con controles de existencia; pruebas de inventario. |
| 19 | `75ae2471` | PDF adjunto por WhatsApp | PARCIAL: PDF autenticado existe; envío/adjunto requiere proveedor, consentimiento y enlace seguro. |
| 20 | `df6a39dc` | Movimientos, Kárdex y lotes | OK: pantallas y trazabilidad de inventario; pruebas de inventario. |
| 21 | `7549ef34` | Buscar insumos/equipos y serie | OK: búsqueda por prefijo, serie para equipo; E2E de compras. |
| 22 | `c7ef7d96` | Abonos y factura al pagar | PARCIAL: abonos/comprobante no fiscal sí; factura fiscal sin definición de emisor/numeración/impuestos. |
| 23 | `fec3fae6` | Ver notas y signos de enfermería | OK: consulta clínica con permisos; pruebas clínicas. |
| 24 | `82a051cf` | Guardar plan de cuidados | OK: persistencia de plan; pruebas clínicas. |
| 25 | `092d1ab1` | Guardar cotización | OK: guardado de borrador y errores visibles; pruebas de cotización. |
| 26 | `da88572b` | Movimientos y Kárdex | OK: rutas y datos de inventario; pruebas de inventario. |
| 27 | `ba7845e1` | Crear compra | OK: borrador persistente por bodega; E2E de compras. |
| 28 | `9f16d217` | Importar pacientes Excel | PARCIAL: importador existente no certifica íntegramente esta carga en producción. |
| 29 | `fecfc66d` | Autoguardado entre pantallas | PARCIAL: no hay garantía transversal y multiusuario para todos los formularios. |
| 30 | `68fcf429` | Solicitud de insumos y WhatsApp | PARCIAL: no se envía información clínica por mensajería insegura; falta flujo completo aprobado. |
| 31 | `95a33bea` | Guardado y cotización a factura | PARCIAL: guardado funciona; conversión a factura no existe. |
| 32 | `b3e50674` | Reubicar dispositivos/enfermería | OK: navegación clínica separada; prueba de navegación. |
| 33 | `55b78121` | Catálogo por categoría y prefijo | OK: selector filtrado; pruebas de cotización. |
| 34 | `4242d3f9` | Perfil administrativo/seguros/médicos | OK: formularios separados y rutas correspondientes; pruebas de hospitalización. |
| 35 | `e55231dd` | Compra con proveedor, artículos y trazabilidad | OK: contrato y validaciones de borrador, bodega y lote/serie; E2E/prueba Mongo. |
| 36 | `060444e3` | Especialidades médicas | OK: catálogo/búsqueda y opción personalizada; pruebas de médicos. |
| 37 | `03ed8174` | Cierre de desplegable | OK: selector reutilizable; pruebas de cotización. |
| 38 | `cd550485` | Guardado de cotización | OK: flujo de borrador; pruebas de cotización. |
| 39 | `709e964d` | Quitar campos de presentación | OK: se usa presentación del catálogo; prueba de cotización. |
| 40 | `a3ec068c` | Aseguradora en paciente | OK: selector persistente; pruebas de pacientes. |
| 41 | `6216adf9` | Precio de catálogo y sólo cantidad manual | PARCIAL: precio se precarga, pero todavía puede editarse manualmente en cotización. |
| 42 | `bc6164dc` | Costo/venta sin IVA en catálogo y compras | OK: campos de catálogo y costo precargado en compras; pruebas de catálogos/compras. |
| 43 | `ded7885e` | Adjuntos/tipos/comentarios de supervisora | OK: perfil de enfermería y archivo privado; pruebas de administración. |
| 44 | `89c6afa1` | Aseguradoras y selector en hospitalización | OK: módulo y selector de nombre; pruebas de aseguradoras/hospitalización. |
| 45 | `76f679d4` | Guardar, editar y enviar cotización por WhatsApp | PARCIAL: guardar/editar sí; envío directo no está habilitado por seguridad/integración. |
| 46 | `12c011b0` | Categorías e importar catálogos Lab/Fisio/Imagen | PARCIAL: categorías/selector existen; faltan listados fuente autorizados para importación. |
| 47 | `ded0fcfe` | Ver todos los ítems cotizados | OK: ledger visible por categoría y resumen; pruebas de cotización. |
| 48 | `fbe015f8` | Búsqueda filtrada en todas las ventanas | PARCIAL: existe en pantallas principales, no se ha certificado cobertura universal. |
| 49 | `a967c27d` | Tres entornos de atención en cotización | OK: opciones en formulario; prueba de cotización. |
| 50 | `f00d66a9` | Diagnóstico y médicos en paciente | OK: campos y persistencia de paciente; pruebas de pacientes. |
| 51 | `a3cf58aa` | Honorario en médico | OK: campo en perfil; pruebas de médicos/cotizaciones. |
| 52 | `fbddaf5e` | JVPM y CONADEM opcionales | OK: ambos opcionales; pruebas de médicos. |
| 53 | `c07f94cc` | Crear usuarios con rol | OK: administración de cuentas/roles; inicio de sesión WEBMASTER comprobado en producción. |
| 54 | `11b35aef` | Sólo ítems de catálogo; quitar socio/giftcard | OK: selector de catálogo y campos retirados del flujo vigente; pruebas de cotización. |
| 55 | `92616b47` | Turnos simultáneos y de 12/24 h | OK: validación permite solape previsto y duraciones; pruebas de agenda. |
| 56 | `0682a1d2` | CRUD de categorías de catálogo | OK: crear/editar/activar/desactivar y SKU; pruebas de catálogos. |
| 57 | `d42b3fe0` | Nombres de ejecución y visitador médico | OK: etiquetas de navegación actualizadas; prueba de navegación. |
| 58 | `6793424f` | Diagnóstico y médicos en hospitalización | OK: formulario y persistencia; pruebas de hospitalización. |
| 59 | `af02a141` | «DUI» en paciente | OK: formulario usa DUI; pruebas de pacientes. |
| 60 | `103937fd` | «DUI» en dashboard | OK: etiqueta actualizada; prueba de dashboard. |

**Control de estados aplicado en producción:** 49 `RESOLVED`, 11 `REVIEWING`, 0 `NEW`; los 60 conservan respuesta cuando están resueltos. Los 11 abiertos son 17, 19, 22, 28, 29, 30, 31, 41, 45, 46 y 48. El n.º 16 conserva `RESOLVED`, pero su comentario ya aclara que la hospitalización no es obligatoria.

**Evidencia de despliegue y humo:** Vercel `dpl_73YS83BZGhdhxPYabjEiEsQgJyAX` quedó `READY` en `https://analiza-en-casa-demo.vercel.app`. Con la cuenta WEBMASTER se comprobó `/api/health` = 200, los filtros nuevos de Catálogos, las etiquetas y acciones de Compras, la lista de honorarios, el estado por paciente y las dos respuestas autenticadas de `/api/quotes/{id}/pdf` (descarga e impresión, ambas 200). La propia pantalla `/feedback` mostró los contadores 60/0/11/49 tras las correcciones. Dos intentos de *preview* fallaron después de compilar por la inyección de comentarios de Vercel en archivos estáticos; la publicación de producción sí finalizó. No se editó ninguna existencia ni un registro clínico para estas pruebas.

**Riesgo ajeno al lote:** `npm audit --omit=dev` informó dos avisos altos en dependencias transitivas (`sharp`/librsvg y `source-map-js`). No se cambió el árbol de dependencias dentro de este lote urgente sin validar la actualización y la compilación completa; deben remediarse y probarse por separado.
