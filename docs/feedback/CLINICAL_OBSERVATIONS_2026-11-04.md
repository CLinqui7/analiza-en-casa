# Observaciones clínicas del 4 de noviembre

Fuente: `obserclini1_.pdf`, SHA-256 `532bc8f79dd9de60f0a0fb11f36e8ac67dbe5c328ea1e852dfd4906fd785bc70`. Tres páginas leídas y abiertas como imágenes. Texto original conservado en `docs/qa/sources/CLIENT_CLINICAL_OBSERVATIONS_2026-11-04.txt`. Las capturas con datos de producción permanecen fuera de Git.

## Alcance autorizado

1. Menú Clínico: Cotizaciones, Ingresos clínicos, Agenda, Expediente clínico y Órdenes médicas. Los accesos duplicados desaparecen de la barra; las rutas anteriores siguen disponibles y sus funciones se mantienen en Órdenes médicas.
2. Expediente: cinco tarjetas en Acciones médicas; Signos vitales disponible también allí sin duplicarlo en el expediente completo. Visitas de enfermería y turnos en tablas con nombre, fecha, hora y JVPE. Las visitas médicas permanecen separadas. Se retira Registrar atención.
3. Formularios médicos y de enfermería: se retira el filtro redundante de hospitalizaciones; el selector conserva la restricción por paciente.
4. Tarjeta: símbolo +, medicamentos cotizados y crónicos; sin campos de instrucciones ni configuración de inventario. Instrucciones históricas conservadas en vistas/impresión y versiones. Las asignaciones anteriores se preservan si siguen correspondiendo a la cotización.
5. Menús: Ver, Editar e Imprimir para los siete tipos de enfermería. Si aún no hay registros se explica cómo crearlos. Editar exige motivo y genera una nueva versión; las versiones previas permanecen consultables.
6. Planes: selección múltiple de Dieta, Cuidado de enfermería y Laboratorio. El servidor incluye Laboratorio al detectar estudios cotizados y conserva sus nombres en el registro. Registros antiguos con un solo tipo siguen legibles.
7. Administración: medicamentos y motivo arriba; hora, dosis, presentación y vía abajo. Las salidas de inventario sin asignación previa se capturan aquí explícitamente, sin convertir dosis en unidades. Las correcciones conservan el consumo sin cambios, compensan aplicaciones retiradas y descuentan nuevas aplicaciones una sola vez, con movimientos y versiones auditables. La cotización enviada no se modifica.

## Verificación

- Base inicial: preflight aprobado y 331/331 pruebas React aprobadas antes del lote.
- Revisión de evidencia acotada: `OBSERVATIONS_VIDEO_REVIEW_2026-11-04.md`. El PDF nuevo sustituye la presentación anterior de tarjeta/menú; no cambia reglas clínicas ni implica una nueva certificación EXACT de los 17 capítulos.
- Pruebas finales, SHA y publicación: pendientes de ejecución al crear este registro; se actualizarán con resultados efectivos.

## Límites de los datos

El JVPE de visitas se obtiene por identidad de usuario/recurso, nunca por coincidencia de nombre. Si no existe se muestra No registrado. Los turnos de Agenda siguen separados de visitas efectivamente registradas. No se inventan dosis, horarios, unidades ni reglas clínicas.
