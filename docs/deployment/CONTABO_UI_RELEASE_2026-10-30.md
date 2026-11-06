# Interfaz y mantenimiento de Contabo · 30 de octubre de 2026

La versión activa es `5dab7a143f0a9acbf799a272bf14a1a8fa310d72`. Código y certificación estaban en GitHub antes de crear el archivo de publicación. Su SHA-256 coincidió en ambos extremos. El despliegue finalizó con código 0; la imagen previa se conserva para reversión. El PR #20 sigue abierto, sin fusionar.

La web y PostgreSQL están saludables; Nginx valida su configuración, no hay unidades systemd fallidas y `/api/health` público responde HTTP 200. Las cuatro pantallas afectadas abren con sesión. La prueba `scripts/verify-ui-feedback-live.mjs` verificó persistencia en PostgreSQL del descuento parcial y alta/recarga de un visitador en la organización sintética de QA. Terminó con código 0 y limpió el borrador/desactivó el visitador con auditoría. No hubo escrituras de prueba sobre pacientes, cotizaciones ni pagos de la organización principal. No hay migraciones nuevas.

## Respaldos

Se detectaron tres locks caducados de restic: el proceso indicado ya no existía y no había ningún proceso restic activo. Se retiraron mediante `restic unlock`, sin `--remove-all`. La repetición del servicio pasó (`Result=success`, `ExecMainStatus=0`). El script versionado ahora comprueba acceso e integridad del repositorio antes de detener la aplicación.

El despliegue creó el snapshot `392b3c39`; el gate comprobó que era nuevo y contenía `active-database.dump`, `active-database.name` y `active-database.sha256`. El script validó el índice PostgreSQL del dump y ejecutó `restic check`. La web se detuvo brevemente para obtener el respaldo consistente y luego se recreó. El chequeo del despliegue apunta al puerto 18081 del contenedor publicado.

La tarea externa `Analiza-Contabo-Offsite-Restic`, iniciada manualmente a las 00:28 del 30 de octubre (El Salvador), terminó con código 0 a las 00:35. El manifiesto de `snapshot-20261030T062843Z` registra 182 archivos cifrados comparados por SHA-256 y `restic check --read-data` aprobado. El snapshot `392b3c39` está presente en la copia externa. La siguiente ejecución automática figura para las 07:00; su resultado futuro todavía no está observado. No se publicaron secretos ni dumps en Git.

## Ubuntu y capacidad

Ubuntu 24.04.5 LTS. No hay reinicio pendiente, `dpkg --audit` no reporta paquetes rotos. Disco: 193 GiB totales y 174 GiB libres antes de compilar; memoria disponible: aproximadamente 10 GiB. Docker, Nginx y el timer de respaldos están activos.

Se actualizaron los índices APT y se simuló la actualización: 19 paquetes actualizables, cero paquetes nuevos y cero eliminaciones. Lista: apparmor, libapparmor1, cloud-init, containerd.io, docker-ce, docker-ce-cli, docker-ce-rootless-extras, docker-compose-plugin, docker-buildx-plugin, gir1.2-glib-2.0, libglib2.0-0t64, libglib2.0-bin, libglib2.0-data, google-chrome-stable, open-vm-tools, snapd, tmux, ubuntu-pro-client y ubuntu-pro-client-l10n.

No se instalaron paquetes ni se cambió de versión de Ubuntu. Docker tiene `live-restore=false`; actualizar Docker/containerd puede interrumpir los contenedores. Coordinar una ventana para todos los proyectos, hacer respaldo verificado, repetir la simulación, aplicar el conjunto y comprobar cada aplicación y sus bases antes de cerrar mantenimiento. No se necesita migrar a otra versión de Ubuntu para estas correcciones.

Ver [informe de cambios y pruebas](../feedback/UI_REVIEW_2026-10-29.md) y [guía de operación](CONTABO_OPERATOR_HANDOFF.md).
