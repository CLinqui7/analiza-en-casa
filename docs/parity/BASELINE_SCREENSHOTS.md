# Capturas del baseline

Todas las capturas usan datos sintéticos y se generaron con Chrome headless local. No son evidencia de implementación exacta; documentan el punto de partida.

| Captura | Propósito |
| --- | --- |
| [Dashboard 1440×900](screenshots/baseline-dashboard-1440x900.png) | Métricas y navegación actuales antes de CH01. |
| [Pacientes 1440×900](screenshots/baseline-patients-1440x900.png) | Columnas, filtros y ausencia de tabs/paginación. |
| [Dashboard 390×844](screenshots/baseline-dashboard-390x844.png) | Baseline móvil del dashboard. |
| [Pacientes 390×844](screenshots/baseline-patients-390x844.png) | Baseline móvil del listado. |
| [Credenciales inválidas autentican](screenshots/baseline-invalid-login-authenticates-admin.png) | Evidencia de `BASE-P0-001`. |
| [Auditor con controles de escritura](screenshots/baseline-auditor-write-controls.png) | Evidencia de `BASE-P0-005`. |
| [Login standalone](screenshots/baseline-standalone-login.png) | Punto de partida del HTML autónomo. |

La reproducción exacta, resultados automatizados y límites del recorrido están documentados en `BASELINE_REPORT.md`.

## Evidencia posterior al cierre de CH01

| Captura | Propósito |
| --- | --- |
| [Dashboard y Mi usuario](screenshots/ch01-dashboard-admin-1440x900.png) | Seis métricas, tabla observada, navegación expandida, organización activa y perfil propio. |
| [Carga masiva](screenshots/ch01-patients-bulk-1440x900.png) | Pestañas, flujo CSV sintético y advertencia de datos. |
| [Auditor sólo lectura](screenshots/ch01-auditor-read-only-1440x900.png) | Configuración visible sin controles mutadores y campos no editables. |
| [Pacientes móvil](screenshots/ch01-patients-mobile-390x844.png) | Verificación a 390×844 sin desbordamiento horizontal global. |
| [Portal autónomo](screenshots/ch01-standalone-portal-1440x900.png) | OTP sintético explícito y resumen administrativo sin llamadas `/api`. |

## Evidencia posterior al cierre de CH02

| Captura | Propósito |
| --- | --- |
| [Alta de paciente 1440×900](screenshots/ch02-patient-form-1440x900.png) | Página completa con las cuatro secciones, obligatorios, consentimiento seguro y placeholders trazados. |
| [Alta de paciente 390×844](screenshots/ch02-patient-form-mobile-390x844.png) | Verificación móvil del formulario completo sin desbordamiento horizontal global. |

## Evidencia posterior al cierre de CH03

| Captura | Propósito |
| --- | --- |
| [Hospitalización 1440×900](screenshots/ch03-hospitalizations-1440x900.png) | Panel, pestañas, filtros y tabla de hospitalizaciones activas. |
| [Nueva cotización 1440×900](screenshots/ch03-new-quote-1440x900.png) | Ruta de página completa y campos iniciales observados, sin diálogo. |
| [Hospitalización 390×844](screenshots/ch03-hospitalizations-mobile-390x844.png) | Verificación móvil sin desbordamiento horizontal global. |

## Evidencia posterior al cierre de CH04

| Captura | Propósito |
| --- | --- |
| [Datos generales 1440×900](screenshots/ch04-quote-general-1440x900.png) | Paciente coherente, factura, referencias múltiples y siete categorías. |
| [Datos generales 390×844](screenshots/ch04-quote-general-mobile-390x844.png) | Verificación móvil sin desbordamiento horizontal global. |

## Evidencia posterior al cierre de CH05

| Captura | Propósito |
| --- | --- |
| [Compositor de medicamentos y ledger 1440×900](screenshots/ch05-quote-medications-1440x900.png) | Catálogo enriquecido, procesamiento, agrupación y columnas financieras completas con impuesto bloqueado. |

## Evidencia posterior al cierre de CH06

| Captura | Propósito |
| --- | --- |
| [Categorías y ledger 1440×900](screenshots/ch06-quote-categories-1440x900.png) | Insumos, Estudios Dx y Honorarios, catálogo enriquecido, agrupación y totales con reglas no confirmadas bloqueadas. |

## Evidencia posterior al cierre de CH07

| Captura | Propósito |
| --- | --- |
| [Listado y menú contextual 1440×900](screenshots/ch07-quote-row-menu-1440x900.png) | Búsqueda por paciente/documento, menú completo, submenú de impresión y acciones no confirmadas visibles pero bloqueadas. |
