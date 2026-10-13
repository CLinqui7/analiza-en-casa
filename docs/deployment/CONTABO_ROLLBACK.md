# Recuperación y regreso seguro

## Fallo de la nueva imagen, sin cambio de producción

La aplicación actual de Vercel continúa atendiendo a los clientes y no recibió escritura de esta migración. En la VPS, cada revisión de código queda en `releases/<SHA>` y antes de cambiar imágenes se guarda `releases/before-<SHA>.env`. Si una actualización falla, el operador debe inspeccionar salud y logs, detener únicamente la web de `analiza-contabo-staging`, recuperar **sólo** `WEB_IMAGE` y `OPERATOR_IMAGE` de ese archivo previo en el `.env` privado, ejecutar `docker compose up -d web` y comprobar `/api/health` y la sesión de administración. No revertir PostgreSQL ni borrar lotes de importación automáticamente: la migración 029 es aditiva y puede contener procedencia útil para ambas revisiones. Registrar SHA, snapshot, hora y resultado del regreso.

## Pérdida o corrupción de la base de staging

Conservar intacto el repositorio restic y su contraseña en custodia independiente. Detener escrituras sólo de esta instancia, ejecutar `restic check`, listar snapshots y restaurar el deseado a un directorio aislado. Verificar hash del dump, restaurar primero en un PostgreSQL descartable de la misma versión y comparar migraciones, organizaciones, catálogos, archivos y RLS. `restore-check.sh` ya demostró esa restauración para el snapshot de prueba. Sólo tras validar una recuperación concreta sustituir un volumen de staging bajo una ventana documentada; no usar ese procedimiento contra las bases originales. Mantener los volúmenes antiguos hasta verificar el nuevo servicio. La rotación, retención y custodia externa siguen pendientes de definir.

## Pérdida de la clave SSH

Si se pierde la clave del operador, utilizar la consola de recuperación autenticada de Contabo para instalar una nueva clave pública de `deploy`/`root` y probarla antes de retirar la anterior. El archivo aplicado para acceso sólo por clave es `/etc/ssh/sshd_config.d/00-analiza-key-only.conf`; cualquier cambio de emergencia requiere `sshd -t` antes de recargar el servicio. La contraseña de la consola del proveedor no se modificó con este despliegue.

## Futuro corte de dominio

No se efectuó. Antes de cualquier corte se necesita consentimiento explícito del propietario, inventario y autorización de datos sensibles, destino de backup externo, sincronización final con cursor verificable, pruebas con roles y archivos, HTTPS, ventana de escrituras y TTL/DNS conocido. Conservar Vercel y su base original como ruta de regreso. Si el nuevo entorno falla, volver el tráfico al destino original y reconciliar por separado toda escritura que hubiese ocurrido en la nueva instancia, usando claves de idempotencia y auditoría; no unir las dos bases a ciegas. Ninguna instrucción de este documento autoriza modificar DNS, producción o contraseñas actuales.
