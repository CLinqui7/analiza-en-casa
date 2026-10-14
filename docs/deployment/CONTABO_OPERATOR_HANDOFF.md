# Analiza en Casa en Contabo: entrega para el siguiente Codex

Estado comprobado el 14 de octubre de 2026 (UTC). Este documento sustituye el
estado de despliegue aplazado descrito en `MIGRATION_HANDOFF.md`. No contiene
contraseñas, claves privadas, cadenas de conexión ni datos identificables de
pacientes. Antes de cambiar algo, comprobar el estado actual: otros agentes
pueden estar trabajando en el mismo VPS.

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
Su etiqueta de código verificada es `cd3203d`; la imagen del operador lleva
el mismo SHA. El contenedor web se comprobó `healthy` tras desplegarlo.
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
`/opt/analiza-contabo-staging/backups/restic`. El snapshot comprobado tras el
despliegue final es `a6fdcfd7`: incluye la base activa, archivos privados, configuración
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
a los secretos de Analiza. Su base `tuvet_staging` tenía **cero tablas de
usuario** en la revisión del 14 de octubre; no hay evidencia de que el socio
haya migrado la aplicación o sus datos. No mover ni reiniciar sus recursos al migrar otro
proyecto. `deploy` tiene sudo completo, por lo que cada nuevo proyecto debe
tener sus propios directorios, usuarios, red, puertos, base, secretos y copia
de seguridad. Reservar capacidad antes de instalar otra base o contenedores.

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
