# Operación local

## Iniciar la entrega Docker

Utilizar el README de [analiza-docker](https://github.com/CLinqui7/analiza-docker).
Su preparación QA crea una red y dependencias nuevas, genera credenciales
sintéticas privadas y ejecuta migraciones/seed con el operator separado.
La imagen web publicada se carga con `docker load` tras verificar SHA256.

Desde ese repositorio, una vez ejecutado `Initialize-LocalQa.ps1`:

```powershell
$qa = Get-Content .local/resources.json | ConvertFrom-Json
docker run -d --name $qa.web --network $qa.network --env-file .local/runtime.env -e PORT=8080 -p 127.0.0.1:8080:8080 --read-only --tmpfs /tmp --tmpfs /app/apps/web/.next/cache:uid=1000,gid=1000 --cap-drop ALL --security-opt no-new-privileges analiza-web:cloudrun
```

Acceso local: `http://localhost:8080/login`. Las credenciales sintéticas se
consultan en `.local/qa-login.json`; no se publican ni se reutilizan en producción.

## Salud y diagnóstico

```powershell
Invoke-RestMethod http://localhost:8080/api/health/live
Invoke-RestMethod http://localhost:8080/api/health
docker logs --tail 100 $qa.web
docker ps
```

`/api/health/live` verifica que el proceso responde. `/api/health` devuelve
disponibilidad de la aplicación y falla con 503 si la persistencia no está lista.
No comunicar un resultado exitoso cuando una escritura SQL haya fallado.
Revisar privadamente red, variables runtime, permisos y disponibilidad de la base;
no sustituir el error por modo mock ni cambiar de adaptador.

## Reinicio

```powershell
docker restart $qa.web
```

PostgreSQL y el emulador de archivos utilizan volúmenes separados de la web.
Reiniciar la aplicación conserva esos datos. No borrar volúmenes para resolver
un fallo de conexión. Verificar nombres antes de detener recursos; no usar prune
sobre otros proyectos.

## Verificaciones del código

Desde la raíz del proyecto original:

```powershell
npm run repo:preflight
npm test
npm run test:react
npm run audit:verify
$env:ANALIZA_VERIFY_OPERATOR_IMAGE = 'analiza-operator:postgresql'
npm run test:postgresql
```

La suite PostgreSQL crea otro conjunto de contenedores aislados con datos
sintéticos. Su reporte identifica el SHA y la imagen probados.
Los resultados históricos no sustituyen una prueba de una imagen nueva.

## Recuperación y cambios de esquema

Conservar el artefacto anterior y sus hashes. Ante un cambio incompatible, revisar
la compatibilidad de esquema antes de ejecutar otra versión de la web.
Las migraciones aplicadas no se borran ni se modifican retroactivamente; una
corrección requiere una migración revisada y evidencia de su resultado.
Las operaciones cloud, backups corporativos y cambios productivos requieren
un procedimiento autorizado por el responsable de infraestructura.
