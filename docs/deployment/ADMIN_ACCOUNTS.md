# Cuatro cuentas administrativas y módulo Cuenta

Esta entrega añade cuatro identificadores internos (no son buzones de correo):

| Persona | Usuario |
| --- | --- |
| Sophia Gonzalez | `sophia.gonzalez@analizaencasa` |
| Wendy Estrada | `wendy.estrada@analizaencasa` |
| Luis Aguilar | `luis.aguilar@analizaencasa` |
| Gabriela Cabrera | `gabriela.cabrera@analizaencasa` |

Todas pertenecen a la misma organización ADMIN activa que `linquicarloss@gmail.com` y reciben el rol `ADMIN`. El registro público no puede elegir este rol. La contraseña temporal solicitada se entrega al operador por un canal seguro y se pasa únicamente mediante `ANALIZA_TEMP_ADMIN_PASSWORD`; no se guarda en el repositorio ni se imprime. Cada persona debe cambiarla por una clave personal de al menos 12 caracteres en `/account` antes de abrir datos operativos. Las otras sesiones se revocan al cambiarla.

## Despliegue, en este orden

1. Confirmar que la conexión privada del operador corresponde a la base de producción deseada y que `linquicarloss@gmail.com` tiene exactamente una membresía ADMIN activa. No usar una cuenta SQL de runtime con privilegios limitados para migrar.
2. Aplicar la migración `020_account_profile.sql` con el procedimiento de migraciones del proyecto (`npm run db:migrate`). El servidor nuevo exige las 20 migraciones antes de iniciar.
3. Ejecutar `npm run admin:provision:plan` para revisar nombres/usuarios. Configurar `ANALIZA_TEMP_ADMIN_PASSWORD` en la sesión privada del operador y ejecutar `npm run admin:provision`. Para Neon, también configurar `ANALIZA_MANAGED_POSTGRES=neon` y `DATABASE_URL_UNPOOLED` o `DATABASE_URL`; para PostgreSQL propio, usar `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` y opcionalmente `PGPORT`.
4. Desplegar la aplicación actualizada y comprobar que cada usuario entra, es dirigido a `/account`, cambia la clave y puede abrir los módulos ADMIN. Comprobar que una clave temporal anterior ya no permite entrar después del cambio.

El comando es idempotente: una segunda ejecución conserva las cuentas existentes y **no** restablece sus claves. Si un usuario ya existe en otra organización, inactivo o sin rol ADMIN, se detiene sin cambios. Nunca pegar la conexión privada ni la clave en una incidencia o chat público.

## Verificación local

`npm run test:react`, `npm run docker:build` y `npm run test:postgresql` ejercitan la migración, el alta de cuatro cuentas sintéticas, cambio obligatorio de clave y las diez escalas por paciente. Las pruebas usan únicamente contenedores/credenciales sintéticos.
