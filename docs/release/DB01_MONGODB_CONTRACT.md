# DB01 · Contrato local de persistencia MongoDB

Fecha: 2026-09-09. Alcance: código local y pruebas aisladas; no se provisionó ni se contactó MongoDB Atlas.

## Resultado implementado

- `apps/web/src/lib/http-data-provider.ts` reserva el único adaptador de navegador para `/api/workspace`. Usa cookies same-origin y no envía organización, rol ni una URI.
- `apps/web/src/app/api/workspace/route.ts` usa runtime Node y responde `503` sin datos mientras no exista una identidad de servidor. No sustituye el fallo por `localStorage` ni por datos demo.
- `apps/web/src/server/mongodb.ts` usa el driver oficial `mongodb@7.2.0`, `ANALIZA_DATA_MODE=mongodb`, `MONGODB_URI` y `MONGODB_DB` sólo en proceso Node. Reutiliza un `MongoClient` por proceso y usa Stable API v1. Ninguna variable `NEXT_PUBLIC_*` contiene la URI.
- `apps/web/src/server/mongo-patients.ts` es el primer contrato de recursos: DTO explícito de paciente, UUID conservado, filtro `{ organizationId, id }` en lecturas, organización/rol obtenidos del actor confiable, rechazo de `organizationId`, `actor`, `role` de la solicitud y operadores `$` enviados por navegador, y reemplazo con `expectedVersion` que devuelve conflicto en vez de sobrescribir. El campo administrativo `contacts[].role` se conserva como dato del contrato, nunca como autoridad.
- El proveedor heredado no intenta traducir arreglos completos de `WorkspaceSnapshot` en escrituras Mongo. En modo `mongodb` no muestra fixtures demo ni confirma guardado; las pantallas deben migrarse a comandos por recurso antes de habilitar mutaciones.

## Inventario Supabase que debe conservar semántica al migrar

| Superficie        | Evidencia local                                                                                                    | Tratamiento Mongo pendiente                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth de navegador | `apps/web/src/lib/supabase.ts`, `apps/web/src/lib/auth.ts` (`getSession`, login, logout)                           | Elegir identidad, sesiones HttpOnly, revocación y recuperación del lado servidor. Un usuario técnico Atlas no sustituye cuentas de aplicación.                                                                                                 |
| RLS/membresías    | `supabase/migrations/202608260002_security_rls_functions.sql`, `202608260004_p0_organization_portal_hardening.sql` | Colecciones `users`, `memberships`, `sessions`; resolver el ámbito exclusivamente desde sesión verificada.                                                                                                                                     |
| Integridad/RPC    | Migraciones `202608260005`–`202608280001`                                                                          | Reimplementar comandos auditados/atómicos de cotizaciones, documentos firmados/correcciones, pagos/reversiones, inventario, agenda, seguros, compras, catálogos y descuentos. No usar upsert genérico.                                         |
| Storage privado   | `supabase/migrations/202608260003_indexes_permissions_storage.sql`                                                 | Los buckets `clinical-private`, `financial-private` y `templates-private` son privados y scoped por organización. Seleccionar storage privado, metadatos, streaming de descarga autorizada, antivirus/límites/retención antes de migrar bytes. |
| API/cron/portal   | `api/_portal-security.js`, `api/notifications.js`, `api/cron-retries.js`, `api/portal-*.js`                        | Reemplazar RPCs de portal/notificaciones y preservar token hash, caducidad, verificación secundaria, idempotencia y no enumeración.                                                                                                            |

Las migraciones SQL y las políticas RLS permanecen como evidencia histórica y no fueron modificadas.

## Modelo inicial y bootstrap fuera de requests

Las colecciones candidatas derivadas de contratos y módulos son: `organizations`, `users`, `memberships`, `sessions`, `patients`, `doctors`, `nursingResources`, `hospitalizations`, `shifts`, `quotes`, `insuranceRequests`, `insuranceEvents`, `payments`, `clinicalDocuments`, `catalogItems`, `purchases`, `inventoryMovements`, `auditEvents`, `fileMetadata` e `importJobs`.

El contrato de pacientes declara el índice único compuesto `organizationId + documentType + documentIdNormalized`. La creación de colecciones, índices, validadores y cualquier importación se ejecutará mediante un bootstrap controlado, nunca desde handlers. Cada colección deberá validar su DTO propio; no se autoriza una bolsa JSON común ni la conversión ciega de UUID a `ObjectId`.

## M01 · identidad y autorización local preparada

- `apps/web/src/server/mongo-auth.ts` implementa sesiones con identificador aleatorio almacenado únicamente como hash, expiración de ocho horas, revocación persistible, token CSRF por sesión hasheado, límite de intentos en `authRateLimits` y resolución de membresía/rol por cada operación. Las cookies de las rutas Next son `HttpOnly`, `SameSite=Lax`, `Secure` para solicitudes HTTPS y `Cache-Control: no-store`.
- Las rutas `api/auth/login`, `api/auth/session`, `api/auth/csrf` y `api/auth/logout` no exponen URI, hash de contraseña, organización ni rol como autoridad enviada por el navegador. El login devuelve el mismo `401` para cuenta, clave, membresía o límite inválido. Logout exige CSRF y revoca el hash de sesión antes de eliminar la cookie.
- El rol devuelto al navegador sirve únicamente para presentar la interfaz. `MongoAuthService.requireSession()` vuelve a consultar la membresía activa antes de entregar el actor a `MongoPatientRepository`; un ID de otra organización produce `404` en `api/patients/[id]` y no revela su existencia.
- No existe endpoint de signup ni bootstrap. `bootstrapInitialAdmin()` sólo está disponible como operación de despliegue con token de servidor, rechaza cualquier segunda cuenta y fija el primer rol a `ADMIN`; no se agrega un secreto de ejemplo ni una cuenta real.
- El driver oficial `mongodb@7.2.0` ya está fijado en `apps/web/package.json`. La guía oficial de MongoDB para Node.js documenta `MongoClient`, Stable API y la reutilización del cliente/pool por proceso: <https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/>. No se usa Atlas App Services, Data API ni Realm Auth.

La recuperación por correo/restablecimiento permanece pendiente de seleccionar y configurar un proveedor de identidad/correo aprobado. Ninguna ruta afirma haber enviado mensajes.

## Infraestructura no provisionada

1. Organización/proyecto Atlas, cluster, bases separadas de staging y producción, usuario técnico de mínimos privilegios, conectividad segura y secretos en gestor externo.
2. Proveedor de identidad de aplicación, sesiones cookies HttpOnly/Secure/SameSite, CSRF, rate limit compartido y resolución servidor de membresía/rol/organización.
3. Bootstrap revisado de colecciones/índices/validadores, transacciones/idempotencia/auditoría para dominios financieros y clínicos, y plan de importación sintético dry-run/conciliable.
4. Storage de bytes privados, reglas de tipo/tamaño/malware, autorización por archivo, expiración, retención y auditoría.
5. Backups/restauración comprobados y decisión de plan Atlas. No se afirma que un tier gratuito sea apropiado para datos clínicos.

## M02 · operaciones atómicas, adjuntos y bootstrap local

- `apps/web/src/server/mongo-financial.ts` define comandos tipados y acotados para pagos e inventario. La organización y actor provienen de la sesión de servidor; las claves de idempotencia son únicas por organización. Cada comando abre una transacción, consulta el documento por la clave idempotente, inserta solamente el nuevo documento y anexa un `auditEvent` generado en servidor. No transforma snapshots/arreglos del navegador en `update` o `upsert` masivo.
- `apps/web/src/server/mongo-files.ts` conserva exclusivamente metadatos en Mongo y obtiene bytes mediante una interfaz de storage privado. El comando de metadatos rechaza `organizationId`, `actor`, operadores Mongo y bytes/base64 de navegador. La descarga primero filtra `{ id, organizationId }`; un archivo ausente o de otro tenant retorna el mismo resultado nulo y no consulta el storage. Aún no hay proveedor de storage ni handler HTTP de carga/streaming configurado.
- `apps/web/src/server/mongo-bootstrap.ts` reúne los índices nombrados de identidad, pacientes, pagos, inventario, auditoría y `fileMetadata`. `initializeMongoSchema` es una operación de despliegue separada de handlers y soporta `dryRun`; `createIndex` recibe definiciones nombradas estables para una aplicación idempotente por MongoDB. Los TTL declarados continúan limitados a `sessions` y `authRateLimits`; no se declara TTL para `clinicalDocuments` ni `auditEvents`.
- Las pruebas de doble cuenta son aisladas: las cuentas A y B de `org-a` pueden recuperar los mismos bytes privados; C de `org-c` no recibe metadatos ni bytes. Son doubles en memoria, no una certificación Atlas o de dos sesiones remotas.
- No se ejecutó inicialización, backup o restore remoto. Falta una decisión aprobada de storage privado, validadores de colecciones por dominio, procedimiento operativo de backup/restore y una base de pruebas Mongo explícita antes de conectar pruebas a Atlas.

## Evidencia de pruebas locales

- `vitest:db01-mongo-no-uri-leak`: configuración falla sin exponer URI.
- `vitest:db01-mongo-tenant-create`: el servidor asigna organización y conserva UUID.
- `vitest:db01-mongo-authority-reject`: rechaza autoridad y operadores de navegador.
- `vitest:db01-mongo-tenant-read`: filtro por organización en lectura por ID.
- `vitest:db01-mongo-version-conflict`: `expectedVersion` incluye tenant y devuelve conflicto sin reintento.
- `vitest:db01-http-no-browser-authority` y `vitest:db01-http-fail-closed`: HTTP same-origin, sin headers de autoridad, sin fallback ni bulk write.
- `vitest:db01-workspace-route-fail-closed`: el endpoint responde 503 antes de identidad de servidor y no publica datos.
- `vitest:m01-server-role-tenant`, `vitest:m01-server-membership-refresh`, `vitest:m01-server-csrf-logout-revocation`, `vitest:m01-server-rate-and-generic-login`, `vitest:m01-bootstrap-admin-only`, `vitest:m01-cross-tenant-404` y `vitest:m01-server-401-403-404-contract`: cobertura aislada de rol/tenant, actualización de membresía, CSRF, revocación real, límite de login, bootstrap exclusivo, lectura cross-tenant y respuestas de autorización.
- `vitest:m02-payment-atomic-idempotent-audit`, `vitest:m02-payment-retry-no-duplicate`, `vitest:m02-inventory-atomic-idempotent-audit` y `vitest:m02-financial-authority-reject`: comandos de pago/inventario transaccionales, idempotencia por tenant, auditoría de servidor y rechazo de autoridad del navegador.
- `vitest:m02-file-metadata-private-multiuser` y `vitest:m02-file-reject-browser-authority`: metadatos de adjuntos privados, cuentas sintéticas A/B/C y denegación antes de recuperar bytes.
- `vitest:m02-bootstrap-dry-run` y `vitest:m02-bootstrap-idempotent-indexes`: bootstrap fuera de handlers, dry-run sin escrituras y aplicación de índices nombrados.

No hay certificación Atlas, dos sesiones ni adjuntos remotos: esos gates continúan bloqueados por infraestructura e identidad no provisionadas.
