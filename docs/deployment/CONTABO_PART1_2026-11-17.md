# Publicación del documento parte1ana · 17 de noviembre de 2026

Estado: publicada y comprobada. URL: https://analiza.207.244.227.122.sslip.io/.

## Identidad del release

| Evidencia | Valor |
|---|---|
| Release activo | `2629daaa362d665080de9c52f5ba666d2bd6e7bd` |
| Lógica verificada en QA conectada | `0d4990de09b77eba5de07de17c464a888019338b` |
| Rama | `codex/feedback-followup-20261014` |
| PR abierto, sin fusionar | https://github.com/CLinqui7/analiza-en-casa/pull/20 |
| SHA256 del archivo de publicación, local y remoto | `2579c44b915b508580b371a2a0e10f28c1054de559edbd3ad7ace3b89c15a8f2` |
| Imagen web nueva | `sha256:e2a76659902bc86dbebcff219166c56aa0eefb8bb1be899d61b37a1f64784f98` |
| Release anterior conservado | `eaa4fbc55a9a0389ff90e134b186c48f0c8a498b` |
| Imagen web anterior conservada | `sha256:85602f327fced62ac42c3a9a87ddc1ffe4a93d663aaa4da12da861cb1774fca4` |
| Base activa | `analiza_live_20261014` |
| Nuevas migraciones | `040_patient_dependents.sql`, `041_quote_fulfillment.sql` |
| Snapshot previo | `ed59ca9dc13626f539dc5e8b1ba69df5c233d3783fe56f59acd2a86a16bc1fe7` |
| Hora del snapshot | 17/11/2026 21:27:57 CET; 14:27:57 El Salvador |

GitHub contenía el commit antes de transferir el archivo. Se comprobó el hash, se compilaron web y operador, se ejecutó el respaldo con la comprobación del volcado de la base activa y se aplicaron las migraciones antes de recrear la web. El chequeo durante el reinicio del respaldo tuvo una respuesta vacía transitoria; se recuperó y las comprobaciones posteriores respondieron HTTP 200. No hubo fusión ni ejecución de GitHub Actions.

## Cambios entregados

- Dependientes del paciente, varios hijos y documentos privados separados por hijo/tipo.
- Responsable de cotización por defecto, estado Enviada manual, cuatro estados visibles y una fila/código por cotización lógica. Editar una enviada conserva una versión inmutable y actualiza la misma cuenta por cobrar con sus pagos.
- Aprobación con ingreso clínico para las tres modalidades, sin crear ingresos históricos automáticamente.
- Precotización con solicitudes de enfermería y asignación transaccional al paciente/cotización correcta, con precio del catálogo.
- Pedidos recibidos, entrega parcial o completa a enfermera, historial y protección contra duplicados/sobreentrega. No descuenta existencias.
- Directorio completo de proveedores desde Existencias; retirada de su entrada en Catálogos generales.

Guía para el equipo: [GUIA_PARTE1_2026-11-17.md](../feedback/GUIA_PARTE1_2026-11-17.md). Fuente, matriz y pruebas: [CLIENT_PART1_IMPLEMENTATION_2026-11-17.md](../qa/CLIENT_PART1_IMPLEMENTATION_2026-11-17.md).

## Comprobación

Antes de publicar: 370 pruebas unitarias/servidor, 144 legacy, 76 controles QA, 28 grupos PostgreSQL, 47 escenarios mock y 11 escenarios conectados aprobados entre las ejecuciones iniciales y sus repeticiones focalizadas. TypeScript, ESLint, compilaciones, gates CH01–CH03, auditoría de ledgers, trazabilidad, contrato de cambios y escaneo de secretos aprobados. Next.js 16.4.6; auditoría de dependencias de producción sin vulnerabilidades conocidas al comprobarla.

En la URL pública, con la organización sintética autorizada:

- Se creó un paciente sintético identificado como prueba, con un dependiente, y se guardaron/descargaron los dos tipos de documento con bytes idénticos. Se conserva para la evidencia; no se añadieron datos de pacientes reales.
- Se verificaron las API de las nuevas bandejas, decisiones e ingresos, los filtros de modalidades, responsable por defecto y reubicación de proveedores.
- Siete páginas afectadas revisadas a 1440, 768 y 390 px.
- Recorrido de 62 rutas: 61 disponibles y una restringida correctamente, con cero errores JavaScript y sin desbordamiento de página en los tres anchos. También se verificó navegación por teclado y «Ver devoluciones» como botón sin subrayado.
- No se crearon cargos, pagos, entregas ni aprobaciones financieras de prueba en producción; estos recorridos completos se ejecutaron en PostgreSQL aislado con el mismo código y rol runtime limitado.
- Web y PostgreSQL saludables, etiqueta de release correcta y `/api/health` HTTP 200 después de retirar QA.

Evidencia sin secretos: [funcional](../feedback/evidence/part1-nov17/public-functional-report.json), [resumen de rutas](../feedback/evidence/part1-nov17/public-route-summary.json), [detalle de rutas](../feedback/evidence/part1-nov17/public-route-details.json). El recorrido de rutas no certifica cada operación de todos los módulos ni una nueva revisión completa de los 17 videos.

## Limpieza y estado del host

Retirados los dos contenedores `analiza-clinical-qa-1794945130138`, su red y tres imágenes exclusivamente de QA. No tenían volúmenes montados ni datos de producción. Se cerraron sus dos túneles SSH y se eliminaron sus archivos privados de entorno locales/remotos y el archivo de estado con contraseñas efímeras. Se conservaron los resultados de pruebas. Las imágenes y volúmenes de producción no se eliminaron.

Al revisar: disco con unos 159 GiB libres (18% usado), memoria disponible aproximada 9,4 GiB antes de la publicación; timer de respaldo activo y ejecución programada del 17/11 con resultado satisfactorio. No se actualizó Ubuntu/Docker ni se reinició el host en este lote.

Hay un fallo preexistente de `systemd-networkd-wait-online.service`, desde el arranque del 13/11: eth0 es enrutable, pero permanece en estado de configuración para esa espera. La aplicación y SSH funcionan. Se conserva como incidencia operativa pendiente; no se alteró la red ni se borró su estado de error para aparentar una revisión limpia.

La copia externa y la restauración del nuevo snapshot `ed59ca9d` no se comprobaron en este lote. El respaldo local previo fue comprobado por el despliegue; esto no equivale a una restauración ni a una copia externa verificada.

## Límites funcionales y reversión

Precotización admite Borrador/Enviada. Aprobada/Rechazada permanece cerrada según el documento. El usuario aún no ha confirmado si desea una ampliación posterior a la aprobación; no se habilita por omisión. Los precios faltantes se completan en el catálogo por el usuario, sin inventarlos. Marcar Enviada no envía notificaciones automáticamente.

Se mantiene la imagen anterior como recurso de recuperación. Las migraciones son aditivas y no deben revertirse eliminando tablas o documentos. Una versión anterior no conoce dependientes ni entregas y podría descartar campos al editar: cualquier recuperación debe revisar compatibilidad y conservar los datos nuevos; no ejecutar una reversión automática de aplicación/base sin evaluar las escrituras posteriores.
