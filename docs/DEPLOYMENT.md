# Distribución y preparación de despliegue

El alcance vigente es **Docker local y preparación de migración**.
El despliegue cloud está diferido; no requiere activar facturación para revisar
o ejecutar la entrega local.

- [Entrega Docker](deployment/DOCKER_HANDOFF.md): imágenes, construcción y QA local.
- [Preparación de migración](deployment/MIGRATION_HANDOFF.md): infraestructura y configuración.
- [Cloud Run](deployment/CLOUD_RUN.md): procedimiento futuro para el ingeniero.
- [PostgreSQL](deployment/POSTGRESQL.md): esquema, operaciones y permisos.
- [Estado verificable](release/CLOUD_RUN_SQL_STATE.json): evidencia y límites.

El destino preparado integra frontend y API en Cloud Run, PostgreSQL 18 en Cloud SQL,
archivos privados en GCS y secretos de runtime en Secret Manager.
Terraform y Cloud Build están preparados; esta guía no autoriza crear recursos,
activar facturación, ejecutar apply ni desplegar.

Los documentos Vercel/Supabase corresponden a integraciones históricas y se
conservan para trazabilidad. No son instrucciones de la entrega Docker actual.
