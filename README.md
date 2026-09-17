# Analiza en Casa

Aplicación para la gestión de atención domiciliar, con frontend y API integrados
en Next.js. La entrega actual comprende los módulos Core y su persistencia en
PostgreSQL 18, incluido registro individual y cuestionario. El preview independiente
en Vercel utiliza MongoDB.

**Para desplegar en Cloud Run / Cloud SQL:**
[guía del ingeniero, imágenes y variables](docs/deployment/CLOUD_SQL_HANDOFF.md).

**Para desplegar en Ubuntu / Docker / PostgreSQL local:**
[guía self-hosted](docs/deployment/UBUNTU_SELF_HOSTED.md).

**Estado:** Docker verificado localmente. Preparación cloud disponible; despliegue
diferido. El preview Vercel se publica mediante un flujo independiente con
migraciones previas. Las pruebas y el seed utilizan exclusivamente datos sintéticos.

## Registro, cuestionario y migraciones

La aplicación permite crear una cuenta y completar organización, personal y servicios
en un espacio separado por usuario. El login no incluye credenciales demo precargadas.
El backend conserva sesiones privadas, RBAC, aislamiento por organización y CSRF.

El preview Vercel ya pasó las pruebas conectadas de registro, login y cuestionario.
La distribución Docker equivalente y su arranque con migraciones automáticas se
describen en [Docker MongoDB](docs/deployment/DOCKER_MONGODB.md).

Las [variables y comandos para el ingeniero](docs/deployment/MIGRATIONS_AND_ENV.md)
incluyen las plantillas MongoDB, PostgreSQL y operator. Para publicar el preview:

```sh
npm run deploy:preview -- .local/preview.env
```

El comando aplica migraciones versionadas de MongoDB y detiene la publicación si
fallan. PostgreSQL conserva el operator separado y dispone de una secuencia
preparada de migración antes de actualizar staging. No ejecuta seeds automáticamente.

## Alcance

Pacientes, médicos, hospitalizaciones, agenda y turnos, recursos de enfermería,
catálogos operativos, autenticación y permisos por usuario y organización.
Las cotizaciones y los demás módulos históricos permanecen en el código para su
regresión; no forman parte del alcance PostgreSQL certificado de esta entrega.

## Tecnologías

| Componente                | Tecnología                                                    |
| ------------------------- | ------------------------------------------------------------- |
| Aplicación                | Next.js 16, React 19, TypeScript                              |
| API y validación          | Route Handlers de Next.js, Zod                                |
| Persistencia              | PostgreSQL 18, driver pg, transacciones y RLS                 |
| Archivos privados         | GCS o filesystem local privado; metadatos en PostgreSQL       |
| Runtime                   | Node.js 24, Docker, Next standalone                           |
| Infraestructura preparada | Cloud Run, Cloud SQL, Secret Manager, Terraform y Cloud Build |

La autorización se aplica en el backend. Los errores SQL no activan almacenamiento
local ni otro adaptador. La base de datos y los archivos se mantienen fuera de la
imagen web.

## Docker

La entrega reproducible está en
[analiza-docker](https://github.com/CLinqui7/analiza-docker). Incluye las imágenes
exportadas, sus SHA256, la preparación local con PostgreSQL 18 y el proyecto como
submódulo fijado al commit verificado.

```powershell
git clone --recurse-submodules https://github.com/CLinqui7/analiza-docker.git
cd analiza-docker
```

Seguir su README para descargar y cargar los archivos, preparar QA y ejecutar
`docker run`. La web escucha en `8080` como usuario no-root. El operator de
migraciones se distribuye como imagen separada.

Ese paquete exportado es la entrega histórica con fuente
`6fae1890af99a7913092aea248cb120bd595e335`, anterior al registro individual.
La entrega PostgreSQL actual está en Docker Hub, con fuente, etiquetas y digests en
[la evidencia actual](docs/release/POSTGRESQL_DOCKER_VERIFICATION.json) y comandos en
[CLOUD_SQL_HANDOFF](docs/deployment/CLOUD_SQL_HANDOFF.md).
Consultar [la evidencia de entrega](https://github.com/CLinqui7/analiza-docker/blob/main/evidence/final-manifest.json)
y [las instrucciones Docker](docs/deployment/DOCKER_HANDOFF.md).

Para construir el checkout actual desde la raíz de este proyecto:

```powershell
$sourceSha = (git rev-parse HEAD).Trim()
docker build --platform linux/amd64 --progress=plain --build-arg "SOURCE_SHA=$sourceSha" -t analiza-web:cloudrun .
docker build --platform linux/amd64 --progress=plain --target operator --build-arg "SOURCE_SHA=$sourceSha" -t analiza-operator:postgresql .
```

La versión del 17 de septiembre de 2026 requiere las migraciones
`011_service_catalogs.sql` y `012_insurers_and_nurse_files.sql`. El responsable del despliegue debe ejecutar primero el
operator, esperar un resultado satisfactorio y sólo entonces actualizar la web:

```powershell
$env:ANALIZA_MIGRATION_APPROVED = '1'
docker run --rm --env-file .local/postgresql-operator.env analiza-operator:postgresql --migrate
docker compose --env-file .local/postgresql-compose.env -f compose.yaml -f compose.postgresql.yaml up -d web
```

Después debe comprobar que `/api/health` responda `status: ready`,
`dataMode: postgresql` y `database: ready`. Las capturas de comentarios se leen por
`GET /api/feedback/:id`, siempre con sesión privada y aislamiento por organización.

## Desarrollo

Requisitos: Git, Node.js 24 y npm 11.18.0. Docker Desktop con contenedores Linux
se utiliza para la prueba integrada PostgreSQL. Esa prueba de navegador requiere
Google Chrome.

```powershell
git clone https://github.com/CLinqui7/analiza-en-casa.git
cd analiza-en-casa
npm exec --yes --package=npm@11.18.0 -- npm ci
npm run repo:preflight
```

Para desarrollar contra PostgreSQL, configurar las variables privadas indicadas
en [POSTGRESQL](docs/deployment/POSTGRESQL.md) y ejecutar `npm run dev`.
El servidor de desarrollo no reemplaza la validación de la imagen final.
La configuración de QA Docker y sus credenciales generadas se documentan en el
repositorio de distribución; no se versionan contraseñas.

## Pruebas

| Comando                              | Alcance                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| `npm run repo:preflight`             | Estructura, evidencia fuente y archivos publicables      |
| `npm test`                           | Dominio y contratos de la base histórica                 |
| `npm run test:react`                 | Pruebas unitarias React y servidor                       |
| `npm run typecheck` / `npm run lint` | Tipos y análisis estático                                |
| `npm run test:browser:react`         | Regresión de navegador                                   |
| `npm run test:postgresql`            | Contenedor final, SQL, permisos, archivos y persistencia |
| `npm run test:ubuntu:selfhosted`     | Socket Unix, filesystem y reinicios en Docker aislado    |
| `npm run qa:local`                   | Conjunto amplio de verificaciones locales                |
| `npm run audit:verify`               | Integridad de los registros de revisión                  |

Para ejecutar las migraciones y el seed de la prueba desde la imagen operator:

```powershell
$env:ANALIZA_VERIFY_OPERATOR_IMAGE = 'analiza-operator:postgresql'
npm run test:postgresql
```

## Estructura

| Ruta                        | Responsabilidad                                        |
| --------------------------- | ------------------------------------------------------ |
| `apps/web/`                 | Frontend, rutas HTTP y servicios del backend           |
| `packages/`                 | Dominio, contratos y componentes compartidos           |
| `database/postgresql/`      | Contrato de datos y migraciones                        |
| `scripts/deployment/`       | Operador y verificaciones Docker/PostgreSQL            |
| `infra/terraform/`          | Infraestructura parametrizada                          |
| `tests/`                    | Pruebas y regresiones                                  |
| `docs/`                     | Arquitectura, operación, requisitos y resultados       |
| `references/video-audit/`   | Evidencia fuente inmutable                             |
| `video-audit-reviews/`      | Observaciones y referencias de revisión                |
| `app/`, `api/`, `supabase/` | Implementaciones históricas conservadas para regresión |

## Revisión técnica

Comenzar por [arquitectura](docs/ARCHITECTURE.md),
[esquema PostgreSQL](docs/deployment/POSTGRESQL.md),
[operación local](docs/RUNBOOK.md) y [notas de versión](RELEASE_NOTES.md).
El [índice de documentación](docs/README.md) distingue las guías vigentes de los
registros históricos. [CONTRIBUTING](CONTRIBUTING.md) describe los controles de
seguridad, pruebas y trazabilidad para cambios.

Las pruebas locales no certifican capacidad productiva ni IAM en Google Cloud.
Las reglas de negocio pendientes se conservan en
[OPEN_QUESTIONS](docs/OPEN_QUESTIONS.md).
