# Ubuntu self-hosted

Analiza conserva la misma aplicación Next.js, API, PostgreSQL, permisos por rol, RLS, CSRF y rutas privadas de descarga. Esta entrega sólo añade una segunda forma de desplegarla; Cloud Run, Cloud SQL y GCS continúan disponibles.

```text
Internet
   |
 Nginx
   |
 Docker Analiza :8080
   |             \
 PostgreSQL       archivos
 host Ubuntu      /opt/analiza/files
```

La opción recomendada en una sola máquina es `ANALIZA_DB_TRANSPORT=unix`: Docker monta `/var/run/postgresql` y no necesita publicar el puerto de PostgreSQL. `ANALIZA_FILE_STORAGE=filesystem` guarda objetos privados con nombres generados por el servidor, escrituras atómicas, modo `0600` y directorios `0700`. No se montan bajo `public/` ni se sirven como archivos estáticos.

Los comandos completos y copiables están en [`deploy/ubuntu/README.md`](../../deploy/ubuntu/README.md). El orden es:

1. Crear la base y las identidades separadas de migración y runtime.
2. Ajustar `pg_hba.conf` para SCRAM por socket local y mantener PostgreSQL sin exposición pública.
3. Crear `/opt/analiza/files`, propiedad de UID/GID `1000`, con modo `0700`.
4. Construir `analiza-web:selfhosted` y `analiza-operator:postgresql` desde el mismo Dockerfile.
5. Ejecutar explícitamente el operador de migraciones y aprovisionar/verificar el rol runtime.
6. Levantar únicamente `analiza-web` con Compose.
7. Comprobar `/api/health/live`, `/api/health`, login y persistencia antes de habilitar Nginx.

Variables web necesarias:

| Variable | Valor self-hosted |
|---|---|
| `ANALIZA_DATA_MODE` / `NEXT_PUBLIC_DATA_MODE` | `postgresql` |
| `ANALIZA_DB_TRANSPORT` | `unix` |
| `PGHOST` / `PGPORT` | `/var/run/postgresql` / `5432` |
| `PGDATABASE` | `analiza_en_casa` |
| `PGUSER` / `PGPASSWORD` | rol runtime restringido / secreto local |
| `PGPOOL_MAX` | `5` inicialmente |
| `ANALIZA_FILE_STORAGE` | `filesystem` |
| `ANALIZA_FILES_PATH` | `/data/private-files` |
| `POSTGRES_SOCKET_GID` | GID devuelto por `getent group postgres` |

Para PostgreSQL remoto existe `ANALIZA_DB_TRANSPORT=tcp`. No publique el puerto a Internet: use red privada, firewall con origen exacto, TLS si cruza redes y reglas estrechas en `pg_hba.conf`. Cloud continúa usando `ANALIZA_DB_TRANSPORT=cloudsql`, `PGHOST=/cloudsql/<connection-name>` y `ANALIZA_FILE_STORAGE=gcs`.
