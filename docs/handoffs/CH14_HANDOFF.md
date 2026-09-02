# CH14 F10 · Bodegas: superficie factual segura

`CH14-E0071` (`00:43:33.400`) es la evidencia de `Items / Bodegas`: Activo, Registros, paginación, búsqueda y las columnas Nombre, Descripción y Fecha de creación. `CH14-E0068` permanece correctamente asociado a Proveedores.

React implementa sólo esa anatomía como una superficie vacía, ligera, de solo lectura y protegida por `inventory:read`. No consulta una fuente de bodegas ni fabrica filas. Los controles Activo, Registros y paginación están visibles pero deshabilitados con una explicación accesible; la búsqueda sólo cambia el texto del estado vacío. No hay CRUD, traslados, origen/destino, lotes/series, recepción ni mutación de auditoría.

Playwright pasó 16/16 en el puerto aislado 4175: ADMIN, INVENTORY y AUDITOR pueden abrir la superficie; DOCTOR, NURSE y FINANCE reciben denegación directa; búsqueda y recarga no mutan auditoría. Selenium contiene los mismos flujos acción→aserción y queda `PENDING_RUNTIME` porque Python no está disponible.

F10 continúa `PARTIAL` bajo `CH14-Q009`: faltan la fuente autorizada, roles operativos, identidad, CRUD, concurrencia, movimientos, transferencias, recepción, lote/serie y reversión. La SHA de verificación se mantiene pendiente hasta que Git permita crear el commit estable.
