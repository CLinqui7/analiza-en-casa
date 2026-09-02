# CH14 F11 · Precheck de evidencia y seguridad

F10 permanece `PARTIAL`, implementado y verificado en `12411c6194d585d74b7f20c9a2816f497cf55a46`: una anatomía vacía, ligera y de solo lectura para Bodegas. No hay fuente, filas, CRUD, traslados ni mutaciones, y Selenium sigue `PENDING_RUNTIME` porque Python no está disponible.

La evidencia heredada de F11 no es válida para Lotes/Nros de serie. Se abrieron `CH14-E0072`, `CH14-E0075`, `CH14-E0078` y `CH14-E0079`; las cuatro capturas muestran `Items / Bodegas`. E0078 sólo deja ver `Lotes / Series` como destino de menú, no el catálogo ni su contenido. Por tanto no se implementó ni certificó ningún listado, lote, serie, vencimiento, Fecha inválida, FEFO, cuarentena, asignación o rechazo.

F11 queda `MISSING` con `CH14-Q010` y `CH14-Q011`: hace falta corregir la asignación de evidencia y aprobar la política de vencimiento/Fecha inválida y el ciclo de vida, unicidad y corrección auditada de lotes/series. La conciliación documental espera su commit estable antes de una nueva SHA final.
