# Publicación clínica y mantenimiento — 4 de noviembre de 2026

- Aplicación activa: `fc7e4c6206e1f4b01f6e24ad4395d88b8a816640`, confirmada en GitHub antes de publicar y en la etiqueta de la imagen activa después.
- Código funcional probado: `bebe3f6b4697a74be3c1a574207f65fdde743552`. El commit de publicación añade la certificación y evidencias de ese código.
- Archivo de publicación SHA-256: `0bc189d765d954d8afbc58ac6c7d8b109fdc8bcb11e30804e894f66bbdb5c172`, idéntico en Windows y VPS.
- Imagen anterior de reversión: `5dab7a143f0a9acbf799a272bf14a1a8fa310d72`; no se eliminó.
- Migración aditiva: `039_clinical_records.sql`. RLS obligatorio, referencias por organización, registros inmutables y permisos SELECT/INSERT para el rol de ejecución. No se habilitaron UPDATE/DELETE en esta tabla.
- Respaldo antes del DDL: `5e6c03c2`. Respaldo previo al cambio final de imagen: `a99365ec`. El despliegue comprobó un snapshot nuevo y los archivos de la base activa (`active-database.dump`, nombre y hash).

La primera invocación desde una tubería completó respaldo y migración, pero el comando interactivo de Docker consumió la entrada restante y no cambió la web. Se ejecutó de nuevo el archivo extraído, con migración idempotente y un nuevo respaldo, y se verificó la imagen activa. **Ejecutar el script de despliegue desde un archivo mediante `bash ruta/deploy-release.sh SHA archivo.tar`; no pasar el script completo por stdin.**

## Comprobación después de publicar

La salud pública respondió HTTP 200. Web y PostgreSQL están saludables. El script de comprobación autenticada pasó cinco grupos: identidad/organización sintética, persistencia clínica e idempotencia, configuración por categoría, doce rutas privadas y recarga del expediente sin errores de JavaScript. Los datos nuevos de QA permanecen exclusivamente en la organización sintética, separados de los datos operativos.

Se conservó el respaldo de reversión y se retiró el entorno temporal de QA: contenedores, red, etiquetas de imagen, directorio de compilación, archivos de entorno y túneles. Las tres credenciales temporales locales de QA fueron eliminadas mediante rutas explícitas; los accesos de producción permanecen privados.

## Estado del VPS

No hay unidades systemd fallidas. El respaldo programado del VPS muestra `Result=success` y `ExecMainStatus=0`. Disco después del despliegue: 23/193 GB, 12% utilizado, aproximadamente 171 GB disponibles. No había marcador de reinicio requerido. Se mantienen 19 actualizaciones pendientes, incluidas Docker/containerd. No se ejecutó un cambio de versión de Ubuntu ni un reinicio de sus servicios para aplicar ese lote.

La última copia externa de Windows estaba interrumpida (`3221225786`). Se inició de nuevo la tarea existente `Analiza-Contabo-Offsite-Restic` a las 01:11:29 de El Salvador y terminó con código 0. El manifiesto `snapshot-20261104T071131Z/copy-verification.json`, finalizado a las 01:16:19, confirma **210 archivos cifrados comparados por SHA-256 y `restic check --read-data` aprobado**. La siguiente ejecución programada figura para las 07:00; no se afirma su resultado futuro.

## Evidencia y alcance

[Informe de implementación, pruebas y capturas](../feedback/CLINICAL_RESTRUCTURE_2026-11-03.md) · [Guía para el equipo](../feedback/GUIA_CLINICA_2026-11-04.md).

Logs locales: `C:/Temp/analiza-nov04-production-release-final.log` y `C:/Temp/analiza-nov04-production-smoke.log`. La publicación no modifica el estado de otros proyectos del VPS, no ejecuta GitHub Actions y no fusiona el PR automáticamente. Los límites de reglas no aportadas y la paridad histórica parcial continúan explícitos en las matrices.
