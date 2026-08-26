# Inventario de funciones · CH03

La narración tiene ASR ruidoso. La evidencia visual sí confirma la navegación desde Pacientes, la pantalla Hospitalización, las vistas Activos/Inactivos, Cotizaciones y el inicio de Nueva cotización. No confirma reglas de transición, permisos, precios ni envío.

| ID | Clasificación | Función | Trazabilidad principal | Límite de evidencia |
|---|---|---|---|---|
| CH03-F001 | VISIBLE | Menú financiero con Hospitalización, Cuentas por cobrar y Preautorizaciones & Reclamos | CH03-E0005 · 00:04:48.200 · `event_frames/CH03-E0005_00h04m48s200ms_settled.jpg` | No prueba permisos. |
| CH03-F002 | VISIBLE | Panel Relación de pacientes por empresa y pestañas estables Activos/Cotizaciones/PIC Ejecución | CH03-E0040 · 00:05:39.200 · `detail_crops/CH03-E0040_00h05m39s200ms_DETAIL.jpg` | Badges 8/67 sin fórmula demostrada. |
| CH03-F003 | UNCERTAIN | Preadmisión aparece solo durante la carga y luego desaparece | CH03-E0036 · 00:05:37.000 · `event_frames/CH03-E0036_00h05m37s000ms_abrupt_change.jpg` | No se abre ni se explica. |
| CH03-F004 | VISIBLE | Filtros Estado Administrativo, Fecha de inicio y Tipo de cuenta con Aplicar/Limpiar | CH03-E0009 · 00:04:53.200 · `event_frames/CH03-E0009_00h04m53s200ms_stable_change.jpg` | No se ejecutan. |
| CH03-F005 | VISIBLE | Tabla de activos con acciones, identificadores, paciente, empresa, tipo, estado y duración | CH03-E0010 · 00:04:57.600 · `detail_crops/CH03-E0010_00h04m57s600ms_DETAIL.jpg` | Acciones y orden no probados. |
| CH03-F006 | VERBAL | Activo se asocia con proceso o servicios actuales | CH03-E0017 · 00:05:06.400 · `event_frames/CH03-E0017_00h05m06s400ms_abrupt_change.jpg` | ASR ruidoso; transición desconocida. |
| CH03-F007 | VISIBLE | Pacientes Inactivos con búsqueda, paginación, triage, Botmaker y estado | CH03-E0030 · 00:05:27.200 · `detail_crops/CH03-E0030_00h05m27s200ms_DETAIL.jpg` | No prueba reactivación ni consentimientos. |
| CH03-F008 | VISIBLE | Cargando y No hay registros coexisten durante una transición | CH03-E0008 · 00:04:52.600 · `event_frames/CH03-E0008_00h04m52s600ms_abrupt_change.jpg` | No equivale a resultado vacío real. |
| CH03-F009 | VISIBLE | Cotizaciones con filtros, búsqueda, paginación y + Nuevo | CH03-E0041 · 00:05:55.200 · `detail_crops/CH03-E0041_00h05m55s200ms_DETAIL.jpg` | Controles no ejecutados salvo + Nuevo. |
| CH03-F010 | VISIBLE | Seguimiento por Estado, Envío preautorización, Respuesta seguro y Envío de reclamo | CH03-E0042 · 00:05:55.800 · `detail_crops/CH03-E0042_00h05m55s800ms_DETAIL.jpg` | Máquina de estados e idempotencia desconocidas. |
| CH03-F011 | VISIBLE | Creación y Total por cotización | CH03-E0043 · 00:05:59.000 · `event_frames/CH03-E0043_00h05m59s000ms_abrupt_change.jpg` | No se infieren precios, impuestos ni reglas monetarias. |
| CH03-F012 | VISIBLE | Nueva cotización con selección de paciente y datos de contacto | CH03-E0045 · 00:06:08.600 · `event_frames/CH03-E0045_00h06m08s600ms_abrupt_change.jpg` | No se guarda ni envía. |
| CH03-F013 | VISIBLE | Datos de factura: fecha, grupo de descuento, referido, giftcard y comentarios | CH03-E0046 · 00:06:09.600 · `detail_crops/CH03-E0046_00h06m09s600ms_DETAIL.jpg` | Asteriscos visibles; reglas backend no probadas. |

La trazabilidad estructurada completa, incluido `chapter_id`, transcripción y rutas absolutas dentro del repositorio, está en `chapter_feature_inventory.json`.
