# Contrato PostgreSQL 18 de Analiza

La entrega migra la edición Core existente: pacientes, médicos, hospitalizaciones,
enfermería, agenda, configuración operativa, autenticación y archivos privados.
El frontend y la API continúan juntos en Next.js. El esquema `analiza` fue diseñado
por autorización del cliente y probado únicamente sobre PostgreSQL 18 local con
datos sintéticos. Su adopción o mapeo a la base corporativa requiere revisión del ingeniero.

## Separación de persistencia

`apps/web/src/server/persistence/contracts.ts` define las operaciones sin exponer
drivers a la UI. `index.ts` selecciona un adapter explícito. PostgreSQL nunca
intenta MongoDB si falla: responde con un error y conserva el formulario.
Las validaciones compartidas están en `server/validation`, la autenticación en
`server/auth-service.ts` y los DTO originales en `packages/contracts`.

Los adapters `postgres*.ts` emplean `pg`, SQL parametrizado, pool por proceso
(máximo 5 por defecto), versión optimista para ediciones y transacciones que
incluyen la auditoría. Las series de turnos bloquean recursos en orden estable,
validan colisiones e incorporan una clave de idempotencia y hash del comando.
No se agregaron endpoints DELETE.

## Tablas, campos y operaciones

Todos los nombres pertenecen al esquema **propuesto `analiza`**, no a tablas
corporativas supuestamente existentes. Las migraciones ejecutables son
`database/postgresql/migrations/001_core.sql` y `002_workspace_registration.sql`.
Los campos completos de cada DTO Core
`body` (tipos, obligatorios, opcionales y enumeraciones existentes) están en
`database/postgresql/DTO_CONTRACT.json`, generado desde Zod mediante
`npm exec -- tsx --tsconfig apps/web/tsconfig.json scripts/deployment/export-sql-contract.ts`.
JSONB preserva los DTO de las páginas; identidades, relaciones, versiones e índices
de concurrencia son columnas relacionales. JSONB nunca contiene bytes de adjuntos.

| Tabla                  | Columnas                                                                                                      | Operaciones del runtime               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| organizations          | id, name                                                                                                      | SELECT, INSERT                        |
| workspace_profiles     | organization_id, profile, version, updated_at                                                                 | SELECT, INSERT, UPDATE                |
| organization_staff     | organization_id, id UUID, body, created_at, updated_at                                                        | SELECT, INSERT, UPDATE                |
| organization_services  | organization_id, id UUID, body, created_at, updated_at                                                        | SELECT, INSERT, UPDATE                |
| users                  | id, email_normalized, password_hash, display_name, disabled_at, created_at                                    | SELECT, INSERT, UPDATE                |
| memberships            | user_id, organization_id, role, active                                                                        | SELECT, INSERT, UPDATE                |
| sessions               | session_hash, csrf_hash, user_id, organization_id, expires_at, revoked_at                                     | SELECT, INSERT, UPDATE                |
| auth_rate_limits       | key, window_started_at, attempts                                                                              | SELECT, INSERT, UPDATE                |
| patients               | organization_id, id, document_key, body, version, created_at, updated_at                                      | SELECT, INSERT, UPDATE                |
| doctors                | organization_id, id, body, version, created_at, updated_at                                                    | SELECT, INSERT, UPDATE                |
| nursing_resources      | organization_id, id, user_id, body                                                                            | SELECT, INSERT, UPDATE                |
| hospitalizations       | organization_id, id, patient_id, body, version, created_at, updated_at                                        | SELECT, INSERT, UPDATE                |
| hospitalization_nurses | organization_id, hospitalization_id, resource_id, active                                                      | SELECT, INSERT, UPDATE                |
| shifts                 | organization_id, id, resource_id, patient_id, starts_at, ends_at, status, body                                | SELECT, INSERT                        |
| commands               | organization_id, idempotency_key, payload_hash, result, created_at                                            | SELECT, INSERT                        |
| configuration_entries  | organization_id, id, body                                                                                     | SELECT, INSERT, UPDATE                |
| catalog_items          | organization_id, id, body                                                                                     | SELECT                                |
| file_metadata          | organization_id, id, owner_type, owner_id, storage_key, name, mime_type, size, sha256, created_by, created_at | SELECT, INSERT                        |
| audit_events           | organization_id, id, actor_user_id, action, resource_type, resource_id, occurred_at                           | SELECT, INSERT                        |
| schema_migrations      | version, sha256, applied_at                                                                                   | SELECT; INSERT exclusivo del migrador |

El registro crea usuario, organización, membresía ADMIN y sesión atómicamente.
Una cuenta no puede elegir una organización ajena ni concederse otro rol.
Los catálogos de artículos existentes se provisionan por el operador autorizado;
no se inventan precios, perfiles clínicos ni reglas.
`nurse.create` permite al rol autorizado crear usuario, membresía y recurso juntos.
`configuration.save` conserva la autorización `catalogs:write` y valida referencias
a artículos activos. La tabla de permisos existente sigue siendo la autoridad
`apps/web/src/lib/permissions.ts`; la organización y el rol provienen de la sesión.

## Identidades y RLS

El rol SQL runtime debe ser independiente del propietario/migrador, `NOSUPERUSER`,
`NOBYPASSRLS`, sin permisos DDL/DELETE ni pertenencia a roles privilegiados.
Cada transacción de dominio configura `analiza.organization_id` con `set_config`
local a la transacción; las tablas de dominio tienen RLS ENABLE y FORCE. Sin
organización no hay filas visibles. Los filtros explícitos y las claves foráneas
compuestas constituyen otra barrera. La autenticación consulta sus tablas privadas
antes de conocer la organización; esas tablas no tienen la política RLS de dominio.
El backend verifica usuario habilitado, membresía activa, sesión, CSRF y RBAC.
No se expone SQL, credenciales, una clave de Service Account ni acceso directo a
la base desde el navegador. El registro aislado crea administradores únicamente
en organizaciones nuevas; no administra organizaciones corporativas existentes.

### Campos del cuestionario (migración 002)

El contrato validado es `apps/web/src/lib/workspace-setup.ts` (Zod estricto).
`profile` contiene `name` (obligatorio), `contactName`, `email`, `phone`, `address`,
`city`, `country`, `coverage`. Los textos opcionales se representan con cadena
vacía. Personal: `id` UUID, `name`, `position` obligatorios; `specialty`,
`registrationNumber`, `email`, `phone`, `active`. Servicios: `id` UUID, `name`,
`description`, `modality` (HOME/ONSITE/REMOTE/OTHER), `durationMinutes` opcional,
`price` opcional, `currency` (tres letras si hay precio), `active`.
Máximo 50 fichas de personal y 50 servicios por cuestionario; no hay precios por
defecto. `expectedVersion` controla ediciones concurrentes. Las filas guardadas
se conservan y pueden desactivarse, sin DELETE. Perfil, directorios y auditoría
se guardan en una sola transacción y están sujetos a RLS por organización.
Las fichas de personal son un directorio; no crean usuarios de acceso ni roles.

El pool limita espera de conexión a 2 s y consultas SQL a 5 s en servidor / 6 s
en cliente. El apagado impide abrir nuevos pools y termina los existentes.
La instrumentación de Next observa los canales TCP/HTTP de Node 24 para cerrar
preconexiones vacías y conexiones que quedan ociosas después de una respuesta
durante SIGTERM. Mantiene el servidor standalone y permite finalizar peticiones
activas; la prueba incluye conexiones vacías y una escritura SQL bloqueada.
Los uploads/downloads GCS no retienen conexiones SQL; se vuelve a comprobar
autorización antes de registrar metadatos/auditoría. La capacidad final requiere
una prueba con volumen y tamaño de datos acordados; 30 lecturas QA no prueban
un SLO de producción. El workspace existente entrega listas completas: para
volúmenes mayores deberá acordarse paginación conservando búsqueda/exportación.

## Migraciones y seed

`npm run db:plan` muestra orden y SHA256 sin abrir una conexión. `npm run db:migrate`
exige `ANALIZA_MIGRATION_APPROVED=1`, las variables privadas `PGHOST`, `PGPORT`,
`PGDATABASE`, `PGUSER`, `PGPASSWORD`, y `ANALIZA_PG_RUNTIME_ROLE` (rol ya creado).
Adquiere un bloqueo de migración, valida PostgreSQL 18 y aplica cada archivo en
una transacción; una segunda ejecución no repite los cambios. Si un checksum
aplicado cambió, falla: las evoluciones requieren un nuevo archivo ordenado.
No hay DDL automático al iniciar la web, ni migración descendente destructiva.

`npm run db:seed:qa` exige además `ANALIZA_QA_MODE=1`, ausencia de `K_SERVICE` y
`ANALIZA_QA_PASSWORD` privado, de al menos 24 caracteres. Crea cuentas ficticias
`qa-admin`, `qa-admin-b`, `qa-nurse`, `qa-doctor`, `qa-finance`, `qa-inventory`,
`qa-auditor`, `qa-foreign` en `example.test`, dos organizaciones y un recurso.
No modifica cuentas existentes. No ejecutar esta semilla en la base corporativa.
`npm run test:postgresql` genera sus propios secretos y base local, migra dos veces,
siembra, prueba la imagen candidata y guarda evidencia privada en `.local/cloud-run`.

## Archivos privados y dependencias anteriores

En PostgreSQL se guardan sólo los metadatos y SHA256. Los bytes se crean en GCS
con nombres generados por servidor, precondición de creación, CRC32C y caché
privada; se descargan a través de una API autenticada. Antes de parsear multipart se limita el cuerpo a 25 MiB más 64 KiB de cabeceras, incluso sin Content-Length; se admiten dos transferencias simultáneas por instancia y el exceso recibe 429. El bucket no es público,
no se emiten URLs anónimas y el runtime sólo necesita `storage.objects.get/create`.
Si GCS tiene éxito y SQL falla, no se confirma el archivo; puede quedar un objeto
huérfano privado. Su reconciliación/retención necesita un proceso autorizado,
sin introducir borrados automáticos ni una política legal inventada.

`ANALIZA_QA_STORAGE_EMULATOR` sólo se permite en QA local y se rechaza dentro de
Cloud Run. La prueba del SDK contra el emulador no acredita IAM ni red de GCS real.
No se copiaron objetos GridFS existentes ni datos de Atlas a PostgreSQL/GCS.

Inventario Mongo conservado: `mongo.ts`, `mongo-auth.ts`, repositorios Core
`mongo-{patients,doctors,hospitalizations,shifts,files}.ts`, `mongo-gridfs-storage.ts`
(GridFS), `mongo-operations.ts`, scripts `mongo-*-verification/bootstrap`, y
`mongo-{quotes,portal}.ts` para la edición histórica. Los módulos clínicos,
financieros, cotizaciones y portal están excluidos del Core previo y continúan
cerrados por su proxy; **no se declaran migrados a PostgreSQL**. La edición mock
se conserva para regresión del frontend. La imagen PostgreSQL fija el perfil
Core y el modo HTTP; no recibe una URI Mongo ni cambia de modo ante un error.

Referencias: [transacciones pg](https://node-postgres.com/features/transactions),
[reintentos GCS](https://docs.cloud.google.com/storage/docs/retry-strategy).
