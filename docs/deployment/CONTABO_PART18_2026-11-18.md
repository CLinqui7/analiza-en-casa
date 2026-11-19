# Correcciones part18 publicadas el 18 de noviembre de 2026

Publicado: responsable administrativo bloqueado y protegido en servidor; Solicitudes de insumos dentro de Clínico; una acción Añadir a cotización con precio explícito cuando falta en catálogo; búsqueda por nombre/DUI en Pedidos recibidos. La asignación conserva la misma cotización lógica/cuenta, motivo, versiones, pagos e ingreso. [Fuente y pruebas](../qa/CLIENT_PART18_2026-11-18.md).

| Evidencia | Valor |
|---|---|
| Release activo | `cc009b15d0c273f17ae4c667ab7c10f6924f4ad3` |
| Código funcional probado | `eed8f47cffe4778253c27bc757d50d37d74edfb6` |
| Ajuste visual final probado | `cd1214b7c41917d47879245e0dedbb11d9451dee` |
| Archivo SHA256 verificado local/remoto | `87ca05453eb832e5098c57250d4e60a16621418415d201882067dfe12f908043` |
| Imagen activa | `sha256:ba0bf46f727cdf40463de1cd0467133f73eb16b5f86f712332bbbf19326b38d2` |
| Release anterior conservado | `614b1b4bca2f93de4b85414504581ffe9803b3e2` |
| Imagen anterior conservada | `sha256:ceb4fe64e37a3343c3dfef78526efbba8910962e0f5030c5f768bc5aeb75a797` |
| Respaldo previo | `6aacf74410e77897fb4dfd9df8633b6ce01fe0b22913087ba599e7554692e5f7` |
| Fecha del respaldo | 18/11/2026 09:20:45 El Salvador; 16:20:45 CET |
| Base activa | `analiza_live_20261014` |
| Migraciones nuevas | Ninguna; esquema conservado hasta 041 |
| PR abierto, sin fusionar | https://github.com/CLinqui7/analiza-en-casa/pull/20 |

Se verificó el SHA remoto en GitHub antes de transferir el archivo, tanto para QA como para producción. El código de aplicación publicado coincide con el ajuste final probado; el siguiente commit previo al despliegue incorpora evidencia. El despliegue compiló las imágenes, ejecutó el respaldo con validación del volcado de la base activa, verificó las migraciones existentes y sustituyó el contenedor web. La etiqueta de revisión coincide con el release y web/PostgreSQL están saludables. No se ejecutó GitHub Actions ni se fusionó el PR.

Regresión: 376 pruebas unitarias/servidor, 19 grupos PostgreSQL aislados, 58 escenarios mock distintos y ocho conectados aprobados con repeticiones focalizadas documentadas. Pasaron además 144 legacy, 76 controles QA, TypeScript, ESLint, formato, builds, seguridad, límites React y auditoría/trazabilidad. Las capturas finales de escritorio y móvil se abrieron y revisaron. No se certifica una nueva revisión completa de los 17 vídeos.

Comprobación pública con la organización sintética: lectura de API, validación de búsqueda, CSRF estable y seis páginas (`/quotes`, `/clinical/prequotes`, `/receivables`, `/inventory/suppliers`, `/inventory/received-orders`, `/supply-requests`) a 1440/768/390 px. Cero errores JavaScript o desbordamientos, buscador visible y enlace de solicitudes dentro de Clínico. HTTP 200. No había solicitudes pendientes en la organización sintética pública; el guardado, precio faltante y cuenta única se verificaron en PostgreSQL aislado. No se crearon operaciones financieras de prueba en producción. [Resultado público](../feedback/evidence/part18-nov18/public-release.json).

La revisión agregada de producción encontró que los cinco pedidos pendientes no tenían precio en catálogo. No se asignaron ni se inventaron importes: ahora el equipo puede capturar el precio de cada solicitud al añadirla. Esta captura no cambia el catálogo. Si el catálogo ya tiene precio, se conserva su validación. La imagen anterior es una opción de recuperación de aplicación, pero no restaurar/borrar datos automáticamente: los nuevos precios confirmados, asignaciones, pagos e historial deben mantenerse.

Se retiraron exclusivamente los dos contenedores `analiza-clinical-qa-1795013939529`, la red, dos imágenes/fuentes de QA, archivos privados remotos y ambos túneles SSH. Los montajes eran tmpfs; no se tocaron volúmenes de producción. Los archivos privados efímeros locales permanecen fuera de Git, en `C:/Temp/analiza-part18-qa-private`, sin servicios asociados activos.

El monitor y el respaldo automático están activos; la última ejecución automática del respaldo indicó éxito antes del despliegue. Memoria y disco tenían capacidad disponible. Se conserva el aviso preexistente de `systemd-networkd-wait-online.service`, con conectividad operativa. No se cambió Ubuntu/Docker ni se reinició el host. La copia externa y restauración del nuevo snapshot no se verificaron en este lote.
