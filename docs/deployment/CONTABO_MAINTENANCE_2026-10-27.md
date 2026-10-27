# Mantenimiento de Contabo · 27 de octubre de 2026

Solicitud directa: «revisa ele stado del proyecto revisa que todo funcione bien y revisa estos 2 errores ... luego haz mantenimiento al vps ...». No se usan datos de la organización principal para pruebas de escritura.

## Estado comprobado

- Web y PostgreSQL sanos, sin reinicios de contenedor; `/api/health` responde HTTP 200. Sin unidades `systemd` fallidas ni errores recientes de la web en el registro consultado.
- Disco principal: 193 GiB totales, 175 GiB libres; aproximadamente 10 GiB de RAM disponibles. Nginx, Docker, UFW, el temporizador diario de respaldo y el temporizador de renovación `snap.certbot.renew.timer` activos. El certificado público de Analiza vence el 12 de enero de 2027.
- Las copias diarias del VPS del 24 al 27 de octubre terminaron correctamente. El despliegue de Agenda generó el snapshot cifrado `0a498f1d`, cuya comprobación restic pasó.
- La copia externa de Windows iniciada a las 08:05 del 27 de octubre falló porque un respaldo nuevo añadió un índice restic mientras la copia estaba en curso. El origen del VPS continuó íntegro. Se compararon los SHA-256 de los 150 archivos cifrados con el origen, se recuperó el índice faltante y la copia local pasó `restic check --read-data` antes de finalizar. La tarea programada conserva código de salida 1 para aquella ejecución; la copia verificada quedó completada mediante recuperación manual.

## Correcciones operativas

- `deploy/contabo/backup.sh` falla de forma visible si no puede adquirir el bloqueo. Antes salía con código 0 sin tomar una copia nueva.
- `deploy/contabo/deploy-release.sh` exige un identificador de snapshot nuevo antes de permitir una migración de base.
- `deploy/contabo/copy-encrypted-restic.py` calcula hashes en el VPS de forma agrupada para reducir lecturas SFTP, omite archivos de bloqueo efímeros y reintenta la verificación si aparecen nuevos índices o paquetes durante la transferencia. Conserva la comparación SHA-256 y `restic check --read-data`.

Antes de instalar estos scripts en el VPS o en la tarea programada local, el commit correspondiente debe estar en GitHub y su SHA remoto verificado. Después se comprobará el bloqueo de respaldo, el despliegue de Finanzas y una nueva copia externa cifrada. La siguiente ejecución automática diaria seguirá siendo una comprobación independiente. Hay actualizaciones de paquetes Ubuntu y Docker disponibles; no se aplicaron durante este lote para evitar un reinicio ajeno a los dos cambios solicitados.
