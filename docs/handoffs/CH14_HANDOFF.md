# CH14 F12 · Precheck de evidencia y lista segura

F11 sigue `MISSING` con `CH14-Q010` y `CH14-Q011`. La conciliación de evidencia quedó registrada en `739e5b4b4263ec0a568de9f3021ac15924957ad8`: los frames citados para lotes no autorizan una política de vencimiento, lote, serie, FEFO, cuarentena, asignación o rechazo.

Para F12 se abrieron `CH14-E0084` y `CH14-E0089`: ambos son `Inventario: Lotes y números de serie`, no kits. La secuencia correcta de `Kit de insumos` es `CH14-E0095`, `CH14-E0100` y `CH14-E0104`, que muestra Listado, Excel, Nuevo, búsqueda, paginación, columnas `Acciones / Nombre / Actualizado por / Fecha actualización`, y el menú Editar/Duplicar/Eliminar.

React implementa únicamente esa anatomía como lista factual vacía y permission-gated. Excel, Nuevo y paginación están visibles y deshabilitados; búsqueda sólo cambia la explicación del vacío. No hay filas sintéticas, composición, consumo, descarga de existencias, CRUD ni mutación de auditoría. `CH14-Q012`, `CH14-Q013` y `CH14-Q015` siguen bloqueando versionado, permisos, exportación, composición, consumo, idempotencia, reversión y auditoría.

Verificado antes del commit pendiente: typecheck PASS; Playwright CH14 22/22 PASS en puerto 4175; CH14 16/16 y CH01–CH03 parity PASS; traceability-mirror PASS; light-mode PASS (83 archivos); audit:verify PASS (17/17). Selenium fuente es específica y permanece `PENDING_RUNTIME` porque Python no está disponible.
