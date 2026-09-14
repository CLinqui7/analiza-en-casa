# Migraciones y variables de entorno

Estado del preview del 14/09/2026: build publicado en Vercel; validación remota
bloqueada por la lista de IP autorizadas de Atlas, que solo permite la computadora
del operador. Hace falta autorizar la conectividad desde Vercel antes de usarlo.
Las migraciones y las pruebas con MongoDB desde el entorno local sí pasaron.

## Prueba en Vercel: MongoDB

La aplicación Next.js contiene frontend y API. El registro crea usuario, organización, membresía ADMIN y sesión en una transacción. Cada cuenta nueva trabaja en una organización distinta. Las contraseñas usan scrypt; las sesiones usan cookies HttpOnly y tokens almacenados como hash. Las escrituras requieren autorización y CSRF.

El cuestionario `/onboarding` guarda organización, directorio de personal y servicios. El personal del directorio no recibe una cuenta de acceso automáticamente. Las tarifas son opcionales y las define la persona que completa el formulario. Este preview se usa con información sintética. No incluye envío de correos de verificación o recuperación.

1. Copiar [config/vercel/runtime.example](../../config/vercel/runtime.example) a `.local/preview.env` y completar los valores privados.
2. Vincular el proyecto existente con `npx vercel link`. Configurar en Vercel **Preview**, para la misma rama, las ocho variables de aplicación de la plantilla (todas excepto `VERCEL_SCOPE`). Marcar `MONGODB_URI` como sensible. Mantener iguales URI, base y prefijo entre la migración y el runtime.
3. Ejecutar desde la raíz:

```sh
npm ci
npm run db:plan:mongo
npm run deploy:preview -- .local/preview.env
```

El último comando ejecuta las migraciones y solo publica si terminan correctamente. La base requiere soporte de transacciones (Atlas/replica set), conectividad desde el operador y Vercel, y permisos sobre las colecciones elegidas. No crea un cluster de pago. El prefijo permite usar colecciones nuevas dentro de una base existente; la autorización por organización se aplica además en el backend.

Las migraciones inmutables viven en `database/mongodb/migrations/`. `schemaMigrations` registra versión, SHA256 y fecha. Un bloqueo impide operadores concurrentes. Los índices son idempotentes: una ejecución interrumpida puede reintentarse sin insertar usuarios demo. No se eliminan colecciones ni datos.

Si un proceso muere, el bloqueo queda retenido deliberadamente. El ingeniero debe comprobar que ya no hay operador activo y actualizar únicamente `released: true` del documento `_id: deployment` en `<prefijo>schemaMigrationLocks`, conservando su historial y registrando la intervención. Nunca liberar un bloqueo de una operación activa. Un checksum distinto exige una nueva migración; no editar la ya aplicada.

Para migrar sin desplegar:

```sh
node --env-file=.local/preview.env scripts/deployment/mongo-command.mjs --migrate
```

## Docker / Cloud Run: PostgreSQL 18

Esta ruta conserva sus migraciones SQL, RLS y contenedor `operator` separado. El registro y cuestionario nuevos del preview usan MongoDB; no se declaran implementados para PostgreSQL. La publicación cloud sigue pendiente de una entrega expresamente autorizada.

Variables: [web PostgreSQL](../../config/postgresql/runtime.example) y [operator](../../config/operator/runtime.example). `PGPASSWORD` es secreto; en Cloud Run se inyecta mediante Secret Manager. `PGUSER` del operator debe ser distinto del usuario restringido de la web. `PGHOST` es `/cloudsql/PROJECT:REGION:INSTANCE` cuando se utiliza el socket administrado. La Service Account proporciona la identidad para Cloud SQL y GCS; no se necesita entregar una clave JSON.

```sh
docker build --target operator -t analiza-operator:postgresql .
docker run --rm analiza-operator:postgresql --dry-run
docker run --rm --env-file .local/operator.env analiza-operator:postgresql --migrate
```

Para una base local Docker, añadir `--network NOMBRE_DE_LA_RED` y usar el nombre del contenedor PostgreSQL como `PGHOST`. El socket Cloud SQL solo existe cuando está montado por el entorno cloud/proxy. Los scripts SQL se aplican en orden, con transacciones, checksum y bloqueo asesor; un error devuelve un código distinto de cero. El seed sintético es una operación explícita separada, nunca parte automática del arranque web.

`scripts/deployment/deploy-staging.ps1` prepara una secuencia sobre recursos existentes: actualizar la imagen operator por digest, ejecutar `analiza-staging-migrate --wait`, y solo después actualizar `analiza-staging`. Sin `-Execute` imprime el plan. Con `-Execute` modifica staging y puede generar costos; el ingeniero debe autorizarlo. No crea infraestructura ni toca `analiza-prod`.

```powershell
./scripts/deployment/deploy-staging.ps1 -ProjectId $project -WebImage $webDigestUri -OperatorImage $operatorDigestUri
# Añadir -Execute únicamente al autorizar la ejecución de staging.
```

No hace falta compartir contraseñas por mensajería: entregar estas plantillas y dar al ingeniero acceso autorizado al gestor de secretos. Los valores `NEXT_PUBLIC_*` son públicos y se fijan al construir; cambiar de motor exige reconstruir la imagen con la configuración correspondiente.
