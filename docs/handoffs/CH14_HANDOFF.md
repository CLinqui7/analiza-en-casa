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

Se abrieron `CH14-E0149`–`CH14-E0152`. El menú de una fila de Acuses muestra `Nuevo`; el formulario siguiente contiene Paciente, Fecha, Hospitalización, Bodega, Item, Cantidad disponible, Cantidad a asignar, Vaciar, Plantilla y Añadir. La transición posterior muestra un estado de faltantes, no una confirmación segura de entrega.

F14 queda `MISSING`. React conserva Acuses como superficie factual vacía y no obtiene pacientes, hospitalizaciones o datos de casos para este flujo. No se crea un acuse, no se reservan/descargan existencias y no se exponen datos de pacientes. `CH14-Q001`, `CH14-Q002`, `CH14-Q004`, `CH14-Q005` y `CH14-Q016` exigen la fuente tenant-scoped, roles, enlace paciente/hospitalización, validación de cantidades, idempotencia, auditoría y reversión aprobadas antes de cualquier formulario operativo.
