# Cuentas por cobrar y reporte de pagos · 27 de octubre de 2026

Solicitud directa del cliente, conservada como fuente: «en financiero, cuentas por cobrar y pagos es lo mismo Carlos, elimina pagos por favor y mejor dejalo como un reporte donde salgan todos los pagos reportados por favor, fusiona las funciones en caso de que tenganndiferentes porfa». La segunda captura muestra las dos entradas del menú financiero. Los adjuntos son evidencia del cliente y no se copian a Git.

## Decisión e implementación

- **Cuentas por cobrar** es la única pantalla operativa: cuentas, saldos, aplicación de pagos idempotente, reversión con motivo y auditoría, comprobantes PDF y estado de cuenta por paciente. Eran funciones compartidas por las dos rutas y se conservan en un solo componente.
- La entrada **Pagos** sale del menú Financiero. `/payments` conserva el enlace existente, pero ahora es un **Reporte de pagos** de sólo lectura bajo Reportes y control. Muestra todos los pagos de la organización, incluso los reversados, con paciente, cotización, fecha, monto, medio, referencia, estado y motivo. El filtro predeterminado no excluye registros; búsqueda, rango de fechas, estado y CSV son opcionales. El CSV neutraliza referencias que podrían ejecutarse como fórmulas en hojas de cálculo.
- El botón de una cotización para abrir su pago dirige a `/receivables?quote=...`; al pulsar Aplicar pago, la cuenta abierta de esa cotización se selecciona. La ayuda enlaza al reporte. Se mantienen los permisos `payments:read` y `payments:write` y la separación por organización del servidor.
- `CH08-F04` en `docs/qa/VIDEO_TO_REACT_TRACEABILITY.json` sigue `PARTIAL`: este cambio no afirma paridad exacta con la pantalla antigua del video ni cierra `CH08-Q009`. El pedido actual del cliente define la navegación nueva. No se cambian montos, reglas de cobertura ni datos históricos.

## Certificación del lote

Pruebas del reporte: `apps/web/src/lib/payment-report.test.ts` cubre inclusión de reversados, orden, fecha local, filtros y escape de CSV. La prueba de navegador `playwright:payment-idempotency-reversal-receipt` se actualizó para aplicar y reversar desde Cuentas por cobrar y consultar/exportar en Reporte de pagos. `playwright:ch03-financial-navigation` comprueba la nueva entrada. La certificación conectada del VPS se registra después de publicar un SHA verificado en GitHub; sólo se usan datos sintéticos de QA para mutaciones.

Antes de publicar: 144/144 pruebas Node, 278/278 Vitest, 76/76 controles QA, 210/210 requisitos de trazabilidad, comprobación de espejo JSON/CSV, análisis de seguridad, lint, tipos y build de Next aprobaron. La navegación CH03 y el flujo completo de pagos aprobaron en Playwright; el reporte a 390 px no tuvo desbordamiento horizontal. Se conserva `CH08-F04` como `PARTIAL` en JSON y CSV, con la solicitud posterior documentada en sus notas.
