# Auditoría de la segunda instancia de Analiza en Casa

Fecha: 2026-10-13. Alcance: inventario de código, configuración y metadatos; ninguna escritura en los sistemas originales.

## Origen y arquitectura

La implementación activa comprobada en Vercel es el commit `6c2273f3e210b9fea6b4da91dbbd865f03b1b331`, despliegue `dpl_716QvpBNwrsSKkDyPkZv7wkKGWoa`. El dominio actual es `analiza-en-casa-demo.vercel.app`. Se consultó el despliegue y sus variables mediante CLI/API; no se cambiaron. La aplicación activa usa la variante PostgreSQL. Existe código histórico MongoDB y documentación para ambos motores; compartir modelos no prueba equivalencia de datos ni de contratos. La copia de Contabo se construyó desde esta rama con el perfil Next.js completo y PostgreSQL 18, sin conectar a la base original.

Se revisaron `Dockerfile`, `deploy/ubuntu/`, scripts de migración, importación, sesiones, almacenamiento privado, semillas, pantallas de BI y configuración de CI/CD. El repositorio auxiliar `analiza-docker` se consultó en `11494b7b24dd088be0cdba37f4b95f14a06bd160`: empaqueta una revisión antigua y no es la fuente de esta copia. En el principal, `vercel.json` conserva `git.deploymentEnabled=false`; no hay `.github/workflows`. No se modificaron Vercel, dominios, cron ni proveedores de mensajería.

La base original tiene 30 entradas de migración; el checkout contiene 28 migraciones históricas y la nueva `029_import_provenance.sql`. Faltan en este checkout las fuentes originales `019_clinical_scale_captures.sql` y `020_account_profile.sql`, aunque figuran aplicadas en origen. Se requiere conciliar DDL, hashes y contratos antes de trasladar filas. La tabla clínica de escalas registra cero filas en el inventario de metadatos, pero eso no elimina la necesidad de reconciliar el esquema.

Las migraciones históricas `011_service_catalogs.sql` y `012_insurers_and_nurse_files.sql` incluyen catálogos predeterminados. En la VPS se aplicaron antes de crear la organización `Linqui`; por tanto no poblaron a esa organización ni se contaron como actividad comercial. La migración nueva guarda la procedencia del lote y relaciones entre filas con claves de organización y RLS obligatorio.

## Estado operativo observado

La VPS `vmi3659839` en `207.244.227.122` ejecuta Ubuntu 24.04.5. La aplicación y PostgreSQL son contenedores distintos; la base sólo admite socket Unix interno. Nginx escucha únicamente `127.0.0.1:18080` y el contenedor web `127.0.0.1:18081`; el único puerto público permitido por UFW es SSH 22. El almacenamiento de adjuntos, las claves y el repositorio restic son propios de Analiza. No se instaló Coolify: Compose más el Nginx ya instalado evita competir por puertos y permite alojar otros proyectos con volúmenes, secretos y redes separados.

La cuenta administrativa de esta copia es independiente. Registro público y semilla demo están deshabilitados. El endpoint de portal de pacientes responde 503 mientras falte su contrato PostgreSQL seguro; no cae silenciosamente a MongoDB. Las notificaciones externas no están configuradas ni se han enviado desde esta instancia. Los indicadores operativos arrancan vacíos; los artículos de catálogo no se contabilizan como inventario o transacciones.

La revisión de los 17 capítulos conserva los libros de evidencia existentes: 1.359 eventos completos y `audit:verify` pasa. Esta auditoría no certifica paridad total: quedan requisitos explícitos en `docs/qa/VIDEO_TO_REACT_TRACEABILITY.json` y decisiones del cliente abiertas.
