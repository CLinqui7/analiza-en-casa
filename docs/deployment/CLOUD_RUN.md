# Entrega Core: Cloud Run + PostgreSQL 18

Arquitectura autorizada: Next.js full-stack y API → imagen Docker única → Artifact
Registry → Cloud Run → Cloud SQL PostgreSQL 18 por socket administrado; archivos
privados en GCS, secretos en Secret Manager, infraestructura Terraform y Cloud Build.
Región inicial `us-central1`, servicio `analiza-staging`. Producción no está autorizada.
No se necesita crear una cuenta Docker Hub para esta entrega.

Actualización del alcance: el cliente pidió entregar la migración conectada y
probada para un despliegue posterior. No ejecutar publicación, creación de recursos
ni deployment. Los comandos cloud de este documento son instrucciones futuras.
Ver `MIGRATION_HANDOFF.md` para el estado vigente.

## Reproducir la validación local

Desde la raíz del mismo repositorio/rama, con Node 24, npm 11.18.0, Docker Linux
y Chrome instalados. Para instalar sin cambiar el npm global:
`npm exec --yes --package=npm@11.18.0 -- npm ci`.

```powershell
npm ci
npm run typecheck
npm run lint
npm run test:react
npm test
docker version
docker info
$sourceSha = (git rev-parse HEAD).Trim()
docker build --progress=plain --build-arg SOURCE_SHA=$sourceSha -t analiza-web:cloudrun .
docker image inspect analiza-web:cloudrun
npm run test:postgresql
docker save --output .local/cloud-run/candidate-image.tar analiza-web:cloudrun
py scripts/deployment/scan-image.py .local/cloud-run/candidate-image.tar
docker ps
docker images
```

El runner usa nombres nuevos `analiza-sqlqa-*`, bridge dedicado, puertos publicados
sólo en loopback, PostgreSQL 18 y un emulador GCS local. Genera secretos aleatorios
fuera de Git; crea un rol limitado, aplica migraciones, prueba su repetición y
siembra únicamente datos ficticios. No usa contenedores antiguos como evidencia.
Prueba Chrome real contra el contenedor productivo, CRUD Core, usuarios de dos
organizaciones, permisos, CSRF, conflictos, idempotencia, bytes privados, caída
de SQL sin falso éxito/localStorage, reinicio con persistencia externa y apagado
durante bloqueo SQL. Conserva reportes/capturas por ejecución en `.local/cloud-run`.
Los contenedores QA se conservan para inspección; detener/eliminar sólo los nombres
exactos de `resources.json` de esa ejecución, nunca usar `docker system prune`.

La imagen es Linux/amd64, Next standalone, usuario `node`, `PORT=8080`, escucha
`0.0.0.0`, incluye static/public y no contiene la base de datos. El runner adicional
`container-smoke.mjs` se ejecuta dentro de la imagen sin secretos en puertos 8080
y 9090: verifica salud de proceso, assets, rutas y fallo seguro de persistencia.
El exit 143 es el cierre normal por SIGTERM de Next 16; 137 es fallo por SIGKILL.

`GET /api/health/live` verifica proceso y `GET /api/health` verifica versión SQL,
migración y rol no privilegiado. Una base caída deja liveness en 200 y readiness
en 503; no sustituye datos ni causa un reinicio perpetuo por la sonda de liveness.

## Publicar la imagen exacta ya probada

Confirmar un proyecto y repositorio **existentes y autorizados**. El script no crea
recursos. Las variables siguientes representan datos reales proporcionados por el
ingeniero; no deben sustituirse por nombres ficticios.

```powershell
gcloud auth list
gcloud config get-value project
gcloud artifacts repositories describe $env:ARTIFACT_REGISTRY_REPOSITORY --location us-central1 --project $env:GCP_PROJECT_ID
# Primero imprime y valida el destino sin publicar:
./scripts/deployment/publish.ps1 -ProjectId $env:GCP_PROJECT_ID -Repository $env:ARTIFACT_REGISTRY_REPOSITORY -ImageName $env:IMAGE_NAME -VerificationReport $env:VERIFICATION_REPORT
# Sólo después de confirmar destino/acceso/costo, el ingeniero agrega -Publish.
```

El script exige checkout limpio, SHA de código, etiqueta OCI e ID de imagen
coincidentes con el reporte. Publica `<SHA completo>` y consulta
el digest de Artifact Registry. `published.json` registra SHA, tag, digest y URI.
El ID local y un digest de exportación OCI **no acreditan publicación en un registro**.
No se emplea `latest` para desplegar ni se reemplaza un tag inmutable.
Si HEAD cambió, el script exige reconstruir y repetir QA antes de publicar.
También comprueba que todos los archivos usados por el build sigan idénticos.

Cloud Build (`cloudbuild.yaml`) valida las sustituciones, instala desde el lock,
ejecuta pruebas estáticas/unitarias, construye amd64, prueba la imagen sin DB y
publica. No despliega ni migra. Su build remoto es una nueva imagen: descargarla
por digest y repetir `ANALIZA_VERIFY_IMAGE=<URI@digest> npm run test:postgresql`
antes de autorizar el despliegue. La prueba SQL/browser local no se suplanta por
el smoke sin DB del pipeline. Manualmente, con todos los destinos reales confirmados:

```powershell
$sourceSha = (git rev-parse HEAD).Trim()
$substitutions = "_REGION=us-central1,_REPOSITORY=$env:ARTIFACT_REGISTRY_REPOSITORY,_IMAGE=$env:IMAGE_NAME,_SOURCE_SHA=$sourceSha"
gcloud builds submit . --config cloudbuild.yaml --project $env:GCP_PROJECT_ID --region us-central1 --service-account $env:CLOUD_BUILD_SERVICE_ACCOUNT_RESOURCE --substitutions $substitutions
```

Cloud Build factura cómputo/almacenamiento. Ese comando no se ha ejecutado.
El archivo `.gcloudignore` protege el envío de fuentes independientemente de
`.dockerignore`; ambos excluyen secretos, respaldos, `.local`, estados Terraform y datos.
El builder obtiene escritura en AR y logs; no permisos de deployment.

## Terraform: preparar, revisar y detenerse antes de apply

Configuración: `infra/terraform`, Terraform 1.14.7, proveedor Google fijado por lock.
Copiar `staging.tfvars.example` a un archivo privado e introducir sólo IDs y
configuración, nunca valores de secretos. Los campos vacíos son deliberadamente
inválidos. Si el ingeniero usa recursos existentes, conservar los flags `create_*`
en false y configurar el nombre real de conexión. Importar recursos/IAM ya existentes
cuando corresponda; no crear duplicados ni aplicar sobre el estado de producción.

```powershell
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform fmt -check
terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform plan -input=false -var-file=$env:ANALIZA_TFVARS -out=staging.tfplan
terraform -chdir=infra/terraform show staging.tfplan
# DETENERSE y revisar recursos/costo/IAM. Sólo el operador autorizado ejecuta:
# terraform -chdir=infra/terraform apply staging.tfplan
```

En esta máquina se puede usar el binario oficial en Docker para fmt/validate,
montando la carpeta Terraform en `/infra` y trabajando allí. `plan` sin Project ID,
variables obligatorias ni ADC falla; ese resultado no es un plan aprobado.
La CLI oficial Windows 584.0.0 ya está autenticada. Se detectó el proyecto propio
`probable-sprite-508007-q2`, sin facturación habilitada. Las APIs facturables no
pudieron activarse; no se ejecutó apply. La preparación no equivale a conectividad cloud.

La preparación contempla AR con tags inmutables; GCS privado con versionado;
contenedores de secretos sin valores; SA separadas de runtime, migración y build;
IAM mínimo; Cloud SQL opcional y Cloud Run por digest. No crea usuarios SQL ni
contraseñas en Terraform para evitar guardarlos en el estado. Los secretos se
inyectan desde versiones numéricas independientes de Secret Manager.

Configuración inicial revisable de staging: Cloud Run 1 CPU, 512 MiB, concurrencia
20, mínimo 0/máximo 3 instancias, pool 5 por instancia, timeout HTTP 60 s. El
presupuesto de conexiones SQL debe cubrir `2 × max_instances × pool_max + reservas` (dos revisiones).
Las revisiones simultáneas durante un rollout pueden elevar ese consumo: reservar
capacidad para ambas o reducir límites antes del rollout. Los límites no son un SLO.

Si se autoriza una instancia nueva: PostgreSQL 18 Enterprise, 1 vCPU/3.75 GiB,
zonal, SSD 10 GB, crecimiento automático desactivado, backups/PITR y protección
de borrado. Es una base de staging con costo continuo y capacidad limitada.
Se propone IP pública sin redes SQL autorizadas, conexión administrada autenticada
por IAM y socket `/cloudsql/<connection-name>`; el socket del proceso no usa TLS
directo porque el proxy administrado cifra el transporte. No se abre PostgreSQL
a Internet mediante authorized networks. Si la base corporativa exige sólo IP
privada, el ingeniero debe validar la conectividad admitida por ese entorno antes
de aplicar; añadir una variable de red no demuestra conectividad.

## Secuencia del ingeniero

1. Confirmar datos pendientes y revisar el esquema propio o el mapeo corporativo
   en `POSTGRESQL.md`; asignar identidad migradora y rol SQL runtime restringido.
2. Revisar un plan de infraestructura inicial con `deploy_service=false`, autorizar
   explícitamente costos y aplicar sólo staging. No habilitar creación SQL si se
   utilizará la base corporativa. Confirmar APIs habilitadas y permisos del operador.
3. Aprovisionar base/rol y administrador inicial mediante canal privado; poblar
   Secret Manager. Revisar `npm run db:plan` y ejecutar la migración explícitamente
   desde un operador con conectividad autorizada. No usar el seed QA en esa base.
4. Publicar la imagen probada por SHA y obtener su digest. Si se reconstruyó en
   Cloud Build, repetir la prueba SQL sobre ese digest antes de continuar.
5. Fijar `image_digest_uri`, conexión, bucket y secretos reales; habilitar sólo
   `deploy_service` en el plan revisado, con IAM de invocadores nombrados. Aplicar
   por el ingeniero. La configuración no concede acceso anónimo al servicio.
6. Acceder a staging mediante un operador IAM autorizado (por ejemplo, proxy
   autenticado de `gcloud run services proxy`) y repetir las pruebas sintéticas
   de la entrega contra SQL/GCS reales, con usuarios QA autorizados. Confirmar
   readiness, cookies seguras sobre HTTPS, CSRF, RBAC, archivos y auditoría.
7. Registrar revisión Cloud Run, digest efectivo, esquema/checksum, pruebas y URL.
   Sólo entonces marcar **desplegado y staging comprobado**. No cambiar tráfico
   productivo ni promover a `analiza-prod` en esta entrega.

Recursos que deben aprobarse antes de crearlos en `us-central1`: Cloud SQL
(cómputo/disco/backups continuos); AR (GB almacenados y transferencia); Cloud Run
(solicitudes/CPU/memoria/egreso, con mínimo cero pero sin garantía de costo cero);
GCS (GB, versiones, operaciones/egreso); Secret Manager (versiones/accesos);
Cloud Build (minutos de cómputo, fuentes/logs). SA/IAM no implican capacidad de
cómputo propia pero cambian permisos del proyecto. Los comandos de creación son
el `terraform apply staging.tfplan` revisado y, para builds remotos, el comando
anterior. No se estiman dólares sin un proyecto, presupuesto, tamaño y uso reales.

Referencias: [contrato Cloud Run](https://docs.cloud.google.com/run/docs/container-contract),
[Next standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output),
[versiones Cloud SQL](https://docs.cloud.google.com/sql/docs/postgres/db-versions),
[sustituciones Cloud Build](https://docs.cloud.google.com/build/docs/configuring-builds/substitute-variable-values).
