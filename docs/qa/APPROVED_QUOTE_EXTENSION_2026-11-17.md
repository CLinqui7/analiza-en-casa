# Ampliación auditada de cotizaciones aprobadas

Fuente: [confirmación literal del usuario](sources/CLIENT_APPROVED_EXTENSION_2026-11-17.txt), recibida el 17/11/2026 en El Salvador. Amplía NOV17-04 sin modificar el documento original ni eliminar las restricciones generales.

Estado: verificación técnica aprobada; listo para publicar y comprobar en la URL pública. Código probado: `05c422d5a47e724d51b9b7197d202503564813f8`, previamente subido a GitHub. No se afirma publicación de este seguimiento todavía.

## Comportamiento

Precotización incluye las cotizaciones aprobadas del paciente. Requiere un motivo y la acción explícita **Guardar ampliación**. La solicitud aporta los productos/cantidades; el servidor obtiene el precio del catálogo. El navegador no puede modificar líneas anteriores mediante este comando.

El servidor bloquea la raíz lógica, verifica la aprobación exacta mostrada y la versión vigente, y guarda una nueva versión inmutable, asignación y auditoría en una sola transacción. La decisión original mantiene actor, fecha y contenido; el estado visible sigue Aprobada. La cuenta se concilia por la misma raíz conservando pagos. El motivo y los identificadores de aprobación/solicitud quedan en el historial de la versión; el evento `QUOTE_APPROVED_SUPPLIES_EXTENDED` registra al operador y la hora.

La nueva versión hereda el ingreso existente incluso cuando la aprobación sólo había vinculado la versión inicial mediante `linkedQuoteIds`. Se conserva el ingreso original y no se modifica ningún documento clínico firmado. Si hay varios ingresos vinculados y no existe una asociación inequívoca, el servidor pide revisar los vínculos. Una aprobación histórica sin ingreso no inventa uno retrospectivamente.

Edición general, sustitución de líneas y cotizaciones rechazadas continúan bloqueadas. Las entregas anteriores se conservan por raíz/línea; los nuevos insumos aparecen pendientes en Pedidos recibidos. La ampliación y el acuse de entrega no descuentan existencias.

## Verificación

Línea base: preflight y 370 pruebas unitarias/servidor aprobados antes de modificar. Resultado final:

- 370 pruebas unitarias/servidor, TypeScript, ESLint, formato y compilación de producción aprobados.
- 30 grupos PostgreSQL en la base aislada y con rol runtime sin bypass de RLS: nueve del flujo, 15 clínicos y seis financieros. Verifican motivo, confirmación obsoleta, reintento concurrente, rechazo, organización/rol, aprobación inmutable, mismo ingreso, pagos, descuentos y entregas.
- 31 escenarios de navegador mock de CH01–CH03 y cotizaciones aprobados.
- Cuatro escenarios conectados aprobados: dependientes/documentos, Enviada/edición/modalidades, asignación/entrega/proveedores y la nueva ampliación de aprobadas en móvil y escritorio. Se comprobó la prohibición de editar/reaprobar y una entrega parcial posterior.
- Auditoría de los ledgers existentes, trazabilidad 210/210, contrato de cambios 32/32, espejo de matrices, fronteras React y escaneo de secretos aprobados. No se realizó una nueva revisión completa de los 17 videos.

La primera ejecución de la prueba nueva detectó que el ingreso sintético no incluía médico principal; se completó la fixture, conservando la validación de la aplicación. La primera regresión clínica perdió su conexión con la base aislada; se repitió tras estabilizar el entorno y los 15 grupos pasaron. No se modificaron los límites ni la autenticación de producción para ejecutar pruebas.

Evidencia: [ampliación PostgreSQL](../feedback/evidence/part1-nov17/approved-extension-postgres.json), [regresión clínica](../feedback/evidence/part1-nov17/extension-clinical-regression.json), [regresión financiera](../feedback/evidence/part1-nov17/extension-billing-regression.json), [captura móvil revisada](../feedback/evidence/part1-nov17/approved-extension-mobile.png).

Este seguimiento no añade dependencias ni DDL, no cambia reglas de cobertura y no modifica el bloqueo general `requireOpenQuote`. Se conserva la evidencia histórica; no se certifica nueva paridad EXACT de video.
