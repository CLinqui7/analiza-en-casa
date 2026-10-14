# Operación de `analiza-contabo-staging`

La instancia usa la VPS de Contabo `vmi3659839`, Ubuntu 24.04.5, IP `207.244.227.122`. El código de aplicación instalado corresponde a `93d89035854c4b5ac0966dff5ee3ce1af6ab3ac1` en la rama `codex/contabo-clean-migration`; la documentación de esta rama puede tener commits posteriores sin cambiar la imagen. El estado exacto y los límites se registran en [CONTABO_COMPLETION_REPORT.md](CONTABO_COMPLETION_REPORT.md). La imagen PostgreSQL 18.6 está fijada por digest en `deploy/contabo/compose.yaml` mediante un `.env` privado. Nginx se reservó para el futuro HTTPS, pero ahora sólo atiende loopback.

## Componentes instalados

Docker Engine, Compose, Buildx, containerd, Nginx, UFW, Fail2ban, restic, curl, jq, OpenSSL, Git, Python 3, sysstat, Node.js 24.13.1 y Google Chrome 155 para pruebas aisladas. Chrome no forma parte del contenedor web. Los contenedores web y PostgreSQL tienen almacenamiento, secretos, límites de CPU/RAM y logs propios. El web corre como UID 1000, filesystem raíz de sólo lectura, sin capabilities y sin privilegios adicionales. PostgreSQL escucha exclusivamente por socket Unix, no expone 5432. La cuenta de aplicación no es superusuario ni tiene `BYPASSRLS`; las tablas de negocio fuerzan RLS y las escrituras se limitan al tenant. Hay una cuenta migradora separada, usada sólo por el operador.

Directorio privado: `/opt/analiza-contabo-staging` (`0700`), con `secrets/`, `files/`, `releases/` y `backups/restic/`. Ningún secreto se versiona. `deploy` y `root` aceptan la clave SSH dedicada; tras verificar ambos accesos se deshabilitaron las contraseñas por SSH con `deploy/contabo/sshd-key-only.conf` instalado como `00-analiza-key-only.conf`. La contraseña de la consola del proveedor no se cambió. La clave privada del operador está en `C:\Users\carlo\.ssh\analiza-contabo-staging` con ACL sólo para el usuario y SYSTEM. No se utilizaron credenciales de Vercel para la VPS. `docker compose` usa `restart: unless-stopped`, y `docker`, `nginx`, `fail2ban`, `analiza-contabo-backup.timer` y `analiza-contabo-health.timer` están habilitados. La comprobación de salud es local cada cinco minutos y escribe sólo en journal; no envía notificaciones externas.

## Acceso de prueba en este equipo

El único acceso externo permitido por UFW es SSH 22. Para abrir la interfaz desde el equipo que conserva la clave privada:

```powershell
ssh -i C:\Users\carlo\.ssh\analiza-contabo-staging -N -L 18080:127.0.0.1:18080 deploy@207.244.227.122
```

Mientras ese comando siga abierto, usar `http://localhost:18080/login`. La cuenta inicial corresponde al correo administrador que proporcionó el propietario; la contraseña no se incluye en este repositorio. El túnel local automatizado usado en QA tiene el mismo alcance. No abrir la IP directamente: el puerto 80/443 aún no sirve esta instancia y no hay HTTPS público ni dominio asociado. La preparación de HTTPS requiere decisión de dominio y configuración futura de proxy/certificado.

## Operación y respaldo

La receta versionada está en `deploy/contabo/compose.yaml`; el script de despliegue de esta tarea creó una revisión inmutable por SHA en `releases/` y actualizó las dos referencias de imagen. Migraciones y aprovisionamiento de rol se ejecutan explícitamente por el perfil `operator`; no son parte del arranque web. `curl http://127.0.0.1:18080/api/health` en el VPS debe devolver `{"status":"ready"}`. `docker compose ps`, `docker stats --no-stream`, `systemctl status analiza-contabo-health.timer` y `journalctl -u analiza-contabo-health.service` sirven para diagnóstico local.

`backup.sh` pausa temporalmente la web, produce `pg_dump -Fc`, copia configuración/archivos privados, guarda todo cifrado con restic y reanuda la web. Su timer diario es 03:30 UTC. La última ejecución verificada produjo el snapshot `19ae6639`; `restic check` y `restore-check.sh` restauraron la base en un contenedor temporal, con 32 migraciones, 546 artículos y cero pacientes. El script borra su directorio temporal aun si ocurre un error y vuelve a iniciar la web. La copia cifrada externa se verificó desde la carpeta OneDrive de este equipo, incluida la lectura y hash del volcado; la tarea `Analiza-Contabo-Offsite-Restic` quedó programada diariamente a las 07:00 mientras la sesión Windows esté abierta, y su primer resultado fue 0. No se ha comprobado la sincronización de OneDrive en la nube. Tampoco se aprobó retención automática ni se confirmó Auto Backup de Contabo. Esta dependencia de una PC impide afirmar continuidad de negocio completa.

El perfil desplegado deshabilita registro público y semilla demo. No hay proveedor WhatsApp/SMTP ni jobs externos configurados. La base limpia contiene sólo organización/cuenta administrativa y catálogos candidatos inactivos. Para reportes con datos clínicos reales, portal del paciente y operaciones posteriores falta la clasificación y autorización indicadas en `CONTABO_COMPLETION_REPORT.md`.
