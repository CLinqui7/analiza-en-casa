# Revisión de la migración Core

Se inspeccionó la diferencia de integración respecto a `main`
`4d990602e87e3f390241d42c6431c3fe03cd746f`, conservando el trabajo previo de
`codex/ui-polish-final-20260904` (`dbf91821d138a6bff09e66c72a409fb6f89de8b5`).
La rama de origen ya contiene 538 archivos distintos de main. La revisión de esta
entrega se concentra en los adapters, límites de autoridad, archivos, runtime e
infraestructura añadidos; la regresión completa cubre las páginas conservadas.
La PR compara contra esa rama de origen para que la migración sea revisable por sí sola.

Hallazgos corregidos y comprobados:

- Separación real de drivers y persistencia; modo PostgreSQL fijo en la imagen,
  sin conexión Mongo/local ante fallos. Validaciones y contratos de UI conservados.
- Organización/rol exclusivamente de sesión, usuario deshabilitado pierde acceso,
  CSRF en mutaciones y antes de leer uploads, SQL parametrizado y RLS forzado.
- Versiones optimistas, auditoría transaccional y turnos idempotentes con bloqueo
  de recursos para evitar doble reserva concurrente. Runtime sin DDL ni DELETE.
- Archivos fuera de SQL; metadatos privados, comprobación de propietario y hash,
  límites de cuerpo/concurrencia antes de agotar memoria, GCS fuera de transacciones.
- Apagado de Next con sockets vacíos y petición SQL bloqueada: cierre de conexiones
  ociosas, timeout/rollback, respuesta de error y SIGTERM dentro de 10 segundos.
- Infraestructura staging parametrizada y despliegue por digest; secretos por
  referencia, SA separadas, build sin permisos de deploy y ningún apply ejecutado.
- Override `uuid=11.1.1` para la dependencia de gaxios: lock e integridad del paquete
  contrastados con npm, `npm ci`, carga real del SDK y subida/bajada de bytes probados.
  El scanner de imagen conserva su regla de claves y reconoce únicamente el ejemplo
  literal `xxxxxxx` de la documentación pública del SDK; no excluye el archivo completo.

Se fija npm 11.18.0 en Docker/Cloud Build para evitar el fallo de npm 11.4.1 que
ignoraba overrides al atravesar workspaces. `npm ls uuid` con la versión corregida
confirma el override y la instalación desde lock mantiene cero vulnerabilidades
reportadas. Referencia: [corrección del resolver npm](https://github.com/npm/cli/pull/9671).

Los resultados ejecutables y el ID exacto de la imagen final están en
`docs/release/CLOUD_RUN_SQL_STATE.json`. No quedan hallazgos P0/P1 conocidos en
las modificaciones revisadas. Esto no certifica todos los módulos históricos,
esquemas corporativos, capacidad de producción ni integraciones cloud pendientes.
Se mantienen las clasificaciones y bloqueos existentes, sin promociones EXACT,
sin cambios en evidencia de video, sin GitHub Actions y sin merge a main.

## Ampliación de preparación, sin despliegue

Se verificaron en Docker los comandos del operador con un migrador sin SUPERUSER
ni BYPASSRLS, el seed bajo FORCE RLS, aprovisionamiento repetible de un rol runtime
y rechazo de contraseña discordante. Los jobs privados reciben secretos separados
del runtime. Terraform fmt/validate y cuatro pruebas del proveedor simulado pasan;
el plan con proyecto real propone 24 altas, cero cambios y cero bajas. No se aplicó.

GitGuardian detectó el literal de prueba `synthetic-unit-test-only` en
`apps/web/src/server/persistence/postgres-pool.test.ts`, commit `5b92c7f`, incidente
37265105. Se revisó la prueba: la configuración es ficticia y no abre una conexión
con esa contraseña. Es un falso positivo, no una credencial real expuesta. Se
conserva el chequeo externo sin desactivarlo, sin ignorar archivos y sin reescribir
historia. Su estado pendiente no debe anunciarse como PASS.

El usuario aplazó todo deployment. Vercel aún estaba conectado a GitHub; se verificó
con su CLI que la raíz del proyecto es el repositorio y se configuró
`git.deploymentEnabled["codex/cloud-run-cloud-sql"]=false` sólo para esta rama,
siguiendo la [configuración oficial de Git](https://vercel.com/docs/project-configuration/git-configuration).
La configuración de las otras ramas y la producción existente se conserva.
