# Despliegue Ubuntu

Esta variante ejecuta únicamente Analiza en Docker. PostgreSQL y Nginx permanecen instalados en el host Ubuntu. La web usa el socket local de PostgreSQL; el puerto 5432 no se publica en Internet. Los archivos privados viven en `/opt/analiza/files` y sólo se entregan después de la autorización de las rutas API.

Requisitos: Ubuntu con Docker Engine y Compose v2, PostgreSQL 18, Nginx y un certificado TLS ya administrado por el servidor.

## 1. Preparar PostgreSQL y directorios

```bash
sudo install -d -o 1000 -g 1000 -m 0700 /opt/analiza/files
getent group postgres | cut -d: -f3
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE analiza_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'REEMPLAZAR_MIGRATOR_PASSWORD';
CREATE ROLE analiza_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'REEMPLAZAR_RUNTIME_PASSWORD_DE_32_CARACTERES';
CREATE DATABASE analiza_en_casa OWNER analiza_migrator;
SQL
```

Si las identidades ya existen, no vuelva a crearlas ni cambie contraseñas a ciegas. Confirme primero sus atributos con `sudo -u postgres psql -c "\\du+ analiza_migrator"` y `sudo -u postgres psql -c "\\du+ analiza_app"`.

En `/etc/postgresql/18/main/pg_hba.conf`, agregue estas reglas **antes** de la regla general `local ... peer` y recargue PostgreSQL. Esto permite contraseña SCRAM por el socket sin hacer que PostgreSQL escuche públicamente:

```conf
local   analiza_en_casa   analiza_migrator   scram-sha-256
local   analiza_en_casa   analiza_app        scram-sha-256
```

```bash
sudo systemctl reload postgresql
sudo ss -lntp | grep 5432 || true
```

La imagen corre como UID/GID `1000:1000`, nunca como root. Compose añade también el GID real del grupo `postgres`; por eso `POSTGRES_SOCKET_GID` debe coincidir con `getent group postgres`. El bind mount del socket es de sólo lectura. Si el host usa otra ruta de socket, alinee primero PostgreSQL con `/var/run/postgresql`; la aplicación rechaza rutas Unix distintas.

## 2. Configurar y construir

```bash
git clone --recurse-submodules https://github.com/CLinqui7/analiza-docker.git
cd analiza-docker
cp deploy/ubuntu/.env.example deploy/ubuntu/.env
sed -i "s/^POSTGRES_SOCKET_GID=.*/POSTGRES_SOCKET_GID=$(getent group postgres | cut -d: -f3)/" deploy/ubuntu/.env
editor deploy/ubuntu/.env
chmod 600 deploy/ubuntu/.env
docker build --build-arg DATA_MODE=postgresql --build-arg SOURCE_SHA="$(git -C source rev-parse HEAD)" -t analiza-web:selfhosted source
docker build --target operator --build-arg DATA_MODE=postgresql --build-arg SOURCE_SHA="$(git -C source rev-parse HEAD)" -t analiza-operator:postgresql source
```

Sustituya `PGPASSWORD=CHANGE_ME`. No copie contraseñas en Git ni las imprima en logs.

## 3. Migrar explícitamente

Las migraciones no se ejecutan al arrancar la web. Cree un archivo local `deploy/ubuntu/operator.env` (queda ignorado por Git), con permisos `600`:

```dotenv
PGHOST=/var/run/postgresql
PGPORT=5432
PGDATABASE=analiza_en_casa
PGUSER=analiza_migrator
PGPASSWORD=REEMPLAZAR_MIGRATOR_PASSWORD
ANALIZA_PG_RUNTIME_ROLE=analiza_app
ANALIZA_MIGRATION_APPROVED=1
```

Ejecute la migración con el mismo socket. El rol runtime debe existir, ser distinto del migrador, no ser superusuario y no tener `BYPASSRLS`:

```bash
chmod 600 deploy/ubuntu/operator.env
POSTGRES_SOCKET_GID=$(getent group postgres | cut -d: -f3)
docker run --rm --user 1000:1000 --group-add "$POSTGRES_SOCKET_GID" \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,uid=1000,gid=1000 \
  -v /var/run/postgresql:/var/run/postgresql:ro \
  --env-file deploy/ubuntu/operator.env \
  analiza-operator:postgresql --migrate
```

Para un servidor nuevo, también puede pedir al operador que aprovisione el rol runtime durante esa misma operación. Añada al `operator.env` `ANALIZA_ENVIRONMENT=selfhosted`, `ANALIZA_DB_TRANSPORT=unix`, `ANALIZA_SELFHOSTED_PROVISION_APPROVED=1`, `ANALIZA_PROVISION_RUNTIME_APPROVED=1` y `ANALIZA_PG_RUNTIME_PASSWORD=<la misma contraseña runtime de 32+ caracteres>`, y ejecute `--migrate --provision-runtime`. No use esta opción para sobrescribir un rol existente: el operador lo rechaza si es privilegiado y nunca cambia silenciosamente su contraseña.

## 4. Levantar y comprobar

```bash
docker compose --env-file deploy/ubuntu/.env -f deploy/ubuntu/compose.yaml config
docker compose --env-file deploy/ubuntu/.env -f deploy/ubuntu/compose.yaml up -d
docker compose --env-file deploy/ubuntu/.env -f deploy/ubuntu/compose.yaml ps
curl --fail http://127.0.0.1:8080/api/health/live
curl --fail http://127.0.0.1:8080/api/health
```

Después de reiniciar el contenedor, repita las comprobaciones y confirme que el paciente de prueba y su adjunto siguen presentes. PostgreSQL persiste en el host y los adjuntos en `/opt/analiza/files`.

## 5. Nginx y HTTPS

Copie `nginx.conf.example`, sustituya dominio y rutas del certificado existente, y valide antes de recargar:

```bash
sudo cp deploy/ubuntu/nginx.conf.example /etc/nginx/sites-available/analiza
sudo ln -s /etc/nginx/sites-available/analiza /etc/nginx/sites-enabled/analiza
sudo nginx -t
sudo systemctl reload nginx
```

Nginx es el único punto expuesto. El contenedor escucha sólo en `127.0.0.1:8080`; PostgreSQL no debe exponerse. Si se usa el transporte TCP secundario, seleccione `ANALIZA_DB_TRANSPORT=tcp`, configure un `PGHOST` explícito y limite el origen con firewall y `pg_hba.conf` a la IP privada exacta del servidor Analiza.

## Respaldo

Respalde juntos la base y el directorio de archivos, manteniendo permisos privados:

```bash
sudo -u postgres pg_dump -Fc analiza_en_casa > analiza_en_casa.dump
sudo tar --numeric-owner -C /opt/analiza -czf analiza-private-files.tgz files
```
