# Requisitos maestros reconstruidos del video

> Generado de forma determinista desde `docs/MASTER_VIDEO_REQUIREMENTS.json`. No editar este archivo directamente.

- Capítulos: 17/17
- Eventos revisados: 1359
- Requisitos: 210
- Preguntas abiertas: 86
- Estados de gap: IMPLEMENTED_EXACT=2, IMPLEMENTED_PARTIAL=171, MISSING=0, CONFLICTS_WITH_VIDEO=0, NOT_TESTABLE=7, NEEDS_CLIENT_CONFIRMATION=30
- Prioridades: P0=2, P1=174, P2=34, P3=0

## Gaps P0 de seguridad e integridad

| ID | Módulo | Gap | Estado |
|---|---|---|---|
| SAFE-P0-001 | Portal del paciente | Verificación secundaria, expiración y anti-enumeración | IMPLEMENTED_PARTIAL |
| SAFE-P0-002 | Cotizaciones | Inmutabilidad de versiones enviadas | IMPLEMENTED_PARTIAL |
| SAFE-P0-003 | Documentos clínicos | Correcciones auditadas sin edición silenciosa de documentos firmados | IMPLEMENTED_PARTIAL |
| SAFE-P0-004 | Mensajería | Autorización organizacional e idempotencia de notificaciones | IMPLEMENTED_PARTIAL |
| SAFE-P0-005 | Supabase / acceso multi-organización | Asignación de organización confiable y funciones privilegiadas cerradas | IMPLEMENTED_PARTIAL |
| SAFE-P0-006 | Pagos e inventario | Contratos persistentes e idempotencia alineados con el esquema | IMPLEMENTED_PARTIAL |

## CH01 · Contexto inicial, acceso, dashboard y listado de pacientes

Eventos: 24/24. Requisitos: 14.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH01-F001 | Acceso mediante ruta directa al módulo de pacientes | CH01-E0002 @ 00:00:05.600 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F002 | Listado de pacientes | CH01-E0009 @ 00:00:56.200 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F003 | Columnas del catálogo de pacientes | CH01-E0012 @ 00:01:25.000 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F004 | Búsqueda y paginación de pacientes | CH01-E0013 @ 00:01:26.800 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F005 | Exportar y crear paciente | CH01-E0009 @ 00:00:56.200 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F006 | Estados de carga y vacío de tabla | CH01-E0011 @ 00:01:24.600 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F007 | Indicadores de triage, notificación y estado | CH01-E0012 @ 00:01:25.000 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F008 | Menú lateral colapsable y jerárquico | CH01-E0014 @ 00:01:28.800 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F009 | Dashboard operativo | CH01-E0018 @ 00:01:31.400 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F010 | Pacientes con valores fuera de rango | CH01-E0019 @ 00:01:32.000 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F011 | Menú de usuario y contexto organizacional | CH01-E0020 @ 00:01:38.400 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F012 | Cierre de sesión | CH01-E0022 @ 00:01:41.800 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F013 | Formulario de inicio de sesión | CH01-E0023 @ 00:01:42.400 | IMPLEMENTED_PARTIAL | P1 |
| CH01-F014 | Instalación en dispositivo aparente | CH01-E0023 @ 00:01:42.400 | IMPLEMENTED_PARTIAL | P1 |

## CH02 · Alta y edición de pacientes

Eventos: 82/82. Requisitos: 16.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH02-F001 | Ruta autenticada hasta Pacientes | CH02-E0005 @ 00:02:05.200 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F002 | Listado de pacientes con vistas y acciones | CH02-E0008 @ 00:02:07.000 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F003 | Formulario de alta por secciones | CH02-E0009 @ 00:02:17.000 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F004 | Datos personales obligatorios y opcionales | CH02-E0011 @ 00:02:17.800 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F005 | Documento y fecha de nacimiento | CH02-E0012 @ 00:02:23.400 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F006 | Selectores demográficos y organizacionales | CH02-E0024 @ 00:03:00.400 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F007 | Consentimiento visible para notificaciones Botmaker/WhatsApp | CH02-E0022 @ 00:02:57.200 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F008 | Paciente regular frente a paciente asegurado | CH02-E0031 @ 00:03:26.000 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH02-F009 | Catálogo buscable de seguros | CH02-E0032 @ 00:03:30.400 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F010 | Resultados anómalos en el catálogo de seguros | CH02-E0058 @ 00:03:46.600 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH02-F011 | Decisión de titularidad del seguro | CH02-E0062 @ 00:03:49.800 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F012 | Datos condicionales de cobertura | CH02-E0066 @ 00:04:10.000 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F013 | Contactos asociados al paciente | CH02-E0068 @ 00:04:11.000 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F014 | Dirección con importación y limpieza | CH02-E0071 @ 00:04:19.600 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F015 | Mapa embebido para ubicación geográfica | CH02-E0076 @ 00:04:35.800 | IMPLEMENTED_PARTIAL | P1 |
| CH02-F016 | Acciones Atrás y Guardar sin resultado observado | CH02-E0082 @ 00:04:39.000 | IMPLEMENTED_PARTIAL | P1 |

## CH03 · Hospitalización y navegación de preautorizaciones

Eventos: 46/46. Requisitos: 13.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH03-F001 | Menú financiero desde Pacientes | CH03-E0005 @ 00:04:48.200 | IMPLEMENTED_PARTIAL | P1 |
| CH03-F002 | Panel y pestañas de Hospitalización Administrativa | CH03-E0040 @ 00:05:39.200 | IMPLEMENTED_PARTIAL | P1 |
| CH03-F003 | Pestaña Preadmisión transitoria | CH03-E0036 @ 00:05:37.000 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH03-F004 | Filtros de hospitalizaciones activas | CH03-E0009 @ 00:04:53.200 | IMPLEMENTED_PARTIAL | P1 |
| CH03-F005 | Tabla de hospitalizaciones activas | CH03-E0010 @ 00:04:57.600 | IMPLEMENTED_PARTIAL | P1 |
| CH03-F006 | Interpretación verbal de hospitalización activa | CH03-E0017 @ 00:05:06.400 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH03-F007 | Vista de pacientes inactivos | CH03-E0030 @ 00:05:27.200 | IMPLEMENTED_PARTIAL | P1 |
| CH03-F008 | Carga y estado vacío simultáneos | CH03-E0008 @ 00:04:52.600 | IMPLEMENTED_PARTIAL | P1 |
| CH03-F009 | Filtros y alta desde Cotizaciones | CH03-E0041 @ 00:05:55.200 | IMPLEMENTED_PARTIAL | P1 |
| CH03-F010 | Seguimiento de cotización, preautorización, seguro y reclamo | CH03-E0042 @ 00:05:55.800 | IMPLEMENTED_PARTIAL | P1 |
| CH03-F011 | Fecha de creación y total por cotización | CH03-E0043 @ 00:05:59.000 | IMPLEMENTED_PARTIAL | P1 |
| CH03-F012 | Nueva cotización y datos del paciente | CH03-E0045 @ 00:06:08.600 | IMPLEMENTED_PARTIAL | P1 |
| CH03-F013 | Datos iniciales de factura | CH03-E0046 @ 00:06:09.600 | IMPLEMENTED_PARTIAL | P1 |

## CH04 · Cotización: datos generales

Eventos: 35/35. Requisitos: 11.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH04-F001 | Nueva cotización por secciones | CH04-E0006 @ 00:06:27.600 | IMPLEMENTED_PARTIAL | P1 |
| CH04-F002 | Selector buscable de paciente | CH04-E0002 @ 00:06:18.200 | IMPLEMENTED_PARTIAL | P1 |
| CH04-F003 | Resultados de paciente con etiquetas de cotización | CH04-E0003 @ 00:06:18.800 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH04-F004 | Autocompletado de datos del paciente | CH04-E0005 @ 00:06:21.800 | IMPLEMENTED_PARTIAL | P1 |
| CH04-F005 | Fecha requerida con calendario | CH04-E0007 @ 00:06:30.600 | IMPLEMENTED_PARTIAL | P1 |
| CH04-F006 | Grupo de descuento obligatorio | CH04-E0008 @ 00:06:33.000 | IMPLEMENTED_PARTIAL | P1 |
| CH04-F007 | Referido por como multiselección buscable | CH04-E0032 @ 00:06:59.600 | IMPLEMENTED_PARTIAL | P1 |
| CH04-F008 | Catálogo heterogéneo de referidos | CH04-E0014 @ 00:06:42.000 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH04-F009 | Acción auxiliar para Referido por | CH04-E0009 @ 00:06:34.800 | IMPLEMENTED_PARTIAL | P1 |
| CH04-F010 | Giftcard y Comentarios | CH04-E0034 @ 00:07:01.000 | IMPLEMENTED_PARTIAL | P1 |
| CH04-F011 | Categorías de ítems y filtro de inventario | CH04-E0035 @ 00:07:01.600 | IMPLEMENTED_PARTIAL | P1 |

## CH05 · Cotización: servicios, estudios y medicamentos

Eventos: 87/87. Requisitos: 15.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH05-F001 | Categorías de conceptos en Nueva cotización | CH05-E0001 @ 00:07:32.200 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F002 | Socio de negocios selecciona catálogo de precios | CH05-E0003 @ 00:07:49.400 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F003 | Bloqueo visual Procesando durante cargas y adiciones | CH05-E0021 @ 00:08:14.600 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F004 | Catálogo de Servicios con búsqueda incremental | CH05-E0025 @ 00:08:27.200 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F005 | Selección de servicio autocompleta precio | CH05-E0050 @ 00:09:16.200 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F006 | Cantidad requerida y acción Añadir | CH05-E0052 @ 00:09:30.400 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F007 | Ledger de conceptos agrupado por tipo | CH05-E0054 @ 00:09:31.400 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F008 | Resumen de subtotal, descuentos, impuesto y total | CH05-E0067 @ 00:09:56.400 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F009 | Múltiples líneas de Servicios | CH05-E0065 @ 00:09:50.400 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F010 | Compositor específico de Medicamentos | CH05-E0071 @ 00:10:42.400 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F011 | Catálogo de medicamentos muestra conteos entre paréntesis | CH05-E0075 @ 00:10:46.800 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F012 | Estado sin resultados en búsqueda | CH05-E0077 @ 00:10:48.800 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F013 | Selección de medicamento autocompleta precio | CH05-E0079 @ 00:10:54.800; CH05-E0087 @ 00:11:11.000 | IMPLEMENTED_PARTIAL | P1 |
| CH05-F014 | Intento de añadir Invanz restablece el compositor | CH05-E0080 @ 00:11:04.400 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH05-F015 | Filtro de inventario y acciones finales visibles | CH05-E0067 @ 00:09:56.400 | IMPLEMENTED_PARTIAL | P1 |

## CH06 · Cotización: insumos, equipos, honorarios, extras y totales

Eventos: 115/115. Requisitos: 10.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH06-F01 | Categorías de ítems de cotización | CH06-E0007 @ 00:11:34.600 | IMPLEMENTED_PARTIAL | P1 |
| CH06-F02 | Catálogo por socio de negocios | CH06-E0053 @ 00:12:34.800 | IMPLEMENTED_PARTIAL | P1 |
| CH06-F03 | Selección de insumos con existencia | CH06-E0025 @ 00:11:58.200; CH06-E0030 @ 00:12:02.000 | IMPLEMENTED_PARTIAL | P1 |
| CH06-F04 | Selección de estudios diagnósticos | CH06-E0060 @ 00:12:43.000 | IMPLEMENTED_PARTIAL | P1 |
| CH06-F05 | Honorarios por profesional o servicio | CH06-E0083 @ 00:13:15.800 | IMPLEMENTED_PARTIAL | P1 |
| CH06-F06 | Tabla agrupada y cálculo por renglón | CH06-E0069 @ 00:12:57.800 | IMPLEMENTED_PARTIAL | P1 |
| CH06-F07 | Descuentos, impuesto y totales | CH06-E0109 @ 00:14:14.200; CH06-E0115 @ 00:14:24.200 | IMPLEMENTED_PARTIAL | P1 |
| CH06-F08 | Autocompletado por paciente | CH06-E0103 @ 00:14:06.400 | IMPLEMENTED_PARTIAL | P1 |
| CH06-F09 | Persistencia y retroceso | CH06-E0115 @ 00:14:24.200 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH06-F10 | Contenido de Equipos y Extras | CH06-E0085 @ 00:13:50.600 | NEEDS_CLIENT_CONFIRMATION | P2 |

## CH07 · Preautorización, seguro y reclamo

Eventos: 18/18. Requisitos: 9.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH07-F01 | Listado de cotizaciones de hospitalización | CH07-E0013 @ 00:15:48.600 | IMPLEMENTED_PARTIAL | P1 |
| CH07-F02 | Estados de cotización, preautorización y reclamo | CH07-E0007 @ 00:14:33.000 | IMPLEMENTED_PARTIAL | P1 |
| CH07-F03 | Búsqueda de cotización | CH07-E0008 @ 00:14:44.400 | IMPLEMENTED_PARTIAL | P1 |
| CH07-F04 | Menú contextual y documentos | CH07-E0010 @ 00:14:49.600 | IMPLEMENTED_PARTIAL | P1 |
| CH07-F05 | Envío por correo o WhatsApp | CH07-E0014 @ 00:16:02.600 | IMPLEMENTED_PARTIAL | P1 |
| CH07-F06 | Generación y envío directo de PDF | CH07-E0014 @ 00:16:02.600 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH07-F07 | Transiciones de estado | CH07-E0018 @ 00:16:08.200 | IMPLEMENTED_PARTIAL | P1 |
| CH07-F08 | Cotización guardada pero no activada | CH07-E0007 @ 00:14:33.000 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH07-F09 | Resultado de una transición de estado | CH07-E0018 @ 00:16:08.200 | NEEDS_CLIENT_CONFIRMATION | P2 |

## CH08 · Perfil administrativo, cuentas por cobrar y pagos

Eventos: 95/95. Requisitos: 12.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH08-F01 | Perfil administrativo de ejecución | CH08-E0002 @ 00:16:16.400 | IMPLEMENTED_PARTIAL | P1 |
| CH08-F02 | Campos administrativos y de aseguradora | CH08-E0010 @ 00:16:25.600 | IMPLEMENTED_PARTIAL | P1 |
| CH08-F03 | Guardado del perfil administrativo | CH08-E0021 @ 00:16:46.200 | IMPLEMENTED_PARTIAL | P1 |
| CH08-F04 | Listado de cuentas por cobrar y exportaciones | CH08-E0037 @ 00:17:08.800 | IMPLEMENTED_PARTIAL | P1 |
| CH08-F05 | Acciones de una cuenta | CH08-E0041 @ 00:17:33.600 | IMPLEMENTED_PARTIAL | P1 |
| CH08-F06 | Histórico de estados de cuenta | CH08-E0044 @ 00:17:41.600 | IMPLEMENTED_PARTIAL | P1 |
| CH08-F07 | Pagos de hospitalización | CH08-E0049 @ 00:17:51.800; CH08-E0056 @ 00:18:06.200 | IMPLEMENTED_PARTIAL | P1 |
| CH08-F08 | Configuración de estado de cuenta | CH08-E0068 @ 00:19:00.400 | IMPLEMENTED_PARTIAL | P1 |
| CH08-F09 | Vista previa de cuenta del paciente | CH08-E0075 @ 00:19:26.800; CH08-E0083 @ 00:19:34.200 | IMPLEMENTED_PARTIAL | P1 |
| CH08-F10 | Resumen de pago | CH08-E0087 @ 00:19:52.000 | IMPLEMENTED_PARTIAL | P1 |
| CH08-F11 | Interpretación de total pendiente negativo | CH08-E0087 @ 00:19:52.000 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH08-F12 | Estado de cuenta automático | CH08-E0095 @ 00:20:59.600 | NEEDS_CLIENT_CONFIRMATION | P2 |

## CH09 · Hospitalización clínica y reporte de salud

Eventos: 137/137. Requisitos: 14.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH09-F01 | Listado de Hospitalización Clínica | CH09-E0009 @ 00:21:12.200 | IMPLEMENTED_PARTIAL | P1 |
| CH09-F02 | Acciones de una hospitalización clínica | CH09-E0016 @ 00:21:34.800 | IMPLEMENTED_PARTIAL | P1 |
| CH09-F03 | Versiones de perfiles clínicos por hospitalización | CH09-E0019 @ 00:21:43.000 | IMPLEMENTED_PARTIAL | P1 |
| CH09-F04 | Formulario de perfil clínico | CH09-E0024 @ 00:21:47.600; CH09-E0040 @ 00:22:18.200 | IMPLEMENTED_PARTIAL | P1 |
| CH09-F05 | Catálogo codificado de diagnósticos | CH09-E0030 @ 00:22:01.400 | IMPLEMENTED_PARTIAL | P1 |
| CH09-F06 | Grupos operativos del perfil | CH09-E0046 @ 00:22:25.600 | IMPLEMENTED_PARTIAL | P1 |
| CH09-F07 | Dispositivos y planificación de turnos | CH09-E0055 @ 00:22:33.800; CH09-E0058 @ 00:22:35.200 | IMPLEMENTED_PARTIAL | P1 |
| CH09-F08 | Listado de Reporte de salud y menú clínico | CH09-E0073 @ 00:22:56.200; CH09-E0076 @ 00:23:01.600 | IMPLEMENTED_PARTIAL | P1 |
| CH09-F09 | Reporte longitudinal por pestañas | CH09-E0089 @ 00:23:34.800 | IMPLEMENTED_PARTIAL | P1 |
| CH09-F10 | Cambio de rango del reporte | CH09-E0083 @ 00:23:16.200 | IMPLEMENTED_PARTIAL | P1 |
| CH09-F11 | Configuración de secciones para impresión | CH09-E0115 @ 00:24:10.000; CH09-E0126 @ 00:24:26.200 | IMPLEMENTED_PARTIAL | P1 |
| CH09-F12 | Resultado de Imprimir no demostrado | CH09-E0127 @ 00:24:28.000 | NOT_TESTABLE | P2 |
| CH09-F13 | Intervalo visual discontinuo antes de repetir la confirmación | CH09-E0129 @ 00:24:47.200; CH09-E0130 @ 00:27:13.800 | NOT_TESTABLE | P2 |
| CH09-F14 | Contenido del expediente impreso descrito verbalmente | CH09-E0129 @ 00:24:47.200 | NEEDS_CLIENT_CONFIRMATION | P2 |

## CH10 · Orden médica, tratamientos y tarjeta de medicamentos

Eventos: 114/114. Requisitos: 10.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH10-F01 | Listado de pacientes de Orden Médica | CH10-E0008 @ 00:27:37.600; CH10-E0009 @ 00:27:42.200 | IMPLEMENTED_PARTIAL | P1 |
| CH10-F02 | Elección de tipo de documento | CH10-E0011 @ 00:27:43.800 | IMPLEMENTED_EXACT | P1 |
| CH10-F03 | Encabezado y tratamientos de tarjeta | CH10-E0013 @ 00:27:55.600 | IMPLEMENTED_EXACT | P1 |
| CH10-F04 | Editor detallado de tratamiento | CH10-E0020 @ 00:27:59.800; CH10-E0050 @ 00:29:08.800 | IMPLEMENTED_PARTIAL | P0 |
| CH10-F05 | Catálogos visibles de pauta y horarios | CH10-E0021 @ 00:28:00.400; CH10-E0028 @ 00:28:14.000; CH10-E0031 @ 00:28:22.800; CH10-E0034 @ 00:28:26.200; CH10-E0042 @ 00:28:42.400 | NEEDS_CLIENT_CONFIRMATION | P1 |
| CH10-F06 | Derivación aparente de fecha final | CH10-E0035 @ 00:28:27.200 | NEEDS_CLIENT_CONFIRMATION | P0 |
| CH10-F07 | Composición de orden por etiquetas | CH10-E0072 @ 00:29:30.800; CH10-E0073 @ 00:29:31.400; CH10-E0091 @ 00:29:52.400 | IMPLEMENTED_PARTIAL | P1 |
| CH10-F08 | Consulta de órdenes, tarjetas e historial | CH10-E0109 @ 00:30:13.200 | IMPLEMENTED_PARTIAL | P1 |
| CH10-F09 | Impresiones de tarjeta de medicamentos | CH10-E0109 @ 00:30:13.200 | NEEDS_CLIENT_CONFIRMATION | P1 |
| CH10-F10 | Permisos y corrección clínica | CH10-E0112 @ 00:31:12.200 | NOT_TESTABLE | P2 |

## CH11 · Agenda y turnos

Eventos: 71/71. Requisitos: 9.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH11-F01 | Agenda filtrable por paciente | CH11-E0010 @ 00:31:50.200; CH11-E0015 @ 00:31:55.600 | IMPLEMENTED_PARTIAL | P1 |
| CH11-F02 | Navegación y vistas de calendario | CH11-E0010 @ 00:31:50.200 | IMPLEMENTED_PARTIAL | P1 |
| CH11-F03 | Formulario de creación de visita | CH11-E0022 @ 00:32:03.600; CH11-E0023 @ 00:32:08.400 | IMPLEMENTED_PARTIAL | P1 |
| CH11-F04 | Clasificación puntual o turno | CH11-E0026 @ 00:32:28.600; CH11-E0027 @ 00:32:29.200 | IMPLEMENTED_PARTIAL | P1 |
| CH11-F05 | Catálogo de tipos de visita | CH11-E0040 @ 00:32:44.200 | IMPLEMENTED_PARTIAL | P1 |
| CH11-F06 | Detalle de visita finalizada | CH11-E0050 @ 00:32:51.800 | IMPLEMENTED_PARTIAL | P1 |
| CH11-F07 | Tipo de atención en liquidación | CH11-E0060 @ 00:33:10.600 | IMPLEMENTED_PARTIAL | P1 |
| CH11-F08 | Ajustes al pago de servicio profesional | CH11-E0055 @ 00:33:00.600; CH11-E0060 @ 00:33:10.600 | IMPLEMENTED_PARTIAL | P1 |
| CH11-F09 | Reglas de liquidación y permisos | CH11-E0055 @ 00:33:00.600 | NEEDS_CLIENT_CONFIRMATION | P2 |

## CH12 · Cuentas por pagar y pagos de servicios

Eventos: 51/51. Requisitos: 8.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH12-F01 | Resumen de cuentas por pagar | CH12-E0004 @ 00:33:30.600 | IMPLEMENTED_PARTIAL | P1 |
| CH12-F02 | Listado de pagos de servicios | CH12-E0016 @ 00:34:17.000 | IMPLEMENTED_PARTIAL | P1 |
| CH12-F03 | Acciones de pagos y reportes | CH12-E0016 @ 00:34:17.000 | IMPLEMENTED_PARTIAL | P1 |
| CH12-F04 | Filtro de pagos | CH12-E0010 @ 00:34:02.200 | IMPLEMENTED_PARTIAL | P1 |
| CH12-F05 | Edición de pago de servicio profesional | CH12-E0022 @ 00:34:42.800; CH12-E0024 @ 00:34:44.600 | IMPLEMENTED_PARTIAL | P1 |
| CH12-F06 | Conceptos de adición o descuento | CH12-E0025 @ 00:34:47.600; CH12-E0027 @ 00:34:49.800 | IMPLEMENTED_PARTIAL | P1 |
| CH12-F07 | Catálogo visible de motivos | CH12-E0029 @ 00:34:55.800; CH12-E0034 @ 00:35:02.000; CH12-E0040 @ 00:35:07.600 | IMPLEMENTED_PARTIAL | P1 |
| CH12-F08 | Reglas financieras de montos y aprobación | CH12-E0022 @ 00:34:42.800 | NEEDS_CLIENT_CONFIRMATION | P2 |

## CH13 · Compras y compras al por mayor

Eventos: 92/92. Requisitos: 11.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH13-F01 | Listado de compras | CH13-E0004 @ 00:36:46.400 | IMPLEMENTED_PARTIAL | P1 |
| CH13-F02 | Estados visibles de compra | CH13-E0004 @ 00:36:46.400 | IMPLEMENTED_PARTIAL | P1 |
| CH13-F03 | Elección de modalidad de compra | CH13-E0006 @ 00:36:50.400; CH13-E0035 @ 00:37:37.800 | IMPLEMENTED_PARTIAL | P1 |
| CH13-F04 | Formulario de orden de compra | CH13-E0007 @ 00:36:54.400 | IMPLEMENTED_PARTIAL | P1 |
| CH13-F05 | Tabla de ítems de orden | CH13-E0027 @ 00:37:23.000; CH13-E0029 @ 00:37:24.000 | IMPLEMENTED_PARTIAL | P1 |
| CH13-F06 | Formulario de compra por caja chica | CH13-E0052 @ 00:38:22.400 | IMPLEMENTED_PARTIAL | P1 |
| CH13-F07 | Desglose de totales de caja chica | CH13-E0065 @ 00:38:52.400; CH13-E0069 @ 00:38:58.600 | IMPLEMENTED_PARTIAL | P1 |
| CH13-F08 | Detalle de compra y adjuntos | CH13-E0083 @ 00:39:33.000; CH13-E0084 @ 00:39:33.400 | IMPLEMENTED_PARTIAL | P1 |
| CH13-F09 | Acciones sobre compra | CH13-E0091 @ 00:39:40.800 | IMPLEMENTED_PARTIAL | P1 |
| CH13-F10 | Relación de compras con inventario | CH13-E0092 @ 00:39:43.000 | NOT_TESTABLE | P2 |
| CH13-F11 | Reglas fiscales, de anulación y autorización | CH13-E0092 @ 00:39:43.000 | NEEDS_CLIENT_CONFIRMATION | P2 |

## CH14 · Inventario, movimientos, acuses, cierres, bodegas y kits

Eventos: 152/152. Requisitos: 16.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH14-F01 | Existencias disponibles, comprometidas y totales | CH14-E0006 @ 00:40:05.400 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F02 | Historial de movimientos por item | CH14-E0016 @ 00:40:37.800; CH14-E0018 @ 00:40:39.000 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F03 | Inventario comprometido como estado temporal | CH14-E0018 @ 00:40:39.000 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH14-F04 | Panel de acuses por pacientes y recursos | CH14-E0029 @ 00:40:51.600 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F05 | Gestión y exportación de acuses | CH14-E0032 @ 00:40:53.200; CH14-E0035 @ 00:41:00.800 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F06 | Cierres pendientes, totales y cerrados | CH14-E0041 @ 00:41:38.600 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F07 | Advertencia de cierre ya abierto | CH14-E0046 @ 00:41:47.400 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F08 | Aprobación de cierre total | CH14-E0050 @ 00:42:16.400 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F09 | Catálogo de proveedores | CH14-E0061 @ 00:43:24.400 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F10 | Catálogo de bodegas y traslados | CH14-E0068 @ 00:43:28.600 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F11 | Lotes, números de serie y vencimiento | CH14-E0075 @ 00:43:37.200 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F12 | Catálogo de kits de insumos | CH14-E0084 @ 00:44:13.600; CH14-E0089 @ 00:44:23.000 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F13 | Composición cuantificada del kit | CH14-E0091 @ 00:44:23.800; CH14-E0117 @ 00:44:44.800 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F14 | Creación de acuse para hospitalización | CH14-E0151 @ 00:45:27.000 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F15 | Detección de items faltantes | CH14-E0152 @ 00:45:27.400 | IMPLEMENTED_PARTIAL | P1 |
| CH14-F16 | Vínculo de faltantes con cotización | CH14-E0152 @ 00:45:27.400 | NEEDS_CLIENT_CONFIRMATION | P2 |

## CH15 · Acuse de inventario y catálogos de ítems

Eventos: 148/148. Requisitos: 16.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH15-F01 | Reconciliación de items faltantes | CH15-E0003 @ 00:45:29.400; CH15-E0009 @ 00:45:32.200 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F02 | Solicitudes desde la casa del paciente | CH15-E0013 @ 00:45:35.200; CH15-E0017 @ 00:45:38.200 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F03 | Alta manual de items en un acuse | CH15-E0020 @ 00:45:45.000 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F04 | Carga de acuse desde plantilla o cotización | CH15-E0023 @ 00:45:48.400; CH15-E0032 @ 00:45:57.400 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F05 | Estados seleccionables de cotización | CH15-E0029 @ 00:45:54.400 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH15-F06 | Catálogo y alta de medicamentos | CH15-E0046 @ 00:46:24.600; CH15-E0047 @ 00:46:28.400 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F07 | Advertencia por cambios no guardados | CH15-E0052 @ 00:46:35.800; CH15-E0071 @ 00:47:09.600; CH15-E0114 @ 00:48:57.200 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F08 | Catálogo y alta de insumos | CH15-E0067 @ 00:46:48.400; CH15-E0068 @ 00:46:51.600 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F09 | Catálogo de estudios diagnósticos | CH15-E0084 @ 00:47:20.600 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F10 | Catálogo y alta de honorarios | CH15-E0094 @ 00:47:31.600; CH15-E0097 @ 00:47:42.000 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F11 | Confirmación de guardado de honorario | CH15-E0100 @ 00:48:10.400; CH15-E0101 @ 00:48:11.000 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F12 | Acciones y edición de honorarios | CH15-E0110 @ 00:48:27.800; CH15-E0113 @ 00:48:56.600 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F13 | Catálogo de servicios | CH15-E0122 @ 00:49:05.800; CH15-E0128 @ 00:49:09.000 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F14 | Matriz de perfiles de descuento | CH15-E0144 @ 00:49:33.200; CH15-E0148 @ 00:49:41.400 | IMPLEMENTED_PARTIAL | P1 |
| CH15-F15 | Regla de lotes para consumos internos | CH15-E0068 @ 00:46:51.600 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH15-F16 | Honorario vinculado a profesional | CH15-E0097 @ 00:47:42.000 | NEEDS_CLIENT_CONFIRMATION | P2 |

## CH16 · Descuentos y reglas por categoría

Eventos: 44/44. Requisitos: 9.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH16-F01 | Matriz de descuentos por familia | CH16-E0001 @ 00:49:45.000; CH16-E0018 @ 00:50:18.200 | IMPLEMENTED_PARTIAL | P1 |
| CH16-F02 | Catálogo paginado y exportable | CH16-E0013 @ 00:50:13.800; CH16-E0030 @ 00:50:38.000 | IMPLEMENTED_PARTIAL | P1 |
| CH16-F03 | Perfiles con categorías excluidas | CH16-E0003 @ 00:49:58.000; CH16-E0024 @ 00:50:25.800 | IMPLEMENTED_PARTIAL | P1 |
| CH16-F04 | Alta de perfil de descuento | CH16-E0035 @ 00:50:42.400 | IMPLEMENTED_PARTIAL | P1 |
| CH16-F05 | Marca de jubilado | CH16-E0034 @ 00:50:41.800; CH16-E0035 @ 00:50:42.400 | IMPLEMENTED_PARTIAL | P1 |
| CH16-F06 | Perfiles negociados por categoría | CH16-E0003 @ 00:49:58.000 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH16-F07 | Recarga del catálogo después del alta | CH16-E0036 @ 00:50:48.000; CH16-E0039 @ 00:50:49.400 | IMPLEMENTED_PARTIAL | P1 |
| CH16-F08 | Acceso al reporte de salud | CH16-E0041 @ 00:50:54.000; CH16-E0044 @ 00:51:07.200 | IMPLEMENTED_PARTIAL | P1 |
| CH16-F09 | Bloqueo de edición clínica tras guardar | CH16-E0040 @ 00:50:52.200 | NEEDS_CLIENT_CONFIRMATION | P2 |

## CH17 · Reporte de salud detallado e impresión

Eventos: 48/48. Requisitos: 17.

| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |
|---|---|---|---|---|
| CH17-F01 | Listado clínico con triage y auditoría | CH17-E0001 @ 00:51:10.000; CH17-E0003 @ 00:51:12.400 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F02 | Acciones de la hospitalización | CH17-E0005 @ 00:51:14.200 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F03 | Reporte clínico por hospitalización | CH17-E0008 @ 00:51:16.600 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F04 | Cambio de rango temporal | CH17-E0012 @ 00:51:18.800; CH17-E0017 @ 00:51:32.000; CH17-E0019 @ 00:51:33.000 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F05 | Información principal del paciente | CH17-E0019 @ 00:51:33.000 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F06 | Seguros seleccionables para impresión | CH17-E0021 @ 00:51:34.400 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F07 | Salida imprimible configurable | CH17-E0008 @ 00:51:16.600; CH17-E0021 @ 00:51:34.400; CH17-E0043 @ 00:52:08.400 | NOT_TESTABLE | P2 |
| CH17-F08 | Navegación de Evaluación Clínica | CH17-E0024 @ 00:51:37.200 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F09 | Antecedentes clínicos estructurados | CH17-E0026 @ 00:51:43.400; CH17-E0027 @ 00:51:44.200 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F10 | Captura de alergias desde catálogo | CH17-E0029 @ 00:51:48.600; CH17-E0030 @ 00:51:50.600 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F11 | Signos vitales agrupados por origen | CH17-E0038 @ 00:52:00.600 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F12 | Listado de notas de enfermería | CH17-E0043 @ 00:52:08.400; CH17-E0046 @ 00:52:09.800 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F13 | Edición de nota clínica | CH17-E0048 @ 00:52:14.800; CH17-E0048 @ 00:52:14.800 | IMPLEMENTED_PARTIAL | P1 |
| CH17-F14 | Auditoría de nota con IA | CH17-E0048 @ 00:52:14.800 | NOT_TESTABLE | P2 |
| CH17-F15 | Restricción de edición por rol | CH17-E0048 @ 00:52:14.800 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH17-F16 | Aplicación operativa de enfermería | CH17-E0046 @ 00:52:09.800 | NEEDS_CLIENT_CONFIRMATION | P2 |
| CH17-F17 | Compartir nota de enfermería por WhatsApp | CH17-E0048 @ 00:52:14.800 | NOT_TESTABLE | P2 |
