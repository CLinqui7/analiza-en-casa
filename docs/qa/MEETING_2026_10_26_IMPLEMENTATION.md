# Reunión del 26 de octubre de 2026 · implementación

Fuente: `analizaencasa26oct_.pdf`, texto íntegro por página y SHA-256 en
[`MEETING_2026_10_26_SOURCE.json`](MEETING_2026_10_26_SOURCE.json).
Las referencias P1–P3 señalan esas páginas. Esta reunión añade cambios al
registro histórico `CLIENT_CHANGE_REQUESTS.json`; no reescribe su XLSX canónico.

| Referencia y texto fuente | Interpretación y estado | Implementación y comprobación |
| --- | --- | --- |
| P1, «Reordenar las ventanas del sistema» | Menú reagrupado y renombrado. Se conserva «Pagos reportados» en Reportes por aclaración posterior del cliente. | `app-shell.tsx`, `reports/other/page.tsx`; pruebas de navegación y paridad. |
| P2, «Nacionalidad: cambiar a selector» | Selector con opciones en producción; valores históricos siguen visibles. **Hecho.** | `patient-form.ts`, `patients/page.tsx`, `searchable-select.tsx`. |
| P2, «Quitar los campos: Diagnóstico… Médico tratante secundario» | Esos campos salen del alta y edición de pacientes, conservando datos históricos. **Hecho.** | `patients/page.tsx`; esquema persistente sin pérdida. |
| P2, «Agregar los campos que se quitaron de Pacientes» y «Agregar los campos del perfil administrativo» | Se capturan por cotización, incluidos médico, diagnóstico, aseguradora y fechas. **Hecho.** | `quotes/page.tsx`, contrato y borrador. |
| P2, «Modalidad de atención pasa a llamarse Ingreso clínico» y «Hospitalización vinculada… Sin hospitalización» | Nuevas cotizaciones empiezan sin ingreso vinculado; modalidades indicadas. **Hecho.** | `quotes/page.tsx`. |
| P2, «Quitar Condición de pago y Resumen operativo», «Quitar toda la sección Datos iniciales de factura» | Retirados del formulario nuevo; los metadatos históricos permanecen legibles. **Hecho.** | `quotes/page.tsx`. |
| P2, «quitar el descuento manual» y «elegir porcentaje… seleccionar a qué categorías se aplica» | Un porcentaje por categorías seleccionadas; sin descuento manual por línea. **Hecho.** | `quotes/page.tsx`, cálculo de dominio existente. |
| P3, «Honorarios… Visita y Seguimiento… Médico… default» | Servicios limitados a esos dos; el médico principal se hereda. No se inventan tarifas. **Hecho.** | `quotes/page.tsx`. |
| P3, «Editar… Aprobada… Rechazada» | Editar abre el detalle; aprobar bloquea la versión y la incorpora a CxC; sólo hospitalización crea ingreso clínico. Rechazar exige motivo libre. Cualquier rol autenticado de la organización puede aprobar. **Hecho.** | `quotes/page.tsx`, API de decisión, migración 037, pruebas de aprobación. |
| P3, «Ingresos clínicos… quitar… $», «Quitar… Editar perfil administrativo», «Editar caso…» | Acciones y formulario ajustados; archivos privados y médicos quedan en la edición limitada. **Hecho.** | `clinical/hospitalizations/page.tsx`, `hospitalizations/[id]/page.tsx`. |
| P3, «Paciente ya cuenta con», «Enfermeras asignadas», «turno… Agenda» | Texto libre; programación en Atención con recurso, fecha y horas. El servidor confirma el turno; error parcial se comunica si falla después de guardar el caso. **Hecho con límite transaccional documentado.** | Página de atención y validación de turnos existente. |
| P3, «Agenda… mes actual… quitar Crear turno» | Calendario abre en fecha actual de El Salvador y creación directa retirada. **Hecho.** | `agenda/page.tsx`. |
| P3, «Cheque… Número de cheque», «deducible y coaseguro», «todas las cotizaciones con aseguradora» | Número obligatorio para pagos nuevos por cheque; deducible y coaseguro se capturan por cotización; CxC muestra responsabilidad declarada de aseguradora, sin inferir cobertura. **Hecho.** | `payments-page.tsx`, `quotes/page.tsx`, contrato y persistencia. |
| P3, «Cuentas por pagar… todas las órdenes» y «Compras… Vida útil… activo fijo…» | Todas las órdenes se ven al emitir. Factura recibida requiere aprobación auditada antes de sumar a CxP. Vida útil y activo fijo se capturan por ítem. **Hecho.** | `payables/page.tsx`, `purchases/page.tsx`, API de aprobación, migración 038, pruebas. |
| P3, «Visitador médico a cargo… Crear la tabla/catálogo» | Catálogo operativo de visitadores con selector en ficha del médico. **Hecho.** | `operational-catalogs.tsx`, `doctors/page.tsx`, contrato. |

## Decisiones explícitas del cliente

- Aprobación: cualquier usuario con sesión; sólo hospitalización crea ingreso clínico.
- Deducible y coaseguro: cantidades introducidas por cada cotización.
- Factura del proveedor: la orden aparece desde emisión; el saldo por pagar nace al recibir y aprobar su factura.
- Reporte de pagos reportados: Reportes → Pagos reportados.
- Costos, gastos y márgenes: el equipo proporcionará datos y reglas; no se publican cálculos supuestos.

## Límites pendientes

- Costos, gastos y márgenes necesitan fuentes y fórmulas aprobadas; la vista «Otros reportes» los señala.
- No se registra pago a proveedores ni saldo neto tras pago sin un flujo de conciliación aprobado.
- El guardado de atención y programación de turno usa dos operaciones; si la segunda falla, el caso se conserva y la interfaz informa el error. Requiere una transacción unificada antes de afirmar atomicidad.
- Las pruebas automáticas usan datos sintéticos; la aceptación con usuarios y datos reales corresponde al operador.
