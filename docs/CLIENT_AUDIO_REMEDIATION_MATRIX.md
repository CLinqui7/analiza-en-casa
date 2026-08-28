# Matriz de remediación CLIENT-AUDIO

La evidencia de audio es una indicación de UX, no una fuente para inventar reglas clínicas, financieras o legales. Cada implementación trabaja únicamente con datos sintéticos y deja los contratos externos configurables.

| ID | Estado | Implementación React | Regresión |
| --- | --- | --- | --- |
| CLIENT-AUDIO-001 | IMPLEMENTADO | Acordeones de barra lateral por categoría, con `aria-expanded` y subrutas. | Playwright y Selenium: navegación Clínica. |
| CLIENT-AUDIO-002 | IMPLEMENTADO | Rutas estables para reporte, acciones, evoluciones, tablero, seguros, kárdex, horas y ayuda. | Playwright: deep links Clínica e Inventario. |
| CLIENT-AUDIO-003 | IMPLEMENTADO | Centro de ayuda con enlaces determinísticos y WhatsApp sólo si existe URL pública configurada. | Selenium: no se inventa un contacto. |
| CLIENT-AUDIO-004 | IMPLEMENTADO | Formulario por tipo de documento, máscara demo configurable para DUI, errores inline y bloqueo de duplicados. | Playwright y Selenium: duplicado bloqueado. |
| CLIENT-AUDIO-005 | IMPLEMENTADO | Un único componente `Dialog` para altas y movimientos; encabezado, cuerpo, pie, escape y foco visibles. | Revisión estática y flujos browser. |
| CLIENT-AUDIO-006 | IMPLEMENTADO | Inventario de literales generado en `docs/UI_STRING_AUDIT.md`, con ubicación, frecuencia y propuesta de catálogo. | `npm run inventory:generate`. |
| CLIENT-AUDIO-007 | IMPLEMENTADO | Registro individual de signos con fecha, fuente y unidades; no interpreta los valores. | Playwright: guarda y muestra pulso individual. |
| CLIENT-AUDIO-008 | IMPLEMENTADO | Tablero de enfermería con recurso, territorio, turno, disponibilidad y capacidad. | Selenium: alta de recurso. |
| CLIENT-AUDIO-009 | IMPLEMENTADO | Reporte consolidado de horas por recurso y exportación CSV local. | Vitest cubre CSV; flujo visible en ruta. |
| CLIENT-AUDIO-010 | IMPLEMENTADO | Búsqueda normalizada por nombre, documento y aseguradora desde `packages/domain`. | Vitest: normalización y coincidencia. |
| CLIENT-AUDIO-011 | IMPLEMENTADO | Kárdex cronológico con saldo derivado y bloqueo de salidas negativas. | Vitest y Selenium: saldo negativo rechazado. |

## Pendiente de cliente

- Formatos oficiales de documentos distintos al patrón demo configurable de DUI.
- Reglas de firma, corrección, retención y captura clínica definitiva.
- Políticas de seguros, catálogo de alergias, inventario real y conexión Supabase por organización.
