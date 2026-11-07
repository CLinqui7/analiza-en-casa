# Analiza en Casa en Contabo: entrega para el siguiente Codex

**Clínica, 7 de noviembre de 2026:** release activo `eaa4fbc55a9a0389ff90e134b186c48f0c8a498b`, subido a GitHub antes de publicar. Incorpora selección de grupos al imprimir, horarios y dilución por medicamento, administración por horario y origen/unidades configurables una vez por artículo. Corrige la identidad de aplicaciones al revisar cotizaciones y conserva versiones/compensaciones. Respaldo previo `6e59aa28`; web/PostgreSQL saludables y HTTP 200. Pasaron 363 pruebas unitarias/servidor, 15 grupos PostgreSQL aislados, ocho escenarios conectados y nueve grupos públicos sintéticos. Se retiró el entorno QA temporal. Sin DDL nuevo ni cambios de Ubuntu. La copia externa/restauración de ese snapshot no se verificó. Ver `CONTABO_CLINICAL_CHANGES_2026-11-07.md` y `../feedback/GUIA_CLINICA_2026-11-07.md`. Las entradas siguientes son históricas.

**Médicos y cotizaciones, 6 de noviembre de 2026:** release activo `ac44496b0bd05561c51ea06db978e8ebd5e19a24`, publicado primero en GitHub. Corrige búsquedas sin tildes, contacto, distinción de homónimos y nombre completo en móvil; permite lectura mínima del directorio a los roles que crean cotizaciones y valida ambos médicos por organización. Comprobación pública final: 633 médicos, los 623 del Excel disponibles en ambos selectores, tres anchos, borrador del usuario intacto y cero errores JavaScript. Conciliación posterior: los 623 perfiles conservan exactamente el plan. Diez grupos PostgreSQL aislados, 356 pruebas unitarias/servidor, 35 escenarios de navegador y 11 de seguimiento aprobados; 59 rutas públicas aprobadas antes del último ajuste sólo visual. Hay coincidencias antiguas de identidad sin resolver: no borrar ni fusionar historiales por nombre. Detalle en `../imports/DOCTOR_QUOTES_REVIEW_2026-11-06.md` y archivo privado referido allí. Respaldo previo final `1db45cbd`; web y PostgreSQL saludables, HTTP 200, sin DDL ni cambios de Ubuntu. Copia externa/restauración de ese nuevo snapshot no verificadas. Las entradas siguientes son históricas.

Para instalar **otros proyectos** en este VPS, usar también
`CODEX_MULTIPROJECT_VPS_HANDOFF.md`. Su anexo sensible permanece únicamente
en la PC del operador, fuera de Git.

Estado comprobado el 20 de octubre de 2026. Este documento sustituye el
estado de despliegue aplazado descrito en `MIGRATION_HANDOFF.md`. No contiene
contraseñas, claves privadas, cadenas de conexión ni datos identificables de
pacientes. Antes de cambiar algo, comprobar el estado actual: otros agentes
pueden estar trabajando en el mismo VPS.

## GitHub antes de cada despliegue

**Cierre del directorio, 6 de noviembre de 2026:** release activo `14ef0d19d44630661c5239b7d270bbc4bc6ea17b`, con estado actualizado de CR-032 en la pantalla de solicitudes. Se repitió la verificación WEBMASTER de 633 médicos y 623 perfiles importados/enriquecidos, sus clínicas, tres anchos y estado publicado. Respaldo posterior `b760c9e2` restaurado sin red y con 633 médicos; salud pública HTTP 200. La copia externa de ese snapshot no se ha verificado. Evidencia ampliada en `../imports/DOCTOR_DIRECTORY_IMPORT_2026-11-05.md`; la entrada siguiente describe la implementación y primera publicación del mismo lote.

**Directorio de médicos, 5–6 de noviembre de 2026:** código de aplicación `c141d4a543b930cd573e4cc40f7355581eb296c2` y operador `596108970705f2bd69eb11415181820fdd0c99ed`, publicados primero en GitHub. El Excel autorizado de 650 filas quedó en 623 perfiles: 619 altas y 4 enriquecimientos; total principal 633. Se preservan clínicas/contactos, identificadores existentes y versiones; reintento idempotente comprobado. Next.js 16.4.1 y Zod 4.6.6, auditoría de dependencias de producción sin avisos conocidos. Respaldo `bd0e0b79` restaurado sin red antes de importar; snapshot adicional `e514c44b` anterior al despliegue. API y navegador principales verificados, 59 rutas sintéticas sin errores JavaScript. Ver `../imports/DOCTOR_DIRECTORY_IMPORT_2026-11-05.md` para campos pendientes, evidencia y actualización final de metadatos. No volver a una versión anterior a `c141d4a` que descarte clínicas adicionales al editar. Los datos fuente y credenciales no están en Git.

**Mantenimiento del host, 4 de noviembre de 2026, 16:49 El Salvador:** 28 paquetes actualizados en Ubuntu 24.04.5; Docker 29.9.3 y containerd 2.4.2. Reinicio controlado completado y ambos proyectos arrancaron automáticamente. No hay servicios fallidos ni reinicios pendientes. Analiza conserva el release `81823a6933b027cde0e8b21596612f54741c89b8`; TuVet también está activo. Se reparó el respaldo de TuVet, que antes se omitía por falta del script, y se verificaron externamente los snapshots `9578e071` de Analiza y `89046091` de TuVet. Ambas tareas Windows terminaron con código 0 y tienen reintentos; requieren sesión del operador y su siguiente ejecución automática aún debe observarse. Se liberaron 1,381 GB de caché antigua conservando todas las imágenes y volúmenes. Renovación simulada de ambos certificados aprobada; revisión pública posterior de 59 rutas aprobada. SQLite sigue aplazado por phasing de Ubuntu. Ver `CONTABO_HOST_MAINTENANCE_2026-11-04.md` para versiones, interrupciones observadas, respaldos, rutas privadas y evidencia; las entradas siguientes son históricas.

**Rediseño visual, 4 de noviembre de 2026:** release activo `81823a6933b027cde0e8b21596612f54741c89b8`, previamente subido a GitHub. Tipografía local, controles, menús con teclado, formularios y QR adaptables. Revisión pública de 59 rutas con cuenta sintética, cero errores JavaScript y sin desbordamiento de página; Analítica conserva su restricción. Respaldo previo `137bbf9a`, web y PostgreSQL saludables. Ver `CONTABO_VISUAL_REFRESH_2026-11-04.md`; las entradas siguientes son históricas. No hay DDL nuevo ni actualización de Ubuntu. La copia externa del nuevo snapshot no se comprobó en este lote.

**Observaciones clínicas, 4 de noviembre de 2026:** release activo `cfc7ceb1fcc53f0e2b9cd7ac260f12f51e2bb967`, publicado después de verificar GitHub, con menú simplificado, expediente y visitas reorganizados, acciones de enfermería funcionales, planes combinados y correcciones auditadas de administración. Respaldo previo `af5a6b94`. Web y PostgreSQL saludables. Ver `CONTABO_CLINICAL_OBSERVATIONS_2026-11-04.md`; las entradas siguientes son históricas. La copia externa de este snapshot no se ha verificado en este lote.

**Facturación, 4 de noviembre de 2026:** la versión activa más reciente es `a9df5c3a93eaabcdfe0effce45ad7142c09a1848`, con saldos por cadena de cotización, reintentos de pago estables, centavos consistentes, protección de versiones, tablero de seguros adaptable y limpieza de textos internos. Respaldo previo `f5bb4f5d`; cinco grupos de prueba pública sintética aprobados y salud HTTP 200. No hay DDL nuevo ni actualización de Ubuntu. Ver `CONTABO_BILLING_RELEASE_2026-11-04.md`; la entrada clínica siguiente es histórica.

**Cierre del 4 de noviembre de 2026:** la imagen final activa es `dfee2dc0dfe22f89fedde3c74fbbd8da26ed240a`. Actualiza el registro visible de solicitudes con el resultado de producción ya comprobado. Respaldo previo `4abf8d50`; comprobación autenticada de estados, persistencia, móvil y salud aprobada. Las imágenes anteriores se conservan para reversión. El informe `CONTABO_CLINICAL_RELEASE_2026-11-04.md` distingue el último respaldo local de los snapshots ya copiados y verificados externamente.

**Primera publicación del 4 de noviembre de 2026:** imagen web `fc7e4c6206e1f4b01f6e24ad4395d88b8a816640`, con la reestructuración clínica del PDF del 31 de octubre y la migración 039. Código verificado en GitHub antes de publicar. Salud pública HTTP 200, contenedores saludables y cinco grupos de comprobación de persistencia/navegación con la organización sintética aprobados. Respaldo anterior al DDL `5e6c03c2` y respaldo de publicación `a99365ec`; se conserva la imagen anterior `5dab7a143f0a9acbf799a272bf14a1a8fa310d72`. Ver `CONTABO_CLINICAL_RELEASE_2026-11-04.md` y `../feedback/GUIA_CLINICA_2026-11-04.md`. Ejecutar `deploy-release.sh` como archivo; no canalizar el script por stdin, porque Docker puede consumir la entrada restante.

La copia externa del 4 de noviembre se recuperó tras una ejecución interrumpida: tarea terminada con código 0, 210 archivos cifrados comparados por SHA-256 y comprobación completa de restic aprobada. Manifiesto `snapshot-20261104T071131Z/copy-verification.json`; los archivos y sus claves permanecen fuera de Git.

**Estado comprobado, 30 de octubre de 2026:** imagen web `5dab7a143f0a9acbf799a272bf14a1a8fa310d72`, subida a GitHub antes de desplegar, con descuento por categorías corregido, Atención reorganizada y página propia de visitadores. La prueba conectada sintética verificó escritura/recarga de descuentos y visitadores; salud pública HTTP 200 y ambos contenedores sanos. Respaldo previo `392b3c39` con la base activa y copia externa manual verificada (182 archivos cifrados, integridad completa y tarea con código 0). Se corrigieron locks caducados de restic y se añadió preflight al respaldo antes de detener la web. Ubuntu sigue en 24.04.5 LTS; 19 actualizaciones pendientes, incluidas Docker/containerd, requieren ventana coordinada. Ver `CONTABO_UI_RELEASE_2026-10-30.md` y `../feedback/UI_REVIEW_2026-10-29.md`. La versión anterior `dfdcd98045cd806d7d85c582ba79681f1bea560c` se conserva para reversión.

**Actualización del 29 de octubre de 2026:** la imagen web sana es
`dfdcd98045cd806d7d85c582ba79681f1bea560c`, verificada en GitHub antes de
publicar. Las migraciones 037 y 038 están aplicadas a `analiza_live_20261014`;
la salud pública respondió HTTP 200 y cinco rutas privadas pasaron una prueba
de navegador de sólo lectura. El script de respaldo anterior volcaba
`analiza_en_casa`, que no es la base activa. No asumir que los snapshots
anteriores al cambio `f719f0500cc23ff5f94373c90bca980648783454` contienen
la base activa. El snapshot nuevo `e9768ef6` contiene
`active-database.dump`, `active-database.name` y su SHA-256: se comprobó el
hash y la lectura del archivo PostgreSQL directamente desde restic. El script
de despliegue ahora exige esos tres archivos antes de migrar. Ver el informe
`CONTABO_MAINTENANCE_2026-10-29.md` para el estado de la copia externa.

**Registro histórico de Finanzas, 27 de octubre de 2026 (El Salvador):** la imagen web de ese día fue `47c8a522e1007f0231d89b1789edb42c62098d5e`, subida y verificada en GitHub antes de publicar. La imagen anterior `e3de685cc566254c6a29c68b0d7c5899e7c75368` se conserva para reversión de la web. El respaldo cifrado previo `ebc6bf89` pasó, pero se descubrió después que el script anterior no volcaba la base activa; consultar la actualización del 29 de octubre. Cuentas por cobrar concentra la operación y `/payments` presenta el reporte de todos los pagos, incluidos reversados; la organización principal mostró 21/21 registros mediante prueba de sólo lectura. Ambos contenedores estaban sanos y la salud pública respondió HTTP 200. Detalle en `docs/feedback/FINANCIAL_NAVIGATION_2026-10-27.md` y `docs/deployment/CONTABO_MAINTENANCE_2026-10-27.md`.

La tarea externa cifrada de Windows, ejecutada manualmente después de publicar, terminó con código 0: 154 archivos comparados por SHA-256, `restic check --read-data` aprobado y snapshot `ebc6bf89` presente en la copia. La ejecución automática del siguiente día sigue pendiente de observación.


**Agenda y mantenimiento, 27 de octubre de 2026 (El Salvador):** la imagen web activa y sana es `e3de685cc566254c6a29c68b0d7c5899e7c75368`, subida a GitHub y verificada antes de publicar. El rol web recibió el permiso mínimo `UPDATE` sobre `analiza.shifts` para editar turnos. La cuenta sintética de QA confirmó edición HTTP 200, rechazo por colisión HTTP 400 con mensaje específico y salud HTTP 200. El despliegue creó y comprobó el snapshot cifrado `0a498f1d`. Ambos contenedores están sanos, el timer de respaldo tiene resultado satisfactorio (27 de octubre), el disco tiene 175 GiB libres y el certificado de Analiza vence el 12 de enero de 2027. El error exacto del alta en la captura del cliente no puede atribuirse retroactivamente con certeza; el cliente web ahora muestra el rechazo de validación en vez de ocultarlo. Detalle en `docs/feedback/AGENDA_SHIFT_FIX_2026-10-27.md`.

La copia externa programada del 27 de octubre terminó con código 1 al añadirse un índice restic durante la transferencia. Se recuperó el archivo faltante, se compararon los 150 archivos cifrados por SHA-256 con el VPS y la copia pasó `restic check --read-data`. Las mejoras al bloqueo del respaldo, la comprobación del snapshot antes de migrar y el reintento incremental de la copia externa están documentados en `docs/deployment/CONTABO_MAINTENANCE_2026-10-27.md`. Comprobar la siguiente ejecución automática.


El cliente exige que **todo código, migración y configuración se suba a GitHub
antes de desplegar**. Hacer commit y push a una rama `codex/*`, verificar con
`git ls-remote` que el SHA remoto coincide con el commit seleccionado y crear
el archivo de publicación desde ese commit exacto. Si el push o la
verificación del SHA falla, no ejecutar `deploy-release.sh`. Tras desplegar,
subir al mismo PR el informe de pruebas, SHA activo y estado del respaldo.
Nunca subir credenciales, secretos ni archivos privados. No fusionar a `main`
automáticamente.

**Campos de médico, 20 de octubre de 2026 (El Salvador):** la imagen web activa
y sana es `01ef03fe6865b4d6f925b66eff31a874670d807a`, subida y comprobada
en GitHub antes del despliegue. La base activa sigue siendo
`analiza_live_20261014`; este cambio no agregó migraciones porque el perfil del
médico se conserva en el JSON existente. El despliegue tomó y verificó el
snapshot cifrado `64cbffc6`; la URL pública respondió HTTP 200. Se comprobó en
la organización sintética de QA el alta sin DUI ni dirección, el teléfono fijo
obligatorio, campos opcionales, edición con versión y pantalla conectada. Los
reportes `6486d7b8` y `82aa73e0` quedaron resueltos en la organización
principal con la instrucción actualizada; no se importaron médicos antiguos.
Detalle en `docs/feedback/DOCTOR_FIELDS_2026-10-20.md`. La imagen anterior
`b1db386ada0c3435827f2454bb004ad3dbdcdd2e` se conserva para reversión
de la web; el timer de respaldo sigue activo, pero la ejecución automática
posterior al cambio todavía no está verificada.

**Estado de encuestas al cierre del 20 de octubre de 2026 (El Salvador):** la
imagen activa es `b1db386ada0c3435827f2454bb004ad3dbdcdd2e`, subida a
GitHub antes del despliegue. La migración `036_manual_survey_sharing.sql` está
aplicada en `analiza_live_20261014`; `survey_invitations` mantiene RLS
habilitado y forzado. El origen público de encuestas está configurado en el
entorno privado de la web; se comprobó que los enlaces apuntan al dominio
público y que el formulario de médico, el QR, la respuesta única y el resumen
funcionan con datos sintéticos. La salud pública respondió HTTP 200. El
snapshot cifrado más reciente es `15ee253b`; el servicio de respaldo terminó
correctamente y el timer está activo. Quedan por comprobar su próxima
ejecución automática y la tarea externa de Windows. Detalle en
`docs/feedback/MANUAL_SURVEYS_2026-10-20.md`. Conservar la imagen anterior
`128956e0b6ad7ea3a9da6578e288917ee1d76940` para reversión de la web;
la migración es aditiva y los registros no deben borrarse.

**Enlaces de encuestas, 20 de octubre de 2026:** la ruta `/api/surveys` requiere
`ANALIZA_PUBLIC_ORIGIN` en `secrets/web.env` para construir el enlace público
desde un origen HTTPS explícito. En Contabo debe apuntar al dominio público
vigente de Analiza, sin barra final obligatoria ni ruta. La aplicación rechaza
orígenes internos o inseguros y valida el origen antes de guardar cada
invitación. Al cambiar el dominio, actualizar este valor privado y recrear la
web desde una imagen ya publicada en GitHub. El formulario `/survey` no aparece
en el menú y sus enlaces o QR son de un solo uso por persona.

**Actualización de feedback, 20 de octubre de 2026 (El Salvador):** la imagen
web activa y saludable es `1c298ca39a0db4df30f2ab9b8fae99405652ef5c`,
subida y comprobada en GitHub antes del despliegue. La base activa continúa
siendo `analiza_live_20261014`. Se aplicaron las migraciones
`034_quote_decisions.sql` y `035_satisfaction_surveys.sql`; sus tablas tienen
RLS habilitado y forzado. La salud pública devolvió HTTP 200. Tras solucionar
un bloqueo restic caducado y verificar el repositorio, la copia cifrada de
`analiza-contabo-backup.service` terminó con `Result=success`; el snapshot de
esa verificación fue `44ec62e3` y el temporizador está activo. La próxima ejecución
automática del timer y la tarea externa de Windows siguen pendientes de
comprobación; esta última registró `0xC000013A` el 19 de octubre. El informe
del lote y los diez estados de feedback están en
`docs/feedback/REVIEW_2026-10-20.md`. La imagen anterior
`da68d1a9550f18009a327ac6bfe64cea8ce79714` se conserva para reversión
de la web; las migraciones son aditivas y los registros no deben borrarse.

**Actualización posterior al feedback, 14 de octubre de 2026 (El Salvador):**
la imagen web activa y saludable es
`da68d1a9550f18009a327ac6bfe64cea8ce79714`. La base activa y el entorno
del operador apuntan a `analiza_live_20261014`; la migración
`033_purchase_orders.sql` está registrada. La tabla `analiza.purchase_orders`
tiene RLS habilitado y forzado; `analiza_app` sólo tiene `SELECT/INSERT`.
El despliegue tomó y comprobó el snapshot cifrado restic `67cb480b` antes de
aplicar la migración. El reporte completo de pruebas y de los ocho reportes
está en `docs/feedback/REVIEW_2026-10-14.md`. Vercel sigue redirigiendo al
VPS. Conservar la imagen anterior `f82a4e44c0a6b1277b5bab081c973d88551b49a5`
para reversión de la web; las migraciones `032` y `033` son aditivas y no se
deben borrar borradores ni órdenes. TuVet permanece separado y no se modificó.

**Actualización previa de feedback, 14 de octubre de 2026 (El Salvador):** la
imagen web activa en ese momento era
`f82a4e44c0a6b1277b5bab081c973d88551b49a5`; la migración
`032_quote_form_drafts.sql` está aplicada en `analiza_live_20261014`. El
operador en `secrets/operator.env` apunta ahora a esa misma base activa; antes
apuntaba a `analiza_en_casa`, que ya no es la base de la web. El despliegue
generó el snapshot restic `22399516`, comprobó el repositorio y verificó salud
de la nueva web. El informe de pruebas y límites está en
`docs/feedback/REVIEW_2026-10-14.md`. Conservar la imagen previa `cd3203d`
para reversión de la web; la migración es aditiva y no se debe eliminar una
tabla que pueda contener borradores.

## Acceso y capacidad

| Recurso | Estado comprobado |
| --- | --- |
| VPS | Contabo `207.244.227.122`, instancia `vmi3659839`, Ubuntu 24.04.5, 6 vCPU AMD EPYC, 11 GiB RAM |
| Capacidad tras desplegar | `/`: 193 GiB, 41 GiB usados, **153 GiB disponibles**; aproximadamente 10 GiB RAM disponible, sin swap |
| SSH operador | `root@207.244.227.122` con clave local `C:\Temp\analiza-contabo-private\operator.key`; host key fijada en `C:\Users\carlo\.ssh\known_hosts` |
| SSH despliegues | `deploy@207.244.227.122` con clave local `C:\Users\carlo\.ssh\analiza-contabo-staging`; pertenece a `sudo`, con permisos sudo completos |
| Cuenta administradora web | Los datos de acceso y los IDs de Linqui están en el archivo privado local `C:\Temp\analiza-contabo-private\account.json`. Leerlo sólo para una prueba necesaria; nunca mostrar su campo `password` ni copiar el archivo a Git. |
| SSH TuVet | `tuvet-deploy`, UID 1002, sin sudo; su entorno es independiente de Analiza |
| Contraseñas SSH | La autenticación por contraseña está deshabilitada. Las contraseñas facilitadas en la conversación no sustituyen las claves SSH y no deben copiarse al repositorio. Para otro equipo, transferir la clave por un canal privado. |
| Red pública | UFW permite 22, 80 para desafío ACME y 443 HTTPS. PostgreSQL no escucha TCP. Nginx y Docker sólo exponen puertos internos en `127.0.0.1`. |

Ejemplo de conexión desde la PC donde está la clave:

```powershell
ssh -T -i 'C:\Temp\analiza-contabo-private\operator.key' -o BatchMode=yes -o StrictHostKeyChecking=yes root@207.244.227.122 'hostname; docker ps --format "{{.Names}} {{.Status}}"'
```

El código desplegado y sus secretos están en `/opt/analiza-contabo-staging`
(`root:root`, modo 700). La configuración vive en `compose.yaml` y `.env`; las
contraseñas SQL y de respaldo están bajo `secrets/` con acceso restringido.
Usar `docker compose config --quiet` para validar cambios sin volcar secretos.
La imagen web corre como UID 1000, con sistema de archivos de sólo lectura,
capacidades eliminadas y límites de 2 GiB/2 CPU. `analiza_migrator` aplica
migraciones; `analiza_app` es el rol web, no es superusuario, no tiene BYPASSRLS
ni DDL. Tiene conexión a la base activa; se revocó su conexión a las bases
anteriores. De 52 tablas del esquema, 46 tienen RLS habilitado y forzado; las
seis restantes son tablas globales de identidad/sesión/migración y se accede a
ellas a través de autorización del servidor.

## Aplicación, URL y bases

La URL pública temporal es
<https://analiza.207.244.227.122.sslip.io/>. Usa Nginx 1.24 y un certificado
Let's Encrypt válido hasta el 12 de enero de 2027; Certbot 5.8.0 tiene
renovación automática y `renew --dry-run` pasó. `sslip.io` sólo aporta DNS
temporal. Sustituir esta URL por un dominio propio cuando esté disponible y
actualizar el redireccionamiento de Vercel después de probar HTTPS.

`https://analiza-en-casa-demo.vercel.app/` y el alias del equipo redirigen con
HTTP 307 a la URL del VPS. El redireccionamiento se implementó como regla del
proyecto Vercel, versión `c16c96d3-3c3f-4105-b41e-0e463f675d6d`, sin
desplegar otra aplicación. El proyecto es `analiza-en-casa-demo`, ID
`prj_2DzFvo7mZwEamiMV0HD0noBLl7gx`. También se comprobó el redireccionamiento
de la URL directa de su despliegue. La base Neon anterior se conserva como
respaldo histórico; no se debe reactivar la aplicación anterior contra ella
sin plan de conciliación de escrituras.

Puertos internos: Nginx `127.0.0.1:18080`, web Docker
`127.0.0.1:18081`; PostgreSQL 18 usa un socket Unix compartido, sin puerto
público. La base activa en el contenedor
`analiza-contabo-staging-database-1` es `analiza_live_20261014`. El servicio
`analiza-contabo-staging-web-1` usa una imagen Next.js 16 de perfil `full`,
modo PostgreSQL, registro público deshabilitado y seed demo deshabilitado.
En el corte inicial, su etiqueta de código verificada era `cd3203d`; la imagen
del operador llevaba el mismo SHA. Consultar la actualización superior para
la etiqueta activa actual. El contenedor web se comprobó `healthy` tras cada
despliegue documentado.
Los archivos privados se guardan en `/opt/analiza-contabo-staging/files`, no en
Vercel ni en una URL pública.

El corte final se tomó de Neon después de activar la redirección: archivo
cifrado privado `C:\Temp\analiza-contabo-private\neon-final-cutover-20261014.aesgcm`,
SHA-256 `98587c7641fdafa4d4a07cc262997bf6d4d975a32cdd9e686c59144c4912445b`.
La restauración se verificó tabla por tabla **47/47**, con 2,658 filas antes
de agregar la cuenta y los catálogos ya existentes en Contabo. La unión sólo
insertó filas de Linqui en una transacción. Una segunda lectura de Neon después
del despliegue mantuvo 2,658 filas y los mismos resúmenes de contenido en las
47 tablas, sin nuevas escrituras observadas. La base activa
tiene 33 migraciones, 10 organizaciones (las nueve del origen y Linqui), 21
usuarios, 29 membresías, 35 pacientes, 28 cotizaciones, 18 pagos y 1,349
artículos de catálogo: 803 de origen y 546 de la importación oficial de
Linqui. Los 546 registros de importación y su lote siguen presentes. El origen
tenía cero filas en `file_metadata`, por lo que no había binarios de origen
que trasladar. Hay 34 pacientes en la organización principal, uno en otra
organización y ninguno en Linqui. Los registros no se han clasificado aún:
`patient_origin_reviews` tiene cero filas. No se ha borrado ni ocultado
ningún registro por suposiciones sobre si era de prueba.

Las 29 membresías actuales se distribuyen así: `ADMIN` 16, `NURSE` 9,
`WEBMASTER` 3 y `ANALYTICS` 1. No hay cuentas reales de los otros seis roles
en este corte; su comportamiento se probó con usuarios sintéticos. Hay seis
documentos clínicos en PostgreSQL y cero metadatos de archivos privados.

Los usuarios con acceso existente a pacientes, incluidas enfermeras, pueden
marcar **Real** o **Prueba** desde el detalle del paciente. El cambio exige
sesión y CSRF, se limita a su organización y genera historial y auditoría.
Los roles sin acceso a pacientes no reciben ese permiso. El formulario no
elimina datos ni cambia automáticamente la contabilidad.

Texto fuente de esta solicitud del cliente: «ahorita migra y haz o agrega un
nuevo formulario para que las mismas enfermeras o todosd los usuarios puedan
señalar si son pruebas o son reales». Es una solicitud posterior a la auditoría
de video, por lo que no se marcó ningún requisito de video como `EXACT` por
esta funcionalidad. Código y prueba integrada: commit `cd3203d`; el gate de
trazabilidad de video siguió aprobando 210/210 requisitos.

La base anterior `analiza_en_casa` conserva sólo el estado inicial de Linqui
y 546 catálogos; `analiza_source_quarantine` conserva una copia más antigua
del origen; `analiza_candidate_20261014` fue una prueba aislada. Ninguna de
esas tres es la base activa y `analiza_app` no puede conectarse a ellas.
No confundir la base activa con esas copias ni lanzar una migración/seed sobre
el nombre equivocado.

## Pruebas y operación

Se comprobó la respuesta pública `/api/health` 200 y `/login` 200 con TLS
válido, el inicio de sesión real de la cuenta administradora Linqui, el panel
y la página de pacientes en navegador sin errores, y el aislamiento de
pacientes de otras organizaciones. La prueba Docker/PostgreSQL con datos
sintéticos pasó para ocho sesiones, RLS entre organizaciones, CSRF, pacientes,
la clasificación auditada, cotizaciones, errores SQL y reinicios. La prueba
Ubuntu con socket Unix y almacenamiento privado pasó para importación Excel,
cotizaciones, seguros, hospitales, turnos, subida/descarga y persistencia tras
reiniciar contenedores. Los resultados de QA de la aplicación: 143/143 tests
Node, 252/252 React y 76/76 controles QA. La evidencia sintética está en
`docs/release/CONTABO_POSTGRESQL_VERIFY_20261014.json` y
`docs/release/CONTABO_UBUNTU_VERIFY_20261014.json`; ver también el PR de la rama
`codex/contabo-clean-migration`. No usar las contraseñas reales en pruebas
que escriban datos sintéticos.

Para revisar sin revelar secretos:

```bash
cd /opt/analiza-contabo-staging
docker compose ps
curl -fsS http://127.0.0.1:18081/api/health
systemctl status analiza-contabo-backup.timer --no-pager
ufw status
```

Las copias cifradas con restic están en
`/opt/analiza-contabo-staging/backups/restic`. El snapshot comprobado tras la
migración inicial fue `a6fdcfd7`; el más reciente se indica en la actualización
del 29 de octubre. Desde `e9768ef6`, incluye la base activa como
`active-database.dump` y su nombre en `active-database.name`, además de archivos privados, configuración
de despliegue, secretos cifrados dentro del repositorio restic, certificado y
configuración Nginx. El servicio `analiza-contabo-backup.service` y su timer
están activos; el servicio detiene brevemente la web durante la copia y luego
comprueba su salud. Se verificó una copia externa del repositorio cifrado en
`C:\Users\carlo\OneDrive\Analiza en Casa\respaldos-cifrados\snapshot-20261014T054915Z`
con `restic check --read-data`; no hay datos SQL en claro en OneDrive. El
trabajo programado local se llama `Analiza-Contabo-Offsite-Restic`.
La copia externa manual del 14 de octubre pasó íntegramente, pero un disparo
manual del trabajo de Windows terminó con código `0xC000013A` y dejó un
directorio `.partial`; la ejecución directa del mismo script sí pasó. Revisar
el resultado de la próxima ejecución programada antes de dar por verificada
la automatización externa posterior al corte.

Docker 29.9, Node 24.13, npm 11, Nginx, Certbot, restic, UFW y PostgreSQL 18
están instalados. El proyecto TuVet corre aparte bajo
`/opt/tuvet-staging` y `tuvet-postgres.service`, sin puerto público ni acceso
a los secretos de Analiza. En la nueva revisión del 14 de octubre (hora de El
Salvador), su base `tuvet_staging` tenía **21 tablas y datos cargados**; hay
una entrega de código y respaldos en su chroot. Aún no existe un servicio web
de TuVet habilitado ni un puerto público para la aplicación. No mover ni
reiniciar sus recursos al migrar otro proyecto. `deploy` tiene sudo completo,
por lo que cada nuevo proyecto debe
tener sus propios directorios, usuarios, red, puertos, base, secretos y copia
de seguridad. Reservar capacidad antes de instalar otra base o contenedores.

El panel visual del VPS sólo se enciende por orden SSH y se sirve en
`127.0.0.1:18090` mediante túnel; su código y guía están en
`C:\Temp\contabo-vps-monitor`. El lanzador local
`C:\Users\carlo\OneDrive\Escritorio\Abrir Panel VPS.cmd` arranca el colector
`vps-monitor.service` y la web `vps-monitor-web.service`, abre el túnel y el
navegador, y apaga ambos servicios al cerrar la sesión. Los servicios están
deshabilitados al arranque; el colector tiene un límite de ocho horas por si
la sesión local termina de forma anormal. Exporta métricas agregadas por
proyecto sin dar acceso del navegador a Docker o a datos clínicos. El panel
muestra consumo de recursos, no costos monetarios.

En la revisión del 15 de octubre se comprobó que el archivo ext4 reservado
para TuVet en `/var/lib/tuvet-guard/staging.ext4` ocupa **20 GiB** del disco
raíz, aunque sólo unos **1.4 GiB** están usados dentro. El panel ahora lo
atribuye a TuVet una sola vez. Se eliminaron exclusivamente `node_modules`
reproducibles de cinco releases antiguos de Analiza y caché Docker de más de
24 horas. Analiza quedó en unos **281 MiB** de directorio de producción y
volumen PostgreSQL; su QA aislada y las imágenes Docker se muestran aparte.
El VPS tenía unos **160 GiB libres** después de la limpieza. La aplicación
Analiza y PostgreSQL permanecieron saludables; no se modificó TuVet.

Para migrar otro proyecto en este VPS: inventariar primero `docker ps`,
`systemctl list-units --type=service`, `ss -ltnp`, `df -h /` y `free -h`;
asignar un directorio y una identidad distintos, un puerto de loopback libre,
su propia base y rol SQL restringido, y secretos con permisos mínimos. Crear
una copia cifrada y probar la restauración antes del corte; contrastar conteos
y resúmenes por tabla del origen con una base candidata inaccesible al rol web.
Probar navegador, API, base y archivos con datos sintéticos, activar HTTPS y
redirección sólo después de conservar una ruta de reversión. Añadir el nuevo
proyecto a una política de respaldo externa independiente; no reutilizar el
repositorio restic ni el usuario SQL de Analiza para TuVet u otra aplicación.

## Pendientes que no se deben presentar como verificados

La clasificación Real/Prueba requiere revisión humana; aún no sabemos cuáles
de los 35 pacientes son pruebas. La URL `sslip.io` es temporal y debe
reemplazarse por un dominio controlado por Linqui. Las notificaciones del
origen Vercel estaban en modo `mock`; no hay evidencia de un proveedor real
de correo, SMS o WhatsApp configurado en Contabo. No se ha certificado cada
flujo de los 10 roles usando cuentas reales del origen; las pruebas de roles
fueron sintéticas. Conservar Neon y las copias anteriores hasta verificar con
usuarios reales el historial funcional y decidir su retiro. Nunca copiar
contraseñas o filas identificables a Git, a una incidencia o a otro chat.
