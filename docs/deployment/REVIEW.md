# Revisión de la migración Core

Se inspeccionó la diferencia de integración respecto a `main`
`4d990602e87e3f390241d42c6431c3fe03cd746f`, conservando el trabajo previo de
`codex/ui-polish-final-20260904` (`dbf91821d138a6bff09e66c72a409fb6f89de8b5`).
La rama de origen ya contiene 538 archivos distintos de main. La revisión de esta
entrega se concentra en los adapters, límites de autoridad, archivos, runtime e
infraestructura añadidos; la regresión completa cubre las páginas conservadas.
La revisión inicial comparó contra esa rama de origen. Para la integración
autorizada, el PR #7 pasa a comparar contra main e incluye sus ramas antecesoras.

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
sin cambios en evidencia de video ni GitHub Actions. La integración en main
se documenta al final de esta revisión.

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
En esa fase se conservó la configuración de las otras ramas. Para la integración
posterior se amplía el bloqueo a todas las ramas; el tráfico existente se conserva.

## Integración de ramas autorizada

El usuario autorizó expresamente integrar los pull requests en main. Se comprobó
que b06103f (PR #5) es ancestro de dbf9182 (PR #6), y que ambos son ancestros
del PR #7. El main anterior, 4d99060, también es ancestro. Un merge del PR #7
contra main conserva los tres conjuntos de commits y produce el árbol revisado
sin introducir una versión intermedia. Se utiliza merge commit, sin squash ni
force-push.

Antes de integrar se configura `git.deploymentEnabled=false` en vercel.json
para respetar el alcance sin despliegue. No se habilitan workflows de GitHub
Actions, recursos GCP, facturación ni migraciones corporativas. Las imágenes
publicadas siguen fijadas a 6fae189 y no se sustituyen durante la integración.

El check externo GitGuardian conserva sus incidencias históricas documentadas:
36747982 corresponde a la etiqueta UI Password del inventario de acciones;
37265105 corresponde al literal sintético del test de configuración PostgreSQL.
No se deshabilita el scanner ni se presenta su estado externo como PASS.

Verificación previa al merge: 108/108 pruebas de base, 127/127 React/backend,
escaneo local de secretos y preflight PASS. La primera ejecución React agotó
el límite de 5000 ms en una importación; la suite completa pasó después,
también con `npm run test --workspace=@analiza/web -- --no-file-parallelism`,
sin cambiar pruebas ni límites. La auditoría estructural de 17 capítulos y
1359 eventos pasa; no se añade una certificación de paridad funcional.
