# Resultados de QA de navegador y flujo integral

**Generado:** 2026-08-26T01:26:27.068299+00:00  
**Clasificación de datos:** `SYNTHETIC_DEMO`  
**Decisión:** baseline aprobado para continuar con Codex y UAT del cliente. No cargar pacientes reales todavía.

## Resumen

| Control | Resultado |
|---|---:|
| Pruebas de dominio | 9 / 9 PASS |
| Controles estáticos del proyecto | 75 / 75 PASS |
| Rutas recorridas en Chromium | 33 / 33 PASS |
| Errores de página | 0 |
| Errores de consola | 0 |
| Casos de permisos | 6 / 6 PASS |
| Desbordamiento horizontal móvil | 0 px |
| Flujo crítico paciente → caso → cotización → seguro → pago | PASS |

## Flujo crítico ejecutado

La prueba creó desde la interfaz:

1. Paciente ficticio.
2. Hospitalización.
3. Cotización con servicios y medicamentos.
4. Descuento porcentual.
5. Responsabilidad de aseguradora y paciente.

Después ejecutó, mediante las mismas funciones de dominio utilizadas por la interfaz:

- Envío simulado de cotización.
- Envío al seguro, revisión y aprobación parcial.
- Pago aplicado.
- Rechazo de referencia de pago duplicada.
- Reporte de salud, firma y corrección administrativa auditada.
- Signos vitales.
- Nota de enfermería firmada y compartida con el médico.
- Turno.
- Compra.
- Movimiento y cierre de inventario.
- Kit.
- Ítem de catálogo.
- Perfil de descuento.
- Generación y envío de estado de cuenta médico.
- Bloqueo de edición de documento firmado para el rol de enfermería.

**IDs principales del recorrido**

| Entidad | ID |
|---|---|
| Paciente | `PAT-MT9ETA1A-54AX8` |
| Hospitalización | `HOS-2026-0202` |
| Cotización | `QT-2026-0156` |
| Pago | `PAY-MT9ETBP9-9NIGI` |
| Documento clínico | `DOC-MT9ETBPD-I2SVM` |
| Cierre de inventario | `CLOSE-MT9ETBPZ-IX8FK` |

**Validaciones negativas**

| Validación | Resultado |
|---|---|
| Pago con referencia repetida bloqueado | True |
| Enfermería no puede editar documento firmado | True |
| Nota compartida por canal seguro | True |
| Cierre aprobado y bloqueado | True |
| Estado médico enviado | True |

## Cobertura de rutas

| Ruta | Encabezado verificado | Resultado |
|---|---|---|
| `#/dashboard` | Centro operativo | PASS |
| `#/pacientes` | Pacientes | PASS |
| `#/pacientes/PAT-001` | Elena Morales | PASS |
| `#/hospitalizaciones` | Hospitalizaciones | PASS |
| `#/hospitalizaciones/HOS-2026-0190` | HOS-2026-0190 | PASS |
| `#/cotizaciones` | Cotizaciones | PASS |
| `#/cotizaciones/QT-2026-0148` | QT-2026-0148 · versión 3 | PASS |
| `#/preautorizaciones` | Preautorizaciones y seguros | PASS |
| `#/cuentas-por-cobrar` | Cuentas por cobrar | PASS |
| `#/clinica` | Expediente clínico | PASS |
| `#/clinica/reportes` | Reporte de salud | PASS |
| `#/clinica/ordenes` | Orden médica | PASS |
| `#/clinica/medicamentos` | Tarjeta de medicamentos | PASS |
| `#/clinica/planes-de-cuidado` | Plan de cuidados | PASS |
| `#/clinica/evoluciones` | Evoluciones, signos vitales y notas | PASS |
| `#/agenda` | Agenda y turnos | PASS |
| `#/cuentas-por-pagar` | Cuentas por pagar | PASS |
| `#/estados-de-cuenta` | Estados de cuenta médicos | PASS |
| `#/compras` | Compras | PASS |
| `#/inventario` | Inventario | PASS |
| `#/inventario/movimientos` | Movimientos de inventario | PASS |
| `#/inventario/comprometidos` | Comprometidos y acuses | PASS |
| `#/inventario/cierres` | Cierres de inventario | PASS |
| `#/inventario/bodegas` | Bodegas y transferencias | PASS |
| `#/inventario/kits` | Kits de insumos | PASS |
| `#/catalogos` | Catálogos y tarifas | PASS |
| `#/catalogos/descuentos` | Descuentos y convenios | PASS |
| `#/medicos` | Médicos y recursos | PASS |
| `#/reportes` | Reportes | PASS |
| `#/auditoria` | Auditoría | PASS |
| `#/qa-cobertura` | QA de cobertura del video | PASS |
| `#/configuracion` | Configuración | PASS |
| `#/portal/demo-qt-2026-0148` | Hola, Elena | PASS |

## Permisos por acceso directo

El control no depende solamente de ocultar opciones del menú. También bloquea rutas directas.

| Rol | Ruta probada | Comportamiento esperado | Resultado visible | QA |
|---|---|---|---|---|
| DOCTOR | `#/cuentas-por-cobrar` | Restringido | Acceso restringido | PASS |
| NURSE | `#/compras` | Restringido | Acceso restringido | PASS |
| INVENTORY | `#/clinica` | Restringido | Acceso restringido | PASS |
| FINANCE | `#/clinica` | Restringido | Acceso restringido | PASS |
| AUDITOR | `#/auditoria` | Permitido | Auditoría | PASS |
| AUDITOR | `#/configuracion` | Permitido | Configuración | PASS |

## Responsive

| Vista | Ancho | `scrollWidth` | Resultado |
|---|---:|---:|---|
| Dashboard móvil | 390 | 390 | PASS |
| Portal móvil | 390 | 390 | PASS |

## Defectos encontrados y corregidos durante esta QA

1. Etiquetas de estado mostraban `[object Object]`.
2. El backdrop del modal podía interceptar el botón Guardar.
3. La cuadrícula del dashboard dejaba espacio vacío y comprimía turnos.
4. Los importes de subtotal, descuento y pagado podían quedar blancos sobre fondo blanco.
5. El portal heredaba el ancho angosto de una maqueta previa.
6. Los botones Guardar producían un aviso genérico duplicado.
7. Un usuario podía intentar abrir por URL una sección que no aparecía en su menú.
8. `localStorage` podía fallar en orígenes opacos usados por QA.

Todos fueron corregidos y las suites se ejecutaron nuevamente.


## API y runtime local

| Prueba | HTTP | Resultado |
|---|---:|---|
| `/` | 200 | PASS |
| `/manifest.webmanifest` | 200 | PASS |
| `/api/health` | 200 | PASS |
| `/api/runtime-config` | 200 | PASS |
| Notificación permitida | 202 | Destino enmascarado `•••• 1234` |
| Plantilla de mensaje no autorizada | 400 | Bloqueada |
| Portal con datos incompletos | 400 | Respuesta genérica anti-enumeración |
| Portal sin Supabase productivo | 503 | Modo `mock-only` explícito |

El formulario de configuración también se guardó sin errores y mostró confirmación visible. Las claves de servicio no se solicitan ni se almacenan en el navegador.

## Límite de la aprobación

La QA aprueba el repositorio como **baseline técnico y funcional**. No certifica el tratamiento de datos reales ni sustituye:

- aprobación legal y de privacidad;
- UAT con enfermería, médicos, administración, finanzas e inventario;
- formatos oficiales de impresión;
- tarifas y reglas reales;
- proveedores y credenciales de mensajería;
- configuración de Supabase y Vercel del cliente;
- pruebas de carga, recuperación y respaldo.

Consultar `docs/OPEN_GAPS.md`.
