# Docker y preparación de migración

Alcance de cierre: Docker local y migración preparada. Cloud deployment = DEFERRED.
Billing = NOT REQUIRED FOR THIS HANDOFF. No ejecutar apply, habilitar facturación,
crear recursos cloud ni desplegar durante esta entrega.

## Distribución

[CLinqui7/analiza-docker](https://github.com/CLinqui7/analiza-docker) referencia este
repositorio como submódulo `source` en el SHA verificado. El README allí contiene
los comandos completos para PowerShell, instalación local y descarga de imágenes.
Los Dockerfile, ignore, migraciones y código canónicos permanecen en este proyecto.
La integración en `main` conserva los commits de `codex/cloud-run-cloud-sql`.
La publicación del código no ejecuta un despliegue cloud.

La evidencia definitiva se guarda en
[evidence/final-manifest.json](https://github.com/CLinqui7/analiza-docker/blob/main/evidence/final-manifest.json)
y en los assets del release Docker. Incluye SHA del proyecto, ID de ambas imágenes,
SHA256 de los dos archivos tar y resultados de pruebas. Se registra después de
congelar el commit de la entrega Docker,
`6fae1890af99a7913092aea248cb120bd595e335`. Las actualizaciones posteriores de
documentación no sustituyen las imágenes ni cambian su SHA de fuente.
`CLOUD_RUN_SQL_STATE.json` conserva aparte la evidencia de la entrega anterior.

## Construcción y ejecución

Prerequisitos: Git, Docker Desktop con contenedores Linux y PowerShell.
El repositorio Docker proporciona `Initialize-LocalQa.ps1`: crea exclusivamente
una red nueva, PostgreSQL 18 y un emulador local de GCS, genera claves QA privadas,
y ejecuta migraciones y seed desde el operator. No inicia otra aplicación.
El archivo privado `.local/runtime.env` se entrega a Docker en runtime; nunca se
versiona ni forma parte del contexto de build. Las credenciales de acceso
sintético quedan en `.local/qa-login.json`, fuera de Git.

Tras ejecutar ese script desde el repositorio Docker:

```powershell
$qa = Get-Content .local/resources.json | ConvertFrom-Json
docker run -d --name $qa.web --network $qa.network --env-file .local/runtime.env -e PORT=8080 -p 127.0.0.1:8080:8080 --read-only --tmpfs /tmp --tmpfs /app/apps/web/.next/cache:uid=1000,gid=1000 --cap-drop ALL --security-opt no-new-privileges analiza-web:cloudrun
Invoke-RestMethod http://localhost:8080/api/health/live
Invoke-RestMethod http://localhost:8080/api/health
```

Como alternativa a ese `docker run` (no ejecutar ambas en el mismo puerto):

```powershell
docker compose --env-file .local/runtime.env -f source/compose.yaml -f source/compose.qa.yaml up -d --no-build
```

`docker restart` de la web conserva PostgreSQL y archivos del emulador en sus
volúmenes externos. No usar `docker system prune` ni borrar volúmenes para reiniciar.
QA utiliza sólo loopback; no requiere cuenta Docker ni credenciales GCP.

## Verificación reproducible del contenedor final

Desde `source`, con Node 24 y Google Chrome instalados:

```powershell
npm exec --yes --package=npm@11.18.0 -- npm ci
$env:ANALIZA_VERIFY_OPERATOR_IMAGE = 'analiza-operator:postgresql'
npm run test:postgresql
```

La prueba crea nombres/red independientes y comprueba PostgreSQL 18, migraciones
repetibles, seed sintético, login, navegación, pacientes, médicos,
hospitalizaciones, turnos, permisos, RLS, CSRF, adjuntos mediante SDK GCS local,
reinicio, caída SQL sin success ni fallback y cierre durante una escritura.
No necesita `next dev`. El operator se ejecuta desde su propia imagen.
Cotizaciones y otros módulos fuera del Core heredado no se declaran migrados.
DELETE sigue sin concederse; los permisos Core se prueban mediante CREATE/READ/UPDATE
y rechazo de operaciones prohibidas. GCS real y capacidad cloud quedan diferidos.
