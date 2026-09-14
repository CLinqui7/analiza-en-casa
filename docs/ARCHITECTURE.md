# Arquitectura

## Aplicación actual

Analiza utiliza una aplicación Next.js full-stack: las páginas y componentes
React están en `apps/web/src/app/` y `apps/web/src/components/`; las rutas HTTP,
en `apps/web/src/app/api/`. El contenedor ejecuta el servidor standalone de
Next.js sobre Node.js 24, como usuario no-root y con `PORT=8080`.

```text
Navegador
  → Next.js: frontend + rutas API
    → validación Zod, sesión y permisos por organización
      → servicios y repositories PostgreSQL
        → PostgreSQL 18: datos, transacciones, RLS y auditoría
      → adaptador de archivos privados
        → Google Cloud Storage: contenido binario
```

El destino cloud preparado es Cloud Run con Cloud SQL PostgreSQL mediante conexión
administrada/Unix socket y Service Account. Secret Manager proporciona referencias
privadas de runtime. El despliegue está diferido.

## Persistencia y límites

La interfaz consume contratos compartidos y proveedores HTTP.
`apps/web/src/server/persistence/` contiene los contratos y adaptadores.
`database/postgresql/migrations/` contiene las migraciones ordenadas.
El driver `pg` utiliza un pool acotado; las escrituras usan transacciones,
aislamiento por organización y controles de versión donde corresponden.

La sesión y los permisos se verifican en servidor. La identidad de runtime no es
superusuario, no evita RLS y no recibe DDL ni DELETE. El operator ejecuta
migraciones explícitas con una identidad separada: la web no migra al arrancar.
El esquema exacto y las operaciones concedidas se documentan en
[POSTGRESQL](deployment/POSTGRESQL.md).

Los archivos se almacenan como objetos privados; SQL mantiene sus metadatos.
Las pruebas locales usan el SDK de Google contra un emulador explícito.
Un fallo de SQL produce un error observable; no cambia a MongoDB ni localStorage.

## Alcance y compatibilidad

La edición Core comprende pacientes, médicos, hospitalizaciones, turnos, recursos
de enfermería y catálogos operativos. Los módulos excluidos conservan su código y
pruebas históricas; no se declaran migrados por compartir la interfaz.

Los adaptadores Mongo y la demo anterior con Supabase pertenecen a fases previas.
Se conservan para regresión. No son dependencias de respaldo del runtime PostgreSQL.

## Entrega y operación

El Dockerfile produce dos targets: `runtime` para frontend/API y `operator` para
migraciones/seed. La base Node está fijada por digest y npm utiliza el lockfile.
Los secretos se inyectan al ejecutar; no forman parte del build.

La entrega verificada de imágenes apunta a
`6fae1890af99a7913092aea248cb120bd595e335`. Consultar
[Docker](deployment/DOCKER_HANDOFF.md), [operación local](RUNBOOK.md) y
[preparación cloud](deployment/MIGRATION_HANDOFF.md).
