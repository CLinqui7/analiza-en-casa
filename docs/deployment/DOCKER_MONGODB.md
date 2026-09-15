# Docker: registro individual y MongoDB

Esta imagen contiene frontend Next.js y API juntos, registro individual, login,
RBAC y el cuestionario de organización, personal y servicios. Escucha en `8080`,
usa Next standalone y corre como `node` (UID 1000). MongoDB permanece fuera de la
imagen. Los artefactos PostgreSQL anteriores se conservan por separado.

## Descargar y arrancar

```sh
git clone --branch codex/cloud-run-cloud-sql https://github.com/CLinqui7/analiza-en-casa.git
cd analiza-en-casa
```

Copiar `config/docker-mongodb/runtime.example` a `.local/docker-mongodb.env` y
configurar privadamente URI, base y prefijo. `MONGODB_MIGRATION_URI` es la conexión
del operator; `MONGODB_URI` es la conexión del runtime. Ambas apuntan a la misma
base y namespace. La identidad de migración debe poder crear índices. Para
continuar usando los mismos datos, conservar el prefijo entre despliegues.

Añadir al archivo privado las referencias de las imágenes publicadas:

```dotenv
ANALIZA_MONGO_IMAGE=desarrollotuvet/analiza-en-casa:mongodb-a05a0baa2091
ANALIZA_MONGO_OPERATOR_IMAGE=desarrollotuvet/analiza-en-casa:mongodb-operator-a05a0baa2091
```

```sh
docker compose --env-file .local/docker-mongodb.env -f compose.mongodb.yaml up --no-build --pull always -d
```

Abrir `http://localhost:8080/register`. El servicio `migrate` ejecuta las migraciones
antes de iniciar `web`. Si falla, la web nueva no arranca. Repetir una migración
aplicada verifica el checksum y no repite índices ni crea usuarios demo. La
autenticación de producción conserva cookies Secure; para acceso externo se
necesita HTTPS en el ingress. Usar `localhost` para QA local.

## Construir desde la fuente

Fuente exacta de estos artefactos: `a05a0baa20910bce53a4f1242bfc8858ae837cb5`.
Para reproducirla en el clon limpio, hacer `git checkout` de ese commit. No
restaurar un directorio con cambios propios. Desde ese checkout:

```sh
docker build --progress=plain --build-arg SOURCE_SHA=a05a0baa20910bce53a4f1242bfc8858ae837cb5 --build-arg DATA_MODE=mongodb --build-arg REGISTRATION_MODE=isolated -t analiza-web:mongodb-preview .
docker build --progress=plain --target mongo-operator --build-arg SOURCE_SHA=a05a0baa20910bce53a4f1242bfc8858ae837cb5 --build-arg DATA_MODE=mongodb --build-arg REGISTRATION_MODE=isolated -t analiza-operator:mongodb-preview .
```

Para iniciar imágenes construidas localmente, omitir las dos referencias del
registro del archivo privado y ejecutar el mismo `compose up --no-build -d` sin
`--pull always`. El Dockerfile sin esos argumentos conserva la configuración
PostgreSQL; cambiar el motor público requiere reconstruir.

## Verificación

Build y operator ejecutados de verdad. Cuatro pruebas de registro/cuestionario
contra el contenedor; flujo Core de pacientes, médicos, hospitalizaciones, turnos,
catálogos, adjuntos privados y permisos; reinicio con conservación de sesión y
cuestionario; caída real de la conexión MongoDB con HTTP 503 sin falso éxito ni
localStorage. Las pruebas usan datos sintéticos. La inspección confirma usuario
no-root, puerto 8080, standalone y ausencia de archivos de entorno, claves privadas
y URI real de conexión en `/app` de ambas imágenes.

Los digest e IDs verificables quedan en
`docs/release/MONGODB_DOCKER_VERIFICATION.json`. El registro/cuestionario de esta
entrega usa MongoDB; no acredita nuevas funciones PostgreSQL ni despliegue GCP.
