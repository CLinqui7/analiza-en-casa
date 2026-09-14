# Reauditoría independiente de video · 10 septiembre 2026

## Resultado ejecutivo

Se reauditaron los 17 capítulos y los 210 requisitos contra el Preview Studio identificado por el artefacto `4572c898518c9fef049451e926e57b21ed57e63b`. Tres revisores trabajaron en lotes de solo lectura (CH01–06, CH07–12 y CH13–17) y el escritor principal consolidó las correcciones.

La revisión corrigió 50 estados sobreclasificados. El estado honesto resultante es:

| Estado              | Requisitos |
| ------------------- | ---------: |
| EXACT               |         36 |
| PARTIAL             |         70 |
| MISSING             |         49 |
| BLOCKED_CLIENT      |         13 |
| BLOCKED_INTEGRATION |          3 |
| NOT_TESTABLE        |         39 |
| **Total**           |    **210** |

`audit:verify` confirma que los 17 ledgers están estructuralmente completos y `qa:video-parity` confirma la trazabilidad 210/210. Ninguno de esos gates significa, por sí solo, que una función esté implementada o probada en Preview.

## Estado por capítulo

| Capítulo | EXACT | PARTIAL | MISSING |     Bloqueado | NOT_TESTABLE |
| -------- | ----: | ------: | ------: | ------------: | -----------: |
| CH01     |     8 |       5 |       0 |             1 |            0 |
| CH02     |     7 |       6 |       0 |             2 |            1 |
| CH03     |     8 |       3 |       0 |             1 |            1 |
| CH04     |     6 |       3 |       0 |             0 |            2 |
| CH05     |     3 |       9 |       1 |             1 |            1 |
| CH06     |     1 |       7 |       0 |             0 |            2 |
| CH07     |     3 |       3 |       0 |             0 |            3 |
| CH08     |     0 |       4 |       3 | 3 integración |            2 |
| CH09     |     0 |       4 |       7 |             0 |            3 |
| CH10     |     0 |       2 |       5 |             0 |            3 |
| CH11     |     0 |       4 |       0 |             2 |            3 |
| CH12     |     0 |       1 |       5 |             1 |            1 |
| CH13     |     0 |       2 |       1 |             5 |            3 |
| CH14     |     0 |       7 |       5 |             0 |            4 |
| CH15     |     0 |       6 |       7 |             0 |            3 |
| CH16     |     0 |       1 |       6 |             0 |            2 |
| CH17     |     0 |       3 |       9 |             0 |            5 |

## Correcciones importantes

- Pacientes y Dashboard: se retiró `EXACT` cuando el rediseño movió columnas observadas, dejó métricas sin fórmula, usa catálogos sintéticos o no reejerció controles del mapa/PWA.
- Preautorizaciones: filtros y tablero básico sí progresan; PDF entregado, correo, WhatsApp y transiciones externas no están certificados.
- Cuentas por cobrar/PIC: el perfil administrativo sólo se edita en mock; históricos, configuración por rango y vista previa completa faltan.
- Clínica: los capítulos CH09 y CH10 conservan superficies seguras, pero perfiles clínicos, órdenes, tratamientos, tarjeta e historial no están implementados en React. No se inventaron reglas clínicas.
- Agenda: series y presets 6 h/8 h progresan; Puntual, tipos, frecuencia, descuento y liquidación necesitan definición o implementación.
- Cuentas por pagar: sólo existe el resumen factual; listado, edición, conceptos y reportes faltan.
- Compras/Inventario/Catálogos: el borrador mínimo no equivale al formulario completo del video. Adjuntos, proveedores, factura, líneas, caja menuda, lotes, cierres, kits, acuses, faltantes y CRUD de maestros permanecen abiertos.
- Reporte de salud: la navegación segura existe, pero rango, contenido clínico, antecedentes, alergias, signos, notas, edición e impresión detallada faltan.

## Arreglo posterior al artefacto auditado

El artefacto `4572c89` tenía un falso éxito en Compras: el formulario anunciaba guardado aunque Mongo rechazara la escritura. El candidato posterior lo corrige con un comando `purchase.create` que:

- deriva organización y rol de la sesión del servidor;
- exige permiso `purchases:write` e ítem activo de la misma organización;
- guarda sólo el borrador mínimo, sin tocar inventario ni inferir reglas fiscales;
- registra auditoría y deduplica reintentos por identificador;
- mantiene el diálogo abierto y no muestra éxito ante un `503`.

La prueba real React → API → Atlas aprobó guardado, recarga y error simulado sin fallback a `localStorage`. El bootstrap idempotente aplicó 42 índices.

## Evidencia y límites

- Regresión completa del candidato corregido: 178/178 Playwright, sin skips.
- Prueba focal adicional: 3/3 en CH13/Compras.
- Pruebas React/servidor del candidato: 99/99; prueba focal de operaciones/bootstrap: 8/8.
- Mongo real local posterior: aprobó paciente/hospitalización/cotización y ahora Compras; otra sesión autorizada lee, otra organización es denegada, CSRF es obligatorio y los archivos privados mantienen el límite de organización.
- Preview `4572c89`: 32 rutas y 7 diálogos verificados visualmente, pero `mongoInPreview:false`.
- Selenium no se reejecutó sobre Studio; su evidencia histórica no se cuenta como certificación del candidato.
- La revisión CH13–17 abrió individualmente toda imagen citada por sus 69 requisitos y las hojas de contacto; no se usa para elevar ninguna fila a `EXACT`.
- Proveedores de mensajería, correo, pagos y reglas clínicas/fiscales/tarifarias no se simulan como completos.

La matriz canónica actualizada es `docs/qa/VIDEO_TO_REACT_TRACEABILITY.json`.
