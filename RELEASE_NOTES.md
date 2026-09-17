# Notas de versión

## Rediseño clínico y mejoras del equipo — 17 de septiembre de 2026

- Reporte de salud reconstruido con resumen por paciente, búsqueda, indicadores,
  navegación por secciones, signos vitales, equipo médico, línea de tiempo,
  documentos e impresión adaptable.
- Las capturas de los reportes de errores ahora se entregan desde una ruta privada,
  validada por sesión, organización y autor; el administrador puede verlas dentro
  del sistema o abrirlas en otra pestaña.
- El constructor de cotizaciones mantiene visibles todos los ítems anexados al
  cambiar de categoría y corrige el estado vacío de la tabla consolidada.
- Las categorías de cotización muestran Laboratorios, Fisioterapia e Imágenes y
  consumen catálogos administrables de Analiza Lab, Analiza Fisio y Analiza Imágenes.
- El origen del contacto dejó de ser obligatorio para guardar un borrador. Los
  borradores siguen siendo editables y las versiones enviadas permanecen inmutables.
- La ficha de cotización habilita compartir por WhatsApp cuando el paciente tiene
  teléfono y autorización; el mensaje no incluye diagnóstico ni tratamiento.
- La migración `011_service_catalogs.sql` instala los catálogos iniciales sin
  sobrescribir registros existentes.
- El menú principal incorpora un directorio de Aseguradoras con contacto, teléfonos,
  correo y notas. Las aseguradoras activas alimentan el selector de Hospitalización.
- La creación de personal admite el perfil Supervisora / jefe de enfermería, tipos
  de paciente, comentarios y un documento privado de respaldo de hasta 25 MB.
- La migración `012_insurers_and_nurse_files.sql` instala el directorio inicial de
  aseguradoras y habilita adjuntos privados para recursos de enfermería.
- Los ítems del catálogo guardan costo y precio de venta sin IVA. Cotizaciones
  precarga el precio de venta y Compras precarga y conserva el costo unitario.

Orden de publicación: ejecutar la imagen operator con `--migrate`, verificar
`/api/health` y después promover la misma imagen web. No ejecutar migraciones desde
el proceso público de Next.js.

## Entrega Docker / PostgreSQL 18 — 14 de septiembre de 2026

Fuente verificada: `6fae1890af99a7913092aea248cb120bd595e335`.

- Frontend y API Next.js en una imagen standalone, con puerto 8080 y usuario no-root.
- Persistencia Core en PostgreSQL 18, permisos por usuario/organización y RLS.
- Operator separado para migraciones y seed sintético.
- Archivos privados mediante adaptador GCS; contenido fuera de PostgreSQL.
- Imágenes exportadas con SHA256 y configuración para construir desde GitHub.

La prueba del contenedor cubre login, navegación, pacientes, médicos,
hospitalizaciones, turnos, permisos, CSRF, reinicio con persistencia externa y
fallo SQL sin falso éxito ni fallback. GCS se probó mediante SDK y emulador local.

[Artefactos y resultados](https://github.com/CLinqui7/analiza-docker/releases/tag/docker-20260914-6fae189).

## Mantenimiento del repositorio

Se organiza la documentación de entrada alrededor de la arquitectura vigente,
el desarrollo, la revisión y Docker. Se retiran launchers de preparación inicial
y notas de automatización que no son parte de la aplicación. El preflight de
repositorio se ejecuta con `npm run repo:preflight`; conserva la verificación de
estructura, secretos, tamaño de archivos y evidencia.

Este mantenimiento no sustituye las imágenes publicadas ni promueve nuevos
estados de certificación funcional.

## Límites

La entrega SQL certificada comprende el Core. Las cotizaciones y demás módulos
excluidos conservan su código histórico y no se declaran migrados.
Cloud Run, Cloud SQL e IAM real permanecen sin despliegue verificado.
Los resultados locales no certifican capacidad productiva ni reglas de negocio
pendientes.

Los reportes de fases anteriores permanecen accesibles desde
[el índice documental](docs/README.md).
