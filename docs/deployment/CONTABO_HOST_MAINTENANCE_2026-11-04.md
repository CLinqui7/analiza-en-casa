# Mantenimiento de Contabo · 4 de noviembre de 2026

Estado inicial: Ubuntu 24.04.5 LTS, kernel 6.8.0-147-generic, sin reinicio
pendiente ni unidades fallidas. Analiza y TuVet están activos. Analiza responde
HTTP 200 en `/api/health`; TuVet redirige HTTP 302 desde `/` y su comprobador
verifica el login y `SELECT 1` en PostgreSQL. Disco: 27 GB usados, 167 GB libres;
RAM disponible: aproximadamente 10 GiB. No hay evidencia de saturación.

## Alcance y orden autorizado

1. Publicar el procedimiento antes de ejecutarlo. Refrescar índices APT y revisar
   el plan exacto. Publicar también las versiones elegidas antes de instalarlas.
2. Respaldar ambos proyectos y la configuración del host. Conservar paquetes de
   Docker anteriores y todas las imágenes de aplicación para reversión.
3. Repetir la copia cifrada externa de Analiza: la última ejecución observada
   terminó con `0xC000013A` (interrumpida). Verificar SHA-256 y lectura integral
   del repositorio copiado, sin publicar datos ni credenciales.
4. Habilitar `live-restore` mediante recarga de Docker. Comprobar que IDs, PIDs,
   imágenes y fechas de arranque de los contenedores no cambian.
5. Instalar únicamente versiones revisadas, sin eliminar paquetes, añadir
   dependencias ni cambiar de versión principal de Ubuntu. Monitorizar ambos
   servicios públicos durante la instalación. Revisar procesos que necesitan
   reinicio antes de decidir sobre cada uno.
6. Eliminar únicamente caché de construcción sin uso de más de siete días,
   conservando 8 GB. No eliminar imágenes, volúmenes, bases, respaldos o logs.
7. Revisar salud, TLS, firewall, tareas, bases y acceso de aplicación; publicar
   los resultados. No se modifica código funcional ni datos de pacientes.

El script `deploy/contabo/host-maintenance.sh` conserva evidencias y copias de
configuración en un directorio privado del servidor con permisos 0700. La fase
de actualización exige una copia externa verificada y rechaza un plan APT que
instale o retire paquetes o actualice versiones no revisadas. No ejecutar dos
fases concurrentemente. El respaldo existente de Analiza detiene brevemente
su web para obtener una copia consistente y la inicia de nuevo mediante un
trap; esa interrupción es distinta de la actualización de Docker.

Docker documenta que [live restore admite actualizaciones de parche](https://docs.docker.com/engine/daemon/live-restore/)
y puede activarse con `systemctl reload docker`. No constituye una garantía
para saltos mayores. Ubuntu documenta el [comportamiento de needrestart](https://ubuntu.com/server/docs/how-to/software/automatic-updates/);
en este procedimiento se revisan sus resultados en modo lista para controlar
los reinicios. La limpieza usa sólo [docker builder prune](https://docs.docker.com/reference/cli/docker/builder/prune/).

## Resultados

Mantenimiento completado el 4 de noviembre de 2026, aproximadamente a las
16:49 de El Salvador (22:49 UTC). Se instalaron los **28 paquetes revisados**,
sin retirar paquetes ni introducir dependencias adicionales. Ubuntu permanece
en **24.04.5 LTS**, kernel **6.8.0-147-generic**. Docker pasó de 29.9.0 a
**29.9.3**, containerd de 2.4.1 a **2.4.2** y Compose de 5.6.0 a **5.7.0**.
El plan exacto versionado incluye también actualizaciones de seguridad de APT,
PCRE2, Twisted, mspack y BIND.

Se reiniciaron los servicios compatibles y posteriormente se hizo un reinicio
controlado del VPS para renovar también los procesos de sesión y los shims de
containerd. Se verificaron previamente SSH por socket, montajes, servicios
habilitados, políticas de reinicio de Docker y copias externas. Los dos proyectos
arrancaron automáticamente. Al cierre, `needrestart` no muestra servicios,
sesiones ni kernel pendientes; `dpkg --audit` no presenta problemas y no hay
unidades systemd fallidas ni trabajos de arranque pendientes.

**Interrupciones observadas:** durante APT hubo un HTTP 502 de Analiza entre
94 sondeos, coincidente con la reconstrucción de red de Docker. Los IDs, PIDs,
imágenes y fechas de inicio de los contenedores no cambiaron durante esa fase.
Conservar los procesos mediante live restore no evitó ese corte de red breve.
Durante el reinicio posterior se observaron fallos desde las 16:45:20; TuVet
volvió a responder a las 16:45:58 y Analiza a las 16:46:06. La disponibilidad
quedó comprobada después, con sondeos hasta las 16:48:45. No se afirma que el
mantenimiento fuera sin interrupciones.

### Estado final y optimización

- Analiza: HTTP 200, web y PostgreSQL saludables. Conserva release
  `81823a6933b027cde0e8b21596612f54741c89b8` y digest
  `sha256:0ed6469c336ace9e3edf8ac99caf3c406bb66473640b5bb44fa21dc02a64059f`.
- TuVet: HTTP 302 normal desde `/`, login HTTP 200 y `SELECT 1` de PostgreSQL
  aprobados por su comprobador. Servicios web y base activos.
- Se liberaron **1,381 GB** de caché de construcción sin uso de más de siete
  días. Permanecen las **58 imágenes**, los **11 volúmenes** y los respaldos.
  Disco: **167 GB libres**; RAM disponible: aproximadamente **10 GiB**. No se
  cambiaron parámetros de base de datos sin evidencia de una limitación.
- `live-restore` persiste tras el reinicio. Nginx valida su configuración;
  UFW, protección SSH y AppArmor están activos. Los timers de salud, respaldo
  y certificados siguen habilitados.
- Solo queda `libsqlite3-0` 3.45.1-1ubuntu2.9, aplazado por el despliegue gradual
  de Ubuntu al 10 %. La versión instalada 3.45.1-1ubuntu2.8 procede del canal de
  seguridad; no se forzó la actualización gradual.
- Prueba pública con cuenta sintética después del reinicio: **59 rutas**, una
  restringida correctamente, **cero errores JavaScript** y sin desbordamiento
  de página a 1440, 768 y 390 px. Incluyó autenticación, API de workspace y
  operaciones, cotizaciones, cuentas, agenda, pacientes y módulos clínicos.
  El enlace de devoluciones no se ejerció en este lote porque esa organización
  no tenía devoluciones; su prueba visual anterior permanece documentada.

No se cambiaron código funcional, registros de negocio, esquemas de base de
datos ni permisos de aplicación. El nuevo servicio de respaldo de TuVet lee
la base mediante su administrador local existente; no modifica RLS.
Las actualizaciones APT cubren el sistema anfitrión. Las dependencias dentro
de las imágenes de Analiza y del entorno aislado de TuVet conservan sus
versiones de aplicación; requieren sus propios ciclos de revisión y publicación.

### Trazabilidad y comprobaciones

Procedimiento publicado antes de ejecutarse: `48c27df`; reparación de respaldo
y plan de paquetes: `1c1782a`; copia externa y espera de salud: `8c60b28`;
reinicios de servicios: `502e359`; controles del reinicio del host: `1cd5eb5`.
Los SHA remotos se comprobaron antes de aplicar cada fase. Se conserva el PR
#20 abierto, sin merges ni GitHub Actions.

Pasaron el preflight del repositorio, auditoría documental 17/17, sintaxis Bash,
análisis sintáctico PowerShell, validación de la unidad systemd, simulación APT
con versiones exactas y rechazo de paquetes adicionales, revisión del diff
operativo contra `origin/main`, validación de configuración Docker y Nginx,
copias externas y prueba pública de navegador. La auditoría documental valida
los registros existentes; este lote no declara una nueva revisión de todos los
vídeos ni cambia certificaciones funcionales.

Evidencia operativa detallada: directorio privado
`/var/lib/analiza-host-maintenance/2026-11-04` en el VPS. Conserva plan APT,
registro de instalación, monitor de salud, estados de contenedores y comprobación
final. La evidencia pública no contiene secretos ni datos reales de pacientes.

### Respaldos verificados antes de actualizar

| Proyecto | Snapshot nuevo | Resultado externo |
| --- | --- | --- |
| Analiza | `9578e0717bb4f5a921f07475fae03fcd63bccbab0d0928693e8402ff4d264d56` | 230 archivos cifrados, 221.006.357 bytes, SHA-256 y `restic check --read-data` aprobados; tarea Windows código 0 |
| TuVet | `890460917e9293852033e18233d0b62e2e904ecd63659b21433aaab0bb51120a` | 7 archivos cifrados, SHA-256 y `restic check --read-data` aprobados; tarea Windows código 0 |

Ambas copias están en carpetas `snapshot-20261104T223252Z` de sus respectivos
directorios de respaldo cifrado en la PC. Además, los dumps recuperados desde
restic se recorrieron completamente con `pg_restore --file=/dev/null`, sin
escribir información clínica ni restaurar sobre las bases activas. Se comprobó
la estructura del archivo, no una restauración completa de aplicaciones en un
servidor alternativo.

Se conservaron 97 MB de paquetes Docker/containerd anteriores y una copia
privada de la configuración del host. `live-restore` se activó por recarga;
IDs, imágenes, PIDs y fechas de inicio de los contenedores permanecieron iguales.
Los respaldos consistentes sí detuvieron brevemente cada web por separado.

`certbot renew --dry-run --non-interactive` aprobó las dos renovaciones simuladas:
Analiza y `staging.tuvetbi.com`. Las fechas de vencimiento vigentes siguen siendo
12 y 17 de enero de 2027 respectivamente.

Las tareas externas tienen tres reintentos, separados cinco minutos, y ya no se
interrumpen por pasar a batería. Horarios locales de Windows: Analiza 07:00,
TuVet 07:30. Los timers de respaldo del VPS y renovación TLS están habilitados.
La ejecución de Windows requiere una sesión iniciada del operador; la siguiente
ejecución automática aún debe observarse. La verificación externa cubre la PC:
no certifica que OneDrive haya terminado de sincronizar sus archivos a la nube.

## Hallazgo adicional: TuVet

La unidad anterior mostraba `Result=success`, pero `ConditionResult=no`: se
omitía porque no existía el hook `tuvet-daily-backup`. No era un respaldo válido.
Se instaló un servicio real que conserva el timer existente y toma un dump
consistente de PostgreSQL 18, roles, código, archivos y configuración en un
repositorio restic separado, cifrado con clave propia. Detiene brevemente sólo
la web de TuVet, la reinicia incluso si falla el respaldo y comprueba su salud.
No modifica permisos de base ni RLS. La clave y el repositorio permanecen fuera
de Git. La copia externa de este repositorio se verificó antes de actualizar.

Se instalaron los 28 paquetes del plan versionado
`deploy/contabo/host-packages-2026-11-04.txt`. SQLite permanece aplazado por el
despliegue gradual de Ubuntu; no se forzó. No hubo actualización de kernel.
