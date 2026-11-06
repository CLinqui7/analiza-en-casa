# Entrega del VPS Contabo a otros chats de Codex y proyectos

Estado revisado el 4 de noviembre de 2026, 16:49 (El Salvador). Este archivo se
puede compartir por GitHub: **no contiene contraseñas ni claves**. El anexo
privado local está en
`C:\Temp\analiza-contabo-private\CODEX_MULTIPROJECT_VPS_PRIVATE.md`.
Quien no tenga acceso a esa PC debe recibir los accesos por un canal privado;
no se deben pegar en chats, issues, PR, logs o repositorios.

## Infraestructura y proyectos existentes

| Recurso | Estado |
| --- | --- |
| Código de Analiza | `https://github.com/CLinqui7/analiza-en-casa`, PR de trabajo `#20` sin fusionar; confirmar rama y SHA actuales en GitHub |
| VPS | Contabo `vmi3659839`, IP `207.244.227.122`, Ubuntu 24.04.5, 6 vCPU, 11 GiB RAM, disco raíz 193 GiB |
| Capacidad observada | 167 GiB libres en `/` y unos 10 GiB de RAM disponibles; medir de nuevo antes de instalar |
| Entrada pública | Nginx en 80/443, UFW activo; HTTPS de Analiza en `https://analiza.207.244.227.122.sslip.io/` |
| Analiza | `/opt/analiza-contabo-staging`; web Docker en `127.0.0.1:18081`, proxy interno en `127.0.0.1:18080`; PostgreSQL 18 por socket Unix |
| Base activa de Analiza | `analiza_live_20261014`; no usar `analiza_en_casa`, `analiza_candidate_20261014` ni `analiza_source_quarantine` como base activa |
| TuVet | `/opt/tuvet-staging`, usuario `tuvet-deploy`, base `tuvet_staging`, servicios `tuvet-postgres.service` y `tuvet-web.service`; web activa en `https://staging.tuvetbi.com/`, socket Unix `/run/tuvet-proxy/tuvet-web.sock` |
| Copia de Analiza | restic cifrado en `/opt/analiza-contabo-staging/backups/restic`, timer `analiza-contabo-backup.timer`; copia externa local `Analiza-Contabo-Offsite-Restic` |
| Copia de TuVet | repositorio separado `/var/backups/tuvet-restic`, servicio y timer `tuvet-backup`; copia externa local `TuVet-Contabo-Offsite-Restic`; clave independiente en `/etc/tuvet-backup/restic-password`, nunca en Git |

La URL de Vercel `https://analiza-en-casa-demo.vercel.app/` responde HTTP 307
hacia el VPS; no sirve la base antigua. El dominio `sslip.io` es temporal.
El 4 de noviembre se instalaron 28 paquetes del host, Docker 29.9.3 y
containerd 2.4.2, se habilitó live restore y se completó un reinicio controlado.
Ambos proyectos arrancaron automáticamente y sus bases y accesos pasaron las
comprobaciones. No hay servicios fallidos ni reinicios pendientes. El respaldo
de TuVet antes se omitía por faltar el hook: ahora su servicio root toma un
respaldo cifrado real, sin cambiar el usuario de aplicación ni los roles SQL.
Las dos copias externas fueron verificadas íntegramente y sus tareas Windows
terminaron con código 0. Requieren una sesión del operador y la siguiente
ejecución automática aún debe observarse. Consultar
[el informe de mantenimiento](CONTABO_HOST_MAINTENANCE_2026-11-04.md) y medir el
estado de nuevo antes de actuar. No confundir datos históricos con el estado actual.

## Acceso sin mostrar secretos

En la PC del operador, la clave SSH de root es
`C:\Temp\analiza-contabo-private\operator.key`; la de `deploy` es
`C:\Users\carlo\.ssh\analiza-contabo-staging`. `known_hosts` ya contiene la
huella fijada. La autenticación SSH por contraseña está deshabilitada. Ejemplo
de comprobación de solo lectura:

```powershell
ssh -T -i 'C:\Temp\analiza-contabo-private\operator.key' -o BatchMode=yes -o StrictHostKeyChecking=yes root@207.244.227.122 'hostname; docker ps --format "{{.Names}} {{.Status}}"'
```

Los archivos locales `account.json`, `secrets-web.env`,
`secrets-operator.env`, `secrets-postgres-password` y
`secrets-restic-password` están en `C:\Temp\analiza-contabo-private` y deben
leerse únicamente cuando la operación los requiera. Sus equivalentes de
producción están en `secrets/` dentro del directorio privado de Analiza.
**Ningún proyecto nuevo debe reutilizar esas credenciales.** Para el proceso
detallado de Analiza, leer [CONTABO_OPERATOR_HANDOFF.md](CONTABO_OPERATOR_HANDOFF.md)
y [CONTABO_MAINTENANCE_2026-10-27.md](CONTABO_MAINTENANCE_2026-10-27.md).

## Antes de migrar otro proyecto

1. Identificar repositorio, rama, framework, servicios, base de datos,
   archivos persistentes, dominio y reglas de negocio. Revisar el origen y
   probar una restauración aislada con datos sintéticos. No inferir que TuVet
   está vacío: la revisión documentada encontró 21 tablas con datos.
2. Medir `docker ps`, `systemctl list-units --type=service`, `ss -ltnp`,
   `df -h /` y `free -h`. Reservar RAM, disco y un puerto libre en loopback.
   No reiniciar ni mover los recursos de Analiza o TuVet.
3. Crear para el proyecto su propio usuario Unix, directorio bajo `/opt`,
   red/servicios Docker, base y rol SQL de privilegio mínimo, secretos con
   permisos restringidos, virtual host Nginx y certificado TLS. Nunca exponer
   PostgreSQL ni un puerto de aplicación directamente a Internet.
4. Configurar copias cifradas, una copia externa independiente, restauración
   probada, verificación de salud y ruta de reversión. No reutilizar el
   repositorio restic, el rol SQL ni el volumen de Analiza.
5. **Subir antes a GitHub** todo código, migración y configuración sin secretos:
   commit y push a una rama `codex/*`, verificar que el SHA remoto coincide,
   construir/publicar exactamente desde ese SHA y abrir PR. No fusionar a
   `main` automáticamente. Si GitHub o la verificación de SHA fallan, detener
   el despliegue.
6. Hacer respaldo justo antes del corte. Desplegar primero en un entorno
   aislado, aplicar migraciones repetibles, comprobar API, navegador,
   permisos, datos y archivos. Después del corte, comprobar HTTPS, logs,
   respaldos y reversión. Registrar SHA, pruebas y riesgos en el PR.

Analiza dispone de `/opt/analiza-contabo-staging/deploy-release.sh`, que
comprueba un snapshot restic nuevo antes de migrar. Es **específico de
Analiza**; otros proyectos necesitan su propio proceso y respaldo. En
Analiza, la imagen activa revisada fue
`47c8a522e1007f0231d89b1789edb42c62098d5e`. No asumir que seguirá
siendo la activa cuando otro chat lea este documento.

## Comprobación rápida de Analiza

```powershell
curl.exe -sS -o NUL -w 'HTTP %{http_code}\n' https://analiza.207.244.227.122.sslip.io/api/health
curl.exe -I https://analiza-en-casa-demo.vercel.app/
ssh -T -i 'C:\Temp\analiza-contabo-private\operator.key' -o BatchMode=yes -o StrictHostKeyChecking=yes root@207.244.227.122 'cd /opt/analiza-contabo-staging && docker compose ps && systemctl show analiza-contabo-backup.service -p Result -p ExecMainStatus && df -h /'
```

Si cambia el dominio de Analiza, revisar también el origen HTTPS privado de
encuestas (`ANALIZA_PUBLIC_ORIGIN`), los enlaces y QR existentes, el
certificado, el proxy y la redirección de Vercel antes de publicar.
