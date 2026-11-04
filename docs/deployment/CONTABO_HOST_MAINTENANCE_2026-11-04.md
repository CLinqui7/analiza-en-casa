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

Pendientes de ejecución y verificación. Este documento no certifica todavía
la instalación de actualizaciones ni la recuperación de la copia externa.
