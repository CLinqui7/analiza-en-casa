# Documentación técnica

## Entrada recomendada para una revisión

| Documento                                             | Contenido                                             |
| ----------------------------------------------------- | ----------------------------------------------------- |
| [README del proyecto](../README.md)                   | Alcance, instalación y comandos                       |
| [Arquitectura](ARCHITECTURE.md)                       | Frontend, API, persistencia, autenticación y archivos |
| [Notas de versión](../RELEASE_NOTES.md)               | Entrega verificada y limitaciones                     |
| [Docker](deployment/DOCKER_HANDOFF.md)                | Imagen web, operator y QA local                       |
| [PostgreSQL](deployment/POSTGRESQL.md)                | Esquema, operaciones y permisos                       |
| [Operación local](RUNBOOK.md)                         | Salud, diagnóstico, reinicio y recuperación           |
| [Preparación cloud](deployment/MIGRATION_HANDOFF.md)  | Configuración preparada; despliegue diferido          |
| [Estado de entrega](release/CLOUD_RUN_SQL_STATE.json) | Referencias verificables y alcance                    |
| [Contribución](../CONTRIBUTING.md)                    | Revisión, seguridad, pruebas y trazabilidad           |

## Requisitos y evidencia

`qa/CLIENT_CHANGE_REQUESTS.json` conserva las solicitudes del cliente;
`qa/VIDEO_TO_REACT_TRACEABILITY.json` conserva su trazabilidad funcional.
Los asuntos de negocio sin confirmar permanecen en [OPEN_QUESTIONS](OPEN_QUESTIONS.md)
y [MASTER_OPEN_QUESTIONS](MASTER_OPEN_QUESTIONS.md).

La evidencia fuente está en `../references/video-audit/`; los registros de revisión,
en `../video-audit-reviews/`. Los nombres originales de esos materiales se conservan
para que sus referencias y hashes sigan siendo verificables. Consultar
[VIDEO_AUDIT_SETUP](VIDEO_AUDIT_SETUP.md) para el procedimiento.

## Registros históricos

Los directorios `history/`, `overnight/`, `parity/` y `handoffs/` conservan resultados
de fases anteriores. Sus tecnologías, comandos, ramas y conteos corresponden al
checkpoint indicado; no sustituyen las instrucciones actuales de este índice.
Las matrices, recibos y resultados se mantienen para revisar qué se comprobó y cuándo.

Las guías `SUPABASE_SETUP.md`, `VERCEL_SETUP.md`, `VERCEL_DEPLOYMENT.md` y los reportes
Mongo pertenecen a integraciones anteriores. El contenedor PostgreSQL no depende de
esos servicios ni cambia a ellos si SQL falla. No utilizar una guía histórica para
configurar la entrega Docker actual.
