# Migración preparada; despliegue aplazado por el cliente

El alcance vigente es dejar la aplicación existente conectada y probada para un
despliegue posterior. No publicar ni desplegar ahora. Se conserva la rama
`codex/cloud-run-cloud-sql`, el repositorio `CLinqui7/analiza-en-casa` y el PR #7.

## Qué está conectado

| Componente | Configuración y responsabilidad |
|---|---|
| Web y API | Una imagen Next standalone, PostgreSQL, Core, usuario node, puerto 8080 |
| PostgreSQL | Esquema analiza, migraciones con checksum, transacciones, permisos y RLS por organización |
| Archivos | SDK GCS privado; PostgreSQL guarda metadatos y autorización, no PDFs/imágenes |
| Secretos web | PGUSER y PGPASSWORD desde versiones de Secret Manager; ninguna credencial de migración llega al servidor web |
| Sesiones | Tokens opacos aleatorios de 256 bits, hashes en SQL y CSRF. Este backend no firma JWT ni requiere un secreto de firma compartido; no se introduce una variable de session secret sin uso |
| Operación DB | Imagen operator del mismo Dockerfile, usuario node, jobs separados analiza-staging-migrate y analiza-staging-seed |
| Identidad runtime | analiza-run-staging, Cloud SQL Client, acceso sólo a sus secretos y a crear/leer objetos del bucket |
| Identidad migradora | Separada del runtime; acceso únicamente a secretos de operación y Cloud SQL |
| Build | Cloud Build ejecuta tests, build y smoke de la imagen, publica etiqueta SHA completa; no tiene permisos para desplegar |
| Deployment posterior | Terraform consume el digest publicado, conexión SQL, bucket, secretos y cuentas de servicio |
| Estado Terraform | Bucket privado, versionado, sin force_destroy; backend GCS después del bootstrap aprobado |

La conexión real a GCP no está certificada: ahora sólo existen configuración y
pruebas locales. El login oficial de Google sí terminó. Se detectó el proyecto
propio `probable-sprite-508007-q2` (Owner), sin billing, y sin buckets. Otro proyecto
facturable sólo concede Viewer y no se utiliza. La activación de APIs requerida
por el pedido anterior fue rechazada por falta de billing; ningún apply ni
deployment fue ejecutado. No se necesita resolver billing para revisar esta migración.

## Configuración revisable para más adelante

Las variables no contienen contraseñas. El plan local usa los IDs reales detectados
y nombres de recursos **propuestos, todavía inexistentes**:

- Región: us-central1. Servicio: analiza-staging.
- AR: analiza; imagen web: analiza-web; etiqueta: SHA completo del código.
- Cloud SQL: analiza-sql-staging, PostgreSQL 18, base analiza_en_casa.
- Bucket: analiza-private-files-probable-sprite-508007-q2-staging.
- State: analiza-tfstate-probable-sprite-508007-q2-staging; prefijo analiza/staging.
- Cloud Run: 1 CPU, 512 MiB, concurrencia 20, mínimo 0/máximo 3, pool 5.
- Reserva SQL: 40 conexiones incluyendo dos revisiones y 10 conexiones de reserva.
- SQL: Enterprise, zonal, 1 vCPU/3.75 GiB, SSD 10 GB, backups/PITR, sin redes SQL
  autorizadas públicamente, socket administrado y protección de borrado.

El plan binario y las variables privadas locales quedan en `.local/cloud-run`.
No ejecutar ese plan antiguo cuando se retome el despliegue: generar y revisar
uno nuevo contra el estado real. `terraform test` usa un proveedor simulado y
datos explícitamente sintéticos; no demuestra permisos ni disponibilidad en GCP.

## Operador de migración y seed

`db-command.mjs --migrate` aplica versiones pendientes una vez, verifica checksums
y concede SELECT/INSERT/UPDATE necesarios a un rol runtime existente, sin DELETE.
El migrador puede ser dueño del esquema sin ser superusuario ni BYPASSRLS. El seed
fija el tenant dentro de la transacción y conserva FORCE RLS.

Si se necesita crear el rol runtime en una **nueva base de staging**, el operador
admite `--migrate --provision-runtime`, con autorización privada explícita y una
contraseña generada de al menos 32 caracteres. Crea únicamente un rol separado
LOGIN/NOINHERIT sin privilegios administrativos. No cambia silenciosamente roles
existentes ni sus contraseñas; verifica también que la contraseña suministrada
permita conectarse. La identidad operadora debe tener CREATEROLE para este paso.
La opción está deshabilitada por defecto en Terraform (`provision_runtime_role=false`).

El seed está permitido sólo en QA local o en el job exacto
`analiza-staging-seed`, base `analiza_en_casa`, instancia
`analiza-sql-staging`, región `us-central1`, socket esperado y flags de aprobación.
No se acepta ese permiso en una web desplegada, otro job o una base corporativa.
El job no tiene endpoint público. Terraform crea su definición pero **no lo ejecuta**.

Para preparar los secretos sin crear jobs, usar `prepare_operator=true` con
`deploy_operator=false`. Poblar versiones mediante un canal privado antes de
activar `deploy_operator`, con `operator_secret_versions` reales. La cuenta web
no recibe el secreto QA ni los secretos del migrador. Generar las contraseñas fuera
de Terraform, pasarlas por stdin/variables privadas y no activar logs HTTP/debug.

## Secuencia futura, sólo tras nueva autorización

1. Habilitar billing/acceso, verificar APIs e inventario. Conservar producción intacta.
2. Generar el plan inicial con `create_state_bucket=true`, flags create apropiados,
   `prepare_operator=true`, `deploy_operator=false` y `deploy_service=false`.
   Revisar todos los recursos y costos antes de aplicar. El estado local inicial
   se excluye de Git y no incluye valores de secretos.
3. Tras ese bootstrap aprobado, copiar `infra/terraform/backend.tf.example` a
   `infra/terraform/backend.generated.tf` (ignorado por Git), y ejecutar:

   ```powershell
   terraform -chdir=infra/terraform init -migrate-state '-backend-config=bucket=analiza-tfstate-probable-sprite-508007-q2-staging' '-backend-config=prefix=analiza/staging'
   ```

   Confirmar la copia y el bloqueo de estado GCS. La cuenta de ejecución necesita
   acceso al bucket de state; las cuentas web/build no reciben ese acceso.
4. Provisionar la identidad SQL migradora y sus secretos privados; preparar los
   secretos runtime y QA sintéticos. Si el rol runtime no existe, habilitar sólo
   la opción explícita de aprovisionamiento para el job de migración.
5. Construir web y operator desde el mismo SHA. Repetir QA de la imagen web si
   HEAD cambió. Publicar ambos digests en AR; jamás usar latest. El operator usa
   `docker build --target operator --build-arg SOURCE_SHA=<SHA>` del mismo Dockerfile.
6. Planear/aplicar la definición de los jobs con los digests/versiones reales;
   ejecutar explícitamente y en orden:

   ```powershell
   gcloud run jobs execute analiza-staging-migrate --project probable-sprite-508007-q2 --region us-central1 --wait
   gcloud run jobs execute analiza-staging-seed --project probable-sprite-508007-q2 --region us-central1 --wait
   ```

7. Habilitar `deploy_service=true` con el digest web probado. El servicio permanece
   privado por IAM. Se puede abrir mediante un proxy autenticado local de gcloud;
   para acceso directo en navegador mediante Google, preparar IAP (en cuentas sin
   organización puede requerir el consentimiento inicial en consola). No convertir
   el servicio en público automáticamente.
8. Verificar la URL real, usuarios A/B/C, escritura/lectura, CSRF, permisos, SQL y
   archivos GCS, persistencia entre revisiones y fallo sin falso éxito. Sólo después
   registrar published/deployed/staging_verified según evidencia independiente.

Para el enlace GitHub→Cloud Build, proporcionar el recurso de repositorio de una
conexión oficial autorizada (`build_repository_resource`). El trigger de esta rama
exige aprobación. El deployment continúa siendo un paso explícito de Terraform;
no existe una promoción automática a producción ni un endpoint de migraciones.

## Límites conservados

La migración SQL corresponde al alcance Core heredado. Cotizaciones, finanzas,
clínica y portal completos permanecen en el código histórico y en su regresión,
pero siguen excluidos del runtime Core. No se declara paridad clínica completa ni
capacidad de producción a partir de QA local. Mongo/mock no son fallback de SQL.
