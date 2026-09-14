# Entrega técnica

Consultar el [índice de documentación](README.md) para revisar el proyecto.
La entrega actual es Docker con PostgreSQL 18; el despliegue cloud está diferido.

La distribución verificada está en
[analiza-docker](https://github.com/CLinqui7/analiza-docker), con fuente fijada al
commit `6fae1890af99a7913092aea248cb120bd595e335`, imágenes exportadas y SHA256.
Los cambios posteriores de mantenimiento del repositorio no alteran esos archivos.

El código de la aplicación está en `apps/web/`. Revisar
[arquitectura](ARCHITECTURE.md), [persistencia](deployment/POSTGRESQL.md),
[operación](RUNBOOK.md) y [contribución](../CONTRIBUTING.md).
La evidencia del contenedor se enlaza desde
[el estado de entrega](release/CLOUD_RUN_SQL_STATE.json).

Las matrices y los registros históricos conservan los requisitos y asuntos
pendientes; no amplían el alcance Core certificado ni implican un despliegue.
