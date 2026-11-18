# Ampliación auditada de cotizaciones aprobadas

Fuente: [confirmación literal del usuario](sources/CLIENT_APPROVED_EXTENSION_2026-11-17.txt), recibida el 17/11/2026 en El Salvador. Amplía NOV17-04 sin modificar el documento original ni eliminar las restricciones generales.

Estado: implementación realizada; comprobación PostgreSQL y navegador en curso. No se afirma publicación de este seguimiento todavía.

## Comportamiento

Precotización incluye las cotizaciones aprobadas del paciente. Requiere un motivo y la acción explícita **Guardar ampliación**. La solicitud aporta los productos/cantidades; el servidor obtiene el precio del catálogo. El navegador no puede modificar líneas anteriores mediante este comando.

El servidor bloquea la raíz lógica, verifica la aprobación exacta mostrada y la versión vigente, y guarda una nueva versión inmutable, asignación y auditoría en una sola transacción. La decisión original mantiene actor, fecha y contenido; el estado visible sigue Aprobada. La cuenta se concilia por la misma raíz conservando pagos. El motivo y los identificadores de aprobación/solicitud quedan en el historial de la versión; el evento `QUOTE_APPROVED_SUPPLIES_EXTENDED` registra al operador y la hora.

La nueva versión hereda el ingreso existente incluso cuando la aprobación sólo había vinculado la versión inicial mediante `linkedQuoteIds`. Se conserva el ingreso original y no se modifica ningún documento clínico firmado. Si hay varios ingresos vinculados y no existe una asociación inequívoca, el servidor pide revisar los vínculos. Una aprobación histórica sin ingreso no inventa uno retrospectivamente.

Edición general, sustitución de líneas y cotizaciones rechazadas continúan bloqueadas. Las entregas anteriores se conservan por raíz/línea; los nuevos insumos aparecen pendientes en Pedidos recibidos. La ampliación y el acuse de entrega no descuentan existencias.

## Verificación

Línea base: preflight y 370 pruebas unitarias/servidor aprobados antes de modificar. TypeScript, ESLint y las 370 pruebas aprobaron con el cambio. Se amplió el contrato de comandos y la integración PostgreSQL para verificar motivo, confirmación obsoleta, reintento, concurrencia, rechazo, organización/rol, aprobación inmutable, mismo ingreso, pagos, descuentos y entregas. El nuevo escenario de navegador comprueba el recorrido real en móvil y escritorio, la prohibición de editar/reaprobar y la entrega posterior.

Este seguimiento no añade dependencias ni DDL, no cambia reglas de cobertura y no modifica el bloqueo general `requireOpenQuote`. Se conserva la evidencia histórica; no se certifica nueva paridad EXACT de video.
