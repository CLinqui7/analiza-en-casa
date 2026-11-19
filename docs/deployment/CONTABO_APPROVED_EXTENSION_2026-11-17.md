# Ampliación de cotizaciones aprobadas · publicación del 17/11/2026

El usuario confirmó «Permitir ampliación auditada de una aprobada». La excepción está publicada en [Precotización](https://analiza.207.244.227.122.sslip.io/clinical/prequotes). Requiere motivo, añade sólo la solicitud seleccionada, conserva aprobación/versiones/pagos y vincula los nuevos insumos al mismo ingreso. La edición general y las rechazadas permanecen bloqueadas. [Fuente y QA](../qa/APPROVED_QUOTE_EXTENSION_2026-11-17.md).

| Evidencia | Valor |
|---|---|
| Release activo | `e1f0935b5111c78c2769486bda96098e93e8b8e1` |
| Código de aplicación probado | `05c422d5a47e724d51b9b7197d202503564813f8` |
| Archivo de publicación SHA256, local/remoto | `7c14e047842496dffbe7faca62685550768e216eb77b4baf680c26b90795f7b4` |
| Imagen nueva | `sha256:5aacf82dac47ffcff3bffd47612684079e458c058b8bf3ae1fd3e7a666c38b3f` |
| Release anterior conservado | `2629daaa362d665080de9c52f5ba666d2bd6e7bd` |
| Imagen anterior conservada | `sha256:e2a76659902bc86dbebcff219166c56aa0eefb8bb1be899d61b37a1f64784f98` |
| Respaldo previo | `09b7a730369611c3d942d174f765ff556a2c1e84a2d7fa43e175b9954f0552bd` |
| Hora del respaldo | 17/11/2026 23:32:35 El Salvador; 18/11/2026 06:32:35 CET |
| Base activa | `analiza_live_20261014` |
| Migraciones nuevas | Ninguna; se conserva el esquema hasta 041 |
| PR abierto, sin fusionar | https://github.com/CLinqui7/analiza-en-casa/pull/20 |

Se verificó el SHA remoto en GitHub antes de transferir el archivo. Se compiló la imagen, se realizó el respaldo con la validación del volcado de la base activa y se publicó el release. Hubo una conexión reiniciada transitoria en un chequeo durante el reinicio del respaldo; las comprobaciones posteriores y finales respondieron HTTP 200. No se ejecutó GitHub Actions ni se fusionó el PR.

QA previa: 370 pruebas unitarias/servidor, 30 grupos PostgreSQL, 31 escenarios mock y cuatro conectados aprobados. Se conservaron las pruebas de rechazo y permisos al introducir la excepción. Se revisó la captura móvil y se verificaron las migraciones repetibles con rol runtime sin bypass de RLS.

Comprobación pública de sólo lectura con la organización sintética: `/api/prequotes`, `/clinical/prequotes`, `/quotes`, `/receivables`, `/clinical/hospitalizations` y `/inventory/received-orders`. Las cinco páginas cargaron a 1440/768/390 px, sin errores JavaScript ni desbordamiento de página. No había opciones de cotización para solicitudes pendientes en esa organización pública; la escritura completa fue comprobada en QA aislado. No se generaron cargos, aprobaciones o entregas de prueba en producción. [Resultado](../feedback/evidence/part1-nov17/approved-extension-public.json).

Se retiraron los dos contenedores `analiza-clinical-qa-1794979051258`, su red, su imagen exclusiva de QA, los dos túneles SSH y los archivos de credenciales efímeras locales/remotos. El contenedor incompleto de la preparación inicial también se retiró. No tenían volúmenes de producción. La aplicación y PostgreSQL quedaron saludables después de la limpieza, con la etiqueta de release correcta y salud HTTP 200.

Se mantiene la imagen anterior como recurso de recuperación. No restaurar ni borrar datos automáticamente: las nuevas ampliaciones, motivos y entregas deben conservarse. No se actualizó Ubuntu/Docker ni se reinició el host. La copia externa y restauración del nuevo snapshot no se verificaron en este lote; la comprobación local del despliegue no sustituye esas verificaciones. El aviso de espera de red al arranque documentado en la entrega anterior no se modificó.
