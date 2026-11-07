# Publicación y mantenimiento de Contabo · 29 de octubre de 2026

## Código y estado activo

- La rama `codex/feedback-followup-20261014` y el PR #20 contienen los cambios de la reunión del 26 de octubre. El archivo de publicación se generó del commit `dfdcd98045cd806d7d85c582ba79681f1bea560c`; su SHA en GitHub coincidió antes de subirlo al VPS. El SHA-256 del archivo local y el recibido en Contabo coincidieron.
- La imagen web activa informa `dfdcd98045cd806d7d85c582ba79681f1bea560c`, está `healthy` y no registra reinicios. PostgreSQL está `healthy`. `/api/health` y `/login` públicos respondieron HTTP 200. Un navegador autenticado abrió de sólo lectura Cotizaciones, Cuentas por pagar, Ingresos clínicos, Reporte de pagos y Otros reportes.
- Las migraciones `037_quote_rejection_free_text.sql` y `038_purchase_invoice_approvals.sql` constan en `analiza.schema_migrations` de la base activa `analiza_live_20261014`. La nueva tabla tiene RLS habilitado y forzado; el rol de la aplicación tiene `SELECT` e `INSERT`, sin `UPDATE`. Su clave foránea a órdenes usa UUID.
- Antes de publicar, ambas migraciones se aplicaron dos veces sobre una base temporal creada sólo con el esquema de producción; se verificaron RLS, la clave foránea y la ausencia de datos reales. La base temporal se eliminó después.

## Hallazgo y corrección del respaldo

El `backup.sh` anterior respaldaba `analiza_en_casa`, una base que **no** atiende a la aplicación. El snapshot previo al despliegue (`574aff50`) se completó técnicamente, pero no se debe tratar como copia de la base activa. No asumir que los snapshots anteriores al cambio siguiente permiten restaurar `analiza_live_20261014`; conservar el archivo cifrado del corte inicial de Neon según la guía de operación.

En el commit `f719f0500cc23ff5f94373c90bca980648783454`, subido y verificado en GitHub antes de instalarlo, `backup.sh` obtiene `PGDATABASE` del contenedor web activo antes de detenerlo y añade `active-database.dump`, su nombre y SHA-256 al snapshot. Comprueba que el archivo no esté vacío y que `pg_restore` lea su índice. `deploy-release.sh` rechaza futuras migraciones si un snapshot nuevo carece de cualquiera de esos tres archivos. Ambos scripts se validaron con `bash -n`, se instalaron con los mismos permisos y se conservaron copias previas para reversión.

La ejecución manual del servicio de respaldo terminó con código 0; el timer sigue activo. El snapshot cifrado `e9768ef6` contiene `analiza_live_20261014`. Se leyó el dump desde restic, se comparó su SHA-256 con el manifiesto guardado y `pg_restore --list` pasó sobre ese contenido. La prueba del nuevo gate de despliegue pasó con ese snapshot. La aplicación volvió a responder HTTP 200. El monitor de salud coincidió con la breve detención de la web para el respaldo; se repitió con éxito y quedaron cero unidades `systemd` fallidas.

## Copia externa y capacidad

La tarea automática de Windows del 29 de octubre a las 07:49 hora de El Salvador terminó con código 0, antes de que existiera `e9768ef6`. La copia iniciada manualmente a las 09:44 terminó con código 0. Su manifiesto local registra 170 archivos cifrados, cada uno comparado por SHA-256, y `restic check --read-data` aprobado. En la copia externa se comprobó la presencia del archivo `snapshots/e9768ef6…` y su entrada en el manifiesto. La copia quedó en la ubicación privada de OneDrive descrita en la guía de operación; no se copiaron claves al repositorio.

El disco tiene 174 GiB disponibles de 193 GiB, UFW y la renovación automática de Certbot están activos, y la web no mostró líneas de error en los diez minutos revisados tras el despliegue. Hay 19 paquetes actualizables en Ubuntu; no se instalaron durante esta publicación porque requieren una ventana coordinada con los otros proyectos del VPS.

## Límites funcionales

La captura de costos, gastos y márgenes necesita las fuentes y reglas que dará el equipo. Los pagos a proveedores requieren una definición de conciliación. Guardar Atención y crear su turno son dos operaciones: si la segunda falla, la pantalla lo informa y pide revisar Agenda antes de reintentar. Las pruebas de producción fueron de lectura; no se crearon cotizaciones, ingresos ni pagos con datos reales.
