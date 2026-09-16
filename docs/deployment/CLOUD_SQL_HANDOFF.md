# Entrega para el ingeniero: Cloud SQL PostgreSQL 18

La aplicación completa (frontend y API Next.js) se ejecuta en una imagen web.
La segunda imagen, `operator`, ejecuta las migraciones; no es otro backend.
Destino: Cloud Run `analiza-staging`, región `us-central1`, PostgreSQL 18 por
socket administrado, archivos privados en GCS y secretos en Secret Manager.
El despliegue cloud está diferido. La evidencia local y los identificadores de
las imágenes publicadas están en [POSTGRESQL_DOCKER_VERIFICATION.json](../release/POSTGRESQL_DOCKER_VERIFICATION.json).

## Qué incluye

- Login con contraseñas almacenadas como hashes scrypt; sesiones opacas almacenadas
  como hash, cookie HttpOnly/Secure, CSRF, límites de intentos y revocación al salir.
- Registro individual: cada cuenta crea su organización y es ADMIN solamente
  dentro de ella. No asigna acceso a una organización corporativa existente.
- Cuestionario de organización, personal y servicios, persistido en PostgreSQL.
  Las fichas de personal no crean cuentas ni otorgan roles. Los servicios no
  generan tarifas, facturas o cotizaciones automáticamente.
- Core: pacientes, médicos, hospitalizaciones, enfermería, agenda/turnos,
  configuración operativa y archivos privados. Permisos por usuario/organización,
  RLS forzado, auditoría, ediciones versionadas y turnos idempotentes.
- Migraciones `001_core.sql` y `002_workspace_registration.sql`, ordenadas,
  con checksum, bloqueo asesor y transacción. Repetirlas no duplica el esquema.
  Un error detiene la secuencia antes de actualizar la web. No ejecuta seed.

El registro de pruebas no incluye envío de correo de verificación ni recuperación
de contraseña por email. No se ha configurado un proveedor de correo.

Cotizaciones, módulos clínicos/financieros avanzados y portal permanecen fuera
del alcance Core certificado. No hay endpoints DELETE. El contrato completo de
tablas/operaciones está en [POSTGRESQL.md](POSTGRESQL.md).

## Repositorio y Docker

Fuente: <https://github.com/CLinqui7/analiza-en-casa>, rama
`codex/cloud-run-cloud-sql`. El `Dockerfile` está en la raíz, sin extensión.
Docker Hub autorizado: `desarrollotuvet/analiza-en-casa`; usuario publicador
`carloslinqui`. Usar las etiquetas **postgresql**, que incluyen el registro y
cuestionario SQL. Las etiquetas **mongodb** corresponden al preview de Atlas.

```powershell
git clone --branch codex/cloud-run-cloud-sql https://github.com/CLinqui7/analiza-en-casa.git
cd analiza-en-casa
$evidence = Get-Content docs/release/POSTGRESQL_DOCKER_VERIFICATION.json -Raw | ConvertFrom-Json
docker pull $evidence.web.digestUri
docker pull $evidence.operator.digestUri
docker tag $evidence.web.digestUri analiza-web:cloudrun
docker tag $evidence.operator.digestUri analiza-operator:postgresql
docker run --rm analiza-operator:postgresql --dry-run
```

Si se reciben los archivos exportados `candidate-image.tar` y
`candidate-operator.tar`, comprobar sus SHA256 contra el manifiesto y cargarlos:

```powershell
Get-FileHash candidate-image.tar,candidate-operator.tar -Algorithm SHA256
docker load --input candidate-image.tar
docker load --input candidate-operator.tar
```

Las exportaciones actuales están guardadas localmente en
`.local/cloud-run/postgresql-64e47f345b16/`. Docker Hub permite obtener las mismas
imágenes sin intercambiar esos archivos grandes.

Para construir el mismo código de las imágenes verificadas:

```powershell
git checkout $evidence.sourceSha
$sourceSha = (git rev-parse HEAD).Trim()
docker build --progress=plain --platform linux/amd64 --build-arg "SOURCE_SHA=$sourceSha" -t analiza-web:cloudrun .
docker build --progress=plain --platform linux/amd64 --target operator --build-arg "SOURCE_SHA=$sourceSha" -t analiza-operator:postgresql .
```

La imagen usa Node.js 24, Next standalone, usuario `node` (UID 1000), puerto
8080 y secretos únicamente en runtime. El build no se conecta a ninguna base.
Una reconstrucción puede producir otro digest; verificarla antes de sustituir
el digest entregado. Para QA desde el contenedor final:

```powershell
npm exec --yes --package=npm@11.18.0 -- npm ci
$env:ANALIZA_VERIFY_IMAGE = 'analiza-web:cloudrun'
$env:ANALIZA_VERIFY_OPERATOR_IMAGE = 'analiza-operator:postgresql'
npm run test:postgresql
```

Requiere Docker Linux y Google Chrome. Crea una red nueva, PostgreSQL 18 y
emulador GCS locales, credenciales aleatorias, migraciones y seed sintético;
prueba y conserva los recursos/evidencia en `.local/cloud-run/analiza-sqlqa-*`.
No usa contenedores anteriores ni llama a GCP. Para repetir registro en navegador,
copiar el `base` de `resources.json` a `REGISTRATION_TEST_URL` y ejecutar
`npm run test:registration:browser`.

Para ejecutar manualmente en esa red, usar su `runtime.env` privado:

```powershell
# Rellenar con la ruta y red emitidas por la verificación anterior.
docker run --rm --name analiza-manual-qa --network $qaNetwork -p 127.0.0.1:8080:8080 --env-file $qaRuntimeEnv --read-only --tmpfs /tmp --tmpfs /app/apps/web/.next/cache:uid=1000,gid=1000 --cap-drop ALL --security-opt no-new-privileges analiza-web:cloudrun
```

`compose.yaml` configura la web; el override `compose.postgresql.yaml` añade
el operator con `depends_on: service_completed_successfully` para una red QA
existente. Requiere además `PG_MIGRATION_USER`, `PG_MIGRATION_PASSWORD`,
`ANALIZA_MIGRATION_APPROVED=1`, `ANALIZA_QA_NETWORK` y URL del emulador
`ANALIZA_QA_STORAGE_EMULATOR` en un archivo privado. No usar este override QA
para desplegar Cloud Run. Repetir `docker compose up` vuelve a ejecutar el
migrador terminado; si falla, la nueva web no arranca.

## Variables: web y migrador

Plantillas sin secretos: [web](../../config/postgresql/runtime.example) y
[migrador](../../config/operator/runtime.example). Los campos vacíos deben
rellenarse con valores reales. No existe una contraseña predeterminada.

| Variable                     | Web                 | Operator                   | Valor/origen                                        |
| ---------------------------- | ------------------- | -------------------------- | --------------------------------------------------- |
| `ANALIZA_DB_TRANSPORT`       | `cloudsql`          | No                         | Selección explícita del transporte administrado     |
| `PGHOST`                     | Sí                  | Sí                         | `/cloudsql/PROJECT_ID:us-central1:INSTANCE` real    |
| `PGPORT`                     | 5432                | 5432                       | Puerto PostgreSQL                                   |
| `PGDATABASE`                 | Sí                  | Sí                         | Base aprobada por el ingeniero                      |
| `PGUSER`                     | Usuario restringido | Usuario migrador diferente | Referencia y versión numérica de Secret Manager     |
| `PGPASSWORD`                 | Secreto runtime     | Secreto migrador diferente | Secret Manager; nunca en Git o argumentos del build |
| `PGPOOL_MAX`                 | 5                   | No                         | Pool por instancia; dimensionar con el límite SQL   |
| `ANALIZA_FILE_STORAGE`       | `gcs`               | No                         | Selección explícita de almacenamiento privado       |
| `GCS_PRIVATE_BUCKET`         | Sí                  | No                         | Nombre del bucket privado, sin `gs://`              |
| `ANALIZA_PG_RUNTIME_ROLE`    | No                  | Sí                         | Mismo nombre SQL que el `PGUSER` de la web          |
| `ANALIZA_MIGRATION_APPROVED` | No                  | `1`                        | Sólo en el job autorizado para esa base             |
| `PORT`                       | 8080                | No                         | Cloud Run lo inyecta                                |

El Dockerfile fija `ANALIZA_DATA_MODE=postgresql`, `NEXT_PUBLIC_DATA_MODE=postgresql`,
`NEXT_PUBLIC_RELEASE_PROFILE=core` y ambos `*_REGISTRATION_MODE=isolated`.
Estos indicadores no son secretos. Los valores públicos se fijan en el build;
no cambiar de motor poniendo otra variable en una imagen ya construida.
No configurar `MONGODB_URI`, `ANALIZA_QA_MODE`, emuladores ni claves JSON en Cloud Run.

La Service Account autoriza la conexión administrada; `PGUSER/PGPASSWORD`
autentican al usuario dentro de PostgreSQL. Son capas distintas. El código no
implementa login SQL mediante tokens de IAM. La web requiere `cloudsql.client`,
acceso a sus dos secretos y `storage.objects.get/create` sobre el bucket. El
migrador requiere `cloudsql.client` y sus secretos, sin acceso a los archivos.
No hace falta compartir la cuenta Google personal ni darle acceso total al proyecto.
Ver [conexión oficial Cloud Run → Cloud SQL](https://docs.cloud.google.com/sql/docs/postgres/connect-run).

## Primer despliegue del ingeniero

1. Confirmar proyecto, instancia PostgreSQL 18, base y adopción del esquema
   `analiza`. Crear/provisionar dos usuarios SQL por un canal privado: el migrador
   debe poder crear el esquema y administrar sus tablas; runtime debe ser
   `NOSUPERUSER NOBYPASSRLS`, sin pertenencia a roles privilegiados. El operator
   concede sus permisos limitados, sin DDL/DELETE. Usar los mismos nombres en secretos.
2. Preparar Artifact Registry, bucket GCS privado, referencias/versiones de secretos,
   identidades y red. Terraform sólo crea los contenedores de secretos cuando se
   autoriza; nunca sus valores ni usuarios SQL automáticamente por defecto.
3. Copiar las dos imágenes verificadas de Docker Hub al Artifact Registry aprobado,
   conservando el SHA en las etiquetas; obtener los digests del destino. También
   se puede reconstruir con `cloudbuild.yaml` (build, pruebas, operator y push;
   no despliega). No introducir claves para descargar una imagen pública.
4. Copiar `infra/terraform/staging.tfvars.example` fuera de Git y completar los
   valores. Usar `prepare_operator=true`, `deploy_operator=true`,
   `deploy_seed_job=false`, `deploy_service=false`, el digest del operator,
   sus secretos/versiones y `runtime_sql_role`. El plan debe revisarse antes de
   cualquier apply, incluyendo IAM aunque las banderas de creación estén en false.
5. Tras la aprobación del ingeniero, aplicar la infraestructura/job y ejecutar
   `analiza-staging-migrate --wait`. Sólo con exit code 0 habilitar
   `deploy_service=true`, su digest web y sus dos versiones de secretos, revisar
   el nuevo plan y aplicar. No arrancar la web antes de la primera migración.
6. Verificar `/api/health/live` y `/api/health`, registro, login, cuestionario,
   Core, permisos, persistencia y archivos reales de GCS usando datos sintéticos.
   El health completo comprueba SQL/esquema; la prueba de adjuntos comprueba GCS/IAM.

Comandos de preparación, desde `infra/terraform`:

```powershell
terraform init
terraform fmt -check -recursive
terraform validate
terraform plan -var-file=$approvedTfvars -out=$reviewedPlan
# El ingeniero aplica $reviewedPlan sólo después de revisar costo, IAM y destino.
```

Publicación al registro existente, sin crear recursos (desde la raíz):

```powershell
# Variables reales: GCP_PROJECT_ID, GCP_REGION=us-central1,
# ARTIFACT_REGISTRY_REPOSITORY e IMAGE_NAME acordado por el ingeniero.
$prefix = "$env:GCP_REGION-docker.pkg.dev/$env:GCP_PROJECT_ID/$env:ARTIFACT_REGISTRY_REPOSITORY"
gcloud auth configure-docker "$env:GCP_REGION-docker.pkg.dev"
$webTag = "$prefix/$env:IMAGE_NAME`:$($evidence.sourceSha)"
$operatorTag = "$prefix/$env:IMAGE_NAME-operator`:$($evidence.sourceSha)"
docker tag $evidence.web.digestUri $webTag
docker tag $evidence.operator.digestUri $operatorTag
docker push $webTag
docker push $operatorTag
gcloud artifacts docker images describe $webTag --project $env:GCP_PROJECT_ID --format 'value(image_summary.digest)'
gcloud artifacts docker images describe $operatorTag --project $env:GCP_PROJECT_ID --format 'value(image_summary.digest)'
```

Construcción alternativa Cloud Build sobre el commit elegido:

```powershell
gcloud builds submit --project $env:GCP_PROJECT_ID --region us-central1 --config cloudbuild.yaml --service-account "projects/$env:GCP_PROJECT_ID/serviceAccounts/$buildServiceAccount" --substitutions "_REGION=us-central1,_REPOSITORY=$env:ARTIFACT_REGISTRY_REPOSITORY,_IMAGE=$env:IMAGE_NAME,_SOURCE_SHA=$sourceSha" .
```

El ingeniero debe conceder al build acceso al depósito de código usado por
Cloud Build, además de Artifact Registry Writer y Logs Writer. El trigger
Terraform es opcional y requiere una conexión GitHub/Cloud Build v2 existente.

Para actualizaciones posteriores, con servicio/job ya creados y URI de Artifact
Registry **por digest**:

```powershell
./scripts/deployment/deploy-staging.ps1 -ProjectId $env:GCP_PROJECT_ID -WebImage $webDigestUri -OperatorImage $operatorDigestUri
# Muestra: actualizar operator → ejecutar migraciones --wait → actualizar web.
# El ingeniero añade -Execute al autorizar esa actualización de staging.
```

Guardar también los nuevos digests en las variables Terraform privadas para que
el siguiente plan no proponga volver a una imagen anterior.

Terraform conserva el servicio protegido por IAM. Los probadores necesitan
identidades invocadoras autorizadas y una forma de acceso de navegador acordada
(por ejemplo, proxy autenticado para QA); después usan el login de Analiza.
No cambiarlo a público sólo para superar una prueba.

## Datos existentes y límites

Las migraciones anteriores crean/evolucionan el esquema; **no copian automáticamente
usuarios o registros de Atlas ni archivos GridFS a GCS**. Para trasladar datos del
preview se necesita un lote separado: acordar base/prefijo de origen y organizaciones,
congelar escrituras durante el corte, exportar por canal privado, validar DTO y
relaciones, copiar archivos verificando SHA256, importar transaccionalmente en
orden de dependencias y reconciliar conteos/versiones. Las sesiones antiguas
deberán tratarse expresamente en ese corte; no prometer continuidad sin probarla.
No se ha ejecutado esa transferencia ni se han modificado datos corporativos.

El destino puede empezar vacío: el registro crea cuentas y organizaciones SQL,
sin MongoDB y sin seed. La capacidad de producción y la conectividad/IAM reales
se validan en staging; las pruebas locales no sustituyen esa comprobación.

## DATOS_PENDIENTES_DEL_INGENIERO

- Proyecto GCP de destino y Artifact Registry/imagen aprobados.
- Nombre de conexión de Cloud SQL PostgreSQL 18, base y aceptación del esquema
  `analiza` o mapeo a las tablas corporativas existentes.
- Usuarios SQL runtime/migrador y referencias/versiones de sus secretos;
  bucket GCS privado, red/subred si corresponde y presupuesto de conexiones SQL.
- Permisos del publicador/desplegador, identidades de los probadores y acceso web
  de staging; conexión GitHub/Cloud Build si se desea trigger automático.
- Si se conservarán datos de Atlas: base/prefijo, organizaciones y ventana de corte.
