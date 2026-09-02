# CH14 F12 · Precheck de evidencia y lista segura

F11 sigue `MISSING` con `CH14-Q010` y `CH14-Q011`. La conciliación de evidencia quedó registrada en `739e5b4b4263ec0a568de9f3021ac15924957ad8`: los frames citados para lotes no autorizan una política de vencimiento, lote, serie, FEFO, cuarentena, asignación o rechazo.

Para F12 se abrieron `CH14-E0084` y `CH14-E0089`: ambos son `Inventario: Lotes y números de serie`, no kits. La secuencia correcta de `Kit de insumos` es `CH14-E0095`, `CH14-E0100` y `CH14-E0104`, que muestra Listado, Excel, Nuevo, búsqueda, paginación, columnas `Acciones / Nombre / Actualizado por / Fecha actualización`, y el menú Editar/Duplicar/Eliminar.

React implementa únicamente esa anatomía como lista factual vacía y permission-gated. Excel, Nuevo y paginación están visibles y deshabilitados; búsqueda sólo cambia la explicación del vacío. No hay filas sintéticas, composición, consumo, descarga de existencias, CRUD ni mutación de auditoría. `CH14-Q012`, `CH14-Q013` y `CH14-Q015` siguen bloqueando versionado, permisos, exportación, composición, consumo, idempotencia, reversión y auditoría.

F12 quedó implementado y verificado en el checkpoint `43d8dadd5e16f7c5d4c60a6495a7fa2d221f2edb`: typecheck PASS; Playwright CH14 22/22 PASS en puerto 4175; CH14 16/16 y CH01–CH03 parity PASS; traceability-mirror PASS; light-mode PASS (83 archivos); audit:verify PASS (17/17). Selenium fuente es específica y permanece `PENDING_RUNTIME` porque Python no está disponible.

## CH14 F13 · Precheck de evidencia y seguridad

`CH14-E0091` fue abierto y corresponde a una tabla de lotes/números de serie, por lo que no puede respaldar composición de kits. Los frames correctos son `CH14-E0106` y `CH14-E0117`: muestran el editor visual de `KIT CURACIONES` con Nombre, Item, Cantidad, Añadir, lista de insumos y controles para quitar.

F13 permanece `MISSING`. La evidencia visual no define una composición versionada, roles autorizados, auditoría, selección o sustitución de existencias, ni la descarga atómica, idempotente y reversible de componentes. React no expone editor de composición ni mutación de stock. `CH14-Q012` y `CH14-Q013` quedan explícitos hasta recibir esas definiciones aprobadas.

La conciliación F13 quedó comprometida en `bf72a041342fd0cf0ca606f63c48af5dfdc4cb38`.

## CH14 F14 · Precheck de evidencia y seguridad

Se abrieron `CH14-E0149`–`CH14-E0152`. El menú de una fila de Acuses muestra `Nuevo`; el formulario siguiente contiene Paciente, Fecha, Hospitalización, Bodega, Item, Cantidad disponible, Cantidad a asignar, Vaciar, Plantilla y Añadir. `CH14-E0152` es sólo la transición oscurecida posterior al formulario; `safety_022` es la evidencia separada del detalle de faltantes para F15.

F14 queda `MISSING`. React conserva Acuses como superficie factual vacía y no obtiene pacientes, hospitalizaciones o datos de casos para este flujo. No se crea un acuse, no se reservan/descargan existencias y no se exponen datos de pacientes. `CH14-Q001`, `CH14-Q002`, `CH14-Q004`, `CH14-Q005` y `CH14-Q016` exigen la fuente tenant-scoped, roles, enlace paciente/hospitalización, validación de cantidades, idempotencia, auditoría y reversión aprobadas antes de cualquier formulario operativo.

## CH14 F15 · Precheck de evidencia y seguridad

Se abrió `CH14-E0152` y es sólo la transición oscurecida posterior al formulario de Acuse; no permite leer una tabla de faltantes. La evidencia real de detalle es `contact_sheets_safety/safety_022.jpg` a 00:45:28: muestra `Items faltantes disponibles`, `Bodega` y las columnas `Acuse`, `Tipo`, `Código`, `Nombre`, `Disponible`, `Requerido` y `Acuse creado`.

F15 queda `MISSING`. Esa anatomía no define fuente tenant-scoped, cálculo ni tratamiento de faltantes/cantidad insuficiente, roles, sustitución, compra, notificación, estado de `Acuse creado`, idempotencia, auditoría o reversión. La frase sobre “faltar una cotización” sólo aparece en transcripción y no prueba una relación funcional. `CH14-Q005` y `CH14-Q014` permanecen abiertos; React no calcula faltantes, no notifica, no compra, no muta existencias y no expone pacientes.

## CH14 F16 · Precheck de evidencia y ambigüedad

Se reabrió `CH14-E0152`: sólo contiene el formulario de Acuse oscurecido, sin control, estado, enlace ni notificación de cotización. La única señal relacionada es la transcripción ambigua `00:45:10.320–00:45:13.320`: “faltar una cotización”. No identifica una entidad, transición, autorización ni resultado.

F16 queda `NOT_TESTABLE` bajo `CH14-Q014`. React no incorpora acción de cotización, cambio de estado, notificación, enlace entre módulos ni mutación de inventario. Antes de cualquier conducta se requieren significado aprobado, entidad, estado, roles, autorización, auditoría e idempotencia.

## CH14 review

La reconciliación F15/F16 y sus artefactos fueron implementados en `87ff0da40d1feb43102cbf8ca967f887b333e54c`. La revisión completa conserva F01/F02/F04/F06/F09/F10/F12 como `PARTIAL`; F03/F05/F08 como no implementables con sus preguntas abiertas; F07 como `PARTIAL` bajo `CH14-Q006`; F11/F13/F14/F15 como `MISSING`; y F16 como `NOT_TESTABLE`. Se corrigió además la deriva de inventario de revisión: F01 ya no figura falsamente como `MISSING` y F07 ya no figura falsamente como `IMPLEMENTED_EXACT`.

No queda trabajo CH14 que sea seguro sin una definición aprobada: no se añadieron enlaces de cotización, acuses operativos, efectos de stock, cierres, proveedores, bodegas, lotes, kits ni datos de pacientes. El commit de esta actualización de procedencia queda pendiente porque las escrituras de `.git/index.lock` están denegadas; Selenium sigue `PENDING_RUNTIME` por falta de Python.
