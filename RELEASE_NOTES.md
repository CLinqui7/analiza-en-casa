# Notas de versión

## Entrega Docker / PostgreSQL 18 — 14 de septiembre de 2026

Fuente verificada: `6fae1890af99a7913092aea248cb120bd595e335`.

- Frontend y API Next.js en una imagen standalone, con puerto 8080 y usuario no-root.
- Persistencia Core en PostgreSQL 18, permisos por usuario/organización y RLS.
- Operator separado para migraciones y seed sintético.
- Archivos privados mediante adaptador GCS; contenido fuera de PostgreSQL.
- Imágenes exportadas con SHA256 y configuración para construir desde GitHub.

La prueba del contenedor cubre login, navegación, pacientes, médicos,
hospitalizaciones, turnos, permisos, CSRF, reinicio con persistencia externa y
fallo SQL sin falso éxito ni fallback. GCS se probó mediante SDK y emulador local.

[Artefactos y resultados](https://github.com/CLinqui7/analiza-docker/releases/tag/docker-20260914-6fae189).

## Mantenimiento del repositorio

Se organiza la documentación de entrada alrededor de la arquitectura vigente,
el desarrollo, la revisión y Docker. Se retiran launchers de preparación inicial
y notas de automatización que no son parte de la aplicación. El preflight de
repositorio se ejecuta con `npm run repo:preflight`; conserva la verificación de
estructura, secretos, tamaño de archivos y evidencia.

Este mantenimiento no sustituye las imágenes publicadas ni promueve nuevos
estados de certificación funcional.

## Límites

La entrega SQL certificada comprende el Core. Las cotizaciones y demás módulos
excluidos conservan su código histórico y no se declaran migrados.
Cloud Run, Cloud SQL e IAM real permanecen sin despliegue verificado.
Los resultados locales no certifican capacidad productiva ni reglas de negocio
pendientes.

Los reportes de fases anteriores permanecen accesibles desde
[el índice documental](docs/README.md).
