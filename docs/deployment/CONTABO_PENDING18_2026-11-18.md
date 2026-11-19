# Correcciones pendientes publicadas el 18 de noviembre

Se publicó el orden exacto de Clínico, el responsable de cotizaciones visualmente deshabilitado y Precotización sin captura manual de precio. Por confirmación del cliente, los artículos sin precio de catálogo entran a cero; se informa el pendiente y se ofrece acceso al catálogo general filtrado. Los precios registrados allí se usan en incorporaciones posteriores, conservando los importes de versiones ya emitidas.

| Evidencia | Valor |
|---|---|
| Release activo | `e91949373a5d94c7fdc9b1eeecf2379629d7688c` |
| Lógica y ocho recorridos conectados iniciales | `51317f128fc228c8274d7cadf2f12662a0f3ce07` |
| Archivo SHA256 local/remoto | `31f8875332fc6408e589ec896d1d3ecb25cb9fd1c8b780c1850fc280c0dca159` |
| Imagen activa | `sha256:347830a81c6bca78435a3879dd117463dd496afdc010d5caab50c5fb56af23e3` |
| Release anterior conservado | `9f8307d99ec4647d1ded9f1656c4fb9e5fddb016` |
| Imagen anterior conservada | `sha256:46a89c830059f0b4ca66f4894e723b92c6509b45fcef29cfc9151635eaa5a4cd` |
| Respaldo previo | `98260cd4b541c72af901cdeb772f104f995a8f232f1de8f9dd2f2866f499155d` |
| Hora del respaldo | 18/11/2026 11:31:52 El Salvador; 18:31:52 CET |
| Base / esquema | `analiza_live_20261014` / `041_quote_fulfillment.sql` |
| Cambios de esquema o de Ubuntu | Ninguno |
| PR abierto sin fusionar | https://github.com/CLinqui7/analiza-en-casa/pull/20 |

Antes de transferir y ejecutar se verificó el SHA de la rama en GitHub y el hash del archivo remoto. El despliegue creó y comprobó el respaldo, validó las migraciones existentes y reemplazó la web. Hubo una respuesta transitoria de conexión reiniciada durante el reinicio; la salud final respondió HTTP 200 y el contenedor quedó saludable. Se conserva la imagen anterior para recuperación. No se ejecutaron GitHub Actions ni se fusionó el PR.

## Pruebas y revisión pública

382 pruebas unitarias/servidor, 37 grupos PostgreSQL, 58 escenarios mock y ocho conectados aprobados, con dos repeticiones finales después del arreglo visual. TypeScript, ESLint, formato, compilaciones, 144 pruebas legacy, 76 controles QA, seguridad, CH01–CH03, gate de cambios y auditoría histórica aprobados. El detalle distingue los ajustes de las pruebas antiguas Doctor y el problema visual encontrado antes de producción. [Fuente y QA](../qa/CLIENT_PENDING18_2026-11-18.md).

Prueba pública en organización sintética: añadir tres unidades sin precio mantuvo total 18.00, seguro 3.00, responsabilidad 15.00, pago 5.00 y saldo 10.00. Dos llamadas concurrentes produjeron una sola línea y una nueva versión; una cuenta tras recargar. Responsable bloqueado, orden exacto y tres anchos verificados, sin errores JavaScript. [Resultado](../qa/evidence/pending18-20261118/public-financial.json).

En la organización principal sólo se hicieron lecturas: el menú tiene el orden solicitado, el diálogo no contiene precio manual y conserva una sola acción Añadir a cotización y el aviso de precio pendiente. No se completaron precios ni se asignaron solicitudes reales. Los cinco artículos pendientes no tienen una importación con moneda sin conciliar; el bloqueo para otras fuentes sin moneda confirmada se conserva.

La copia externa y la restauración de este nuevo respaldo no se verificaron en este lote. Los datos y accesos privados quedan fuera de Git. Recuperación: configuración `/opt/analiza-contabo-staging/releases/before-e91949373a5d94c7fdc9b1eeecf2379629d7688c.env` e imagen anterior según la guía operativa. No restaurar una base antigua encima de operaciones nuevas sin conciliación.

Cierre operativo: se retiraron los dos contenedores QA, la red, dos imágenes, sus fuentes temporales y tres túneles; volúmenes productivos intactos. Web y PostgreSQL quedaron saludables, memoria disponible aproximadamente 9.8 GB y disco al 22%. `/api/health` respondió ready/HTTP 200.
