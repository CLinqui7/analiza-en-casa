# AuditorÃ­a final Â· Video â†’ React Â· Analiza en Casa

Generado: 2026-09-06T06:29:08.106Z
Fuente: `docs/qa/VIDEO_TO_REACT_TRACEABILITY.json`
Requisitos canÃ³nicos revisados: **210/210**

## Regla de lectura

**210/210 trazados no significa 210/210 implementados.** Esta auditorÃ­a conserva exactamente la clasificaciÃ³n canÃ³nica y no convierte reglas clÃ­nicas, financieras o integraciones no aprobadas en funcionalidades inventadas.

## Resumen

| Estado de paridad | Cantidad |
|---|---:|
| BLOCKED_CLIENT | 8 |
| BLOCKED_INTEGRATION | 3 |
| EXACT | 52 |
| MISSING | 20 |
| NOT_APPLICABLE | 2 |
| NOT_TESTABLE | 40 |
| PARTIAL | 85 |

| Estado funcional | Cantidad |
|---|---:|
| DEMO_LOCAL_VERIFIED | 3 |
| UNVERIFIED | 108 |
| VERIFIED | 99 |

- CapÃ­tulos presentes: **17/17**.
- Requisitos con bloqueo explÃ­cito: **155**.
- Requisitos no EXACT: **158**.
- Gaps MISSING/PARTIAL sin blocker explÃ­cito: **0**.
- Requisitos sin evidence_paths: **0**.
- Requisitos sin classification: **0**.

## Gaps accionables sin bloqueo explÃ­cito

No se encontraron gaps MISSING/PARTIAL sin un bloqueo explÃ­cito.

## Requisitos bloqueados o dependientes de definiciÃ³n/integraciÃ³n

| ID | Cap. | Paridad | Tipo bloqueo | FunciÃ³n | Preguntas/Bloqueadores |
|---|---|---|---|---|---|
| CH03-F003 | CH03 | NOT_TESTABLE | NOT_TESTABLE | Pestaña Preadmisión transitoria | CH03-Q001, CH03-Q001 |
| CH03-F006 | CH03 | BLOCKED_CLIENT | BLOCKED_CLIENT | Interpretación verbal de hospitalización activa | CH03-Q002, CH03-Q002 |
| CH04-F003 | CH04 | NOT_TESTABLE | NOT_TESTABLE | Resultados de paciente con etiquetas de cotización | CH04-Q001, CH04-Q001 |
| CH04-F005 | CH04 | PARTIAL | CLIENT_DEFINITION | Fecha requerida con calendario | CH04-Q003, CH04-Q003 |
| CH04-F008 | CH04 | NOT_TESTABLE | NOT_TESTABLE | Catálogo heterogéneo de referidos | CH04-Q005, CH04-Q005 |
| CH04-F010 | CH04 | PARTIAL | CLIENT_DEFINITION | Giftcard y Comentarios | CH04-Q007, CH04-Q008, CH04-Q007, CH04-Q008 |
| CH04-F011 | CH04 | PARTIAL | CLIENT_DEFINITION | Categorías de ítems y filtro de inventario | CH04-Q009, CH04-Q009 |
| CH05-F002 | CH05 | PARTIAL | CLIENT_DEFINITION | Socio de negocios selecciona catálogo de precios | CH05-Q001, CH05-Q001 |
| CH05-F003 | CH05 | PARTIAL | NOT_TESTABLE | Bloqueo visual Procesando durante cargas y adiciones | CH05-Q008 |
| CH05-F004 | CH05 | PARTIAL | CLIENT_DEFINITION | Catálogo de Servicios con búsqueda incremental | CH05-Q001 |
| CH05-F005 | CH05 | PARTIAL | CLIENT_DEFINITION | Selección de servicio autocompleta precio | CH05-Q001 |
| CH05-F007 | CH05 | PARTIAL | CLIENT_DEFINITION | Ledger de conceptos agrupado por tipo | CH05-Q009, CH05-Q009 |
| CH05-F008 | CH05 | PARTIAL | CLIENT_DEFINITION | Resumen de subtotal, descuentos, impuesto y total | CH05-Q004, CH05-Q008, CH05-Q004, CH05-Q008 |
| CH05-F009 | CH05 | PARTIAL | CLIENT_DEFINITION | Múltiples líneas de Servicios | CH05-Q002, CH05-Q002, CH05-Q003 |
| CH05-F010 | CH05 | PARTIAL | CLIENT_DEFINITION | Compositor específico de Medicamentos | CH05-Q005, CH05-Q006 |
| CH05-F011 | CH05 | PARTIAL | CLIENT_DEFINITION | Catálogo de medicamentos muestra conteos entre paréntesis | CH05-Q005, CH05-Q005 |
| CH05-F013 | CH05 | PARTIAL | CLINICAL_APPROVAL | Selección de medicamento autocompleta precio | CH05-Q006, CH05-Q007 |
| CH05-F014 | CH05 | NOT_TESTABLE | NOT_TESTABLE | Intento de añadir Invanz restablece el compositor | CH05-Q006, CH05-Q007, CH05-Q006, CH05-Q007 |
| CH05-F015 | CH05 | PARTIAL | CLIENT_DEFINITION | Filtro de inventario y acciones finales visibles | CH05-Q004, CH05-Q008, CH05-Q004, CH05-Q008 |
| CH06-F02 | CH06 | PARTIAL | CLIENT_DEFINITION | Catálogo por socio de negocios | CH06-Q001 |
| CH06-F03 | CH06 | PARTIAL | CLIENT_DEFINITION | Selección de insumos con existencia | CH06-Q004 |
| CH06-F04 | CH06 | PARTIAL | CLIENT_DEFINITION | Selección de estudios diagnósticos | CH06-Q001, CH06-Q004 |
| CH06-F05 | CH06 | PARTIAL | CLIENT_DEFINITION | Honorarios por profesional o servicio | CH06-Q001, CH06-Q006 |
| CH06-F06 | CH06 | PARTIAL | CLIENT_DEFINITION | Tabla agrupada y cálculo por renglón | CH06-Q004, CH06-Q004, CH06-Q010 |
| CH06-F07 | CH06 | PARTIAL | CLIENT_DEFINITION | Descuentos, impuesto y totales | CH06-Q002, CH06-Q003 |
| CH06-F08 | CH06 | PARTIAL | CLIENT_DEFINITION | Autocompletado por paciente | CH06-Q003, CH06-Q005 |
| CH06-F09 | CH06 | NOT_TESTABLE | NOT_TESTABLE | Persistencia y retroceso | CH06-Q008, CH06-Q009, CH06-Q008, CH06-Q009 |
| CH06-F10 | CH06 | NOT_TESTABLE | NOT_TESTABLE | Contenido de Equipos y Extras | CH06-Q007, CH06-Q007 |
| CH07-F04 | CH07 | PARTIAL | CLIENT_DEFINITION | Menú contextual y documentos | CH07-Q003, CH07-Q006, CH07-Q004, CH07-Q008 |
| CH07-F05 | CH07 | PARTIAL | BLOCKED_INTEGRATION | Envío por correo o WhatsApp | CH07-Q009, CH07-Q010 |
| CH07-F06 | CH07 | NOT_TESTABLE | NOT_TESTABLE | Generación y envío directo de PDF | CH07-Q005 |
| CH07-F07 | CH07 | PARTIAL | CLIENT_DEFINITION | Transiciones de estado | CH07-Q001, CH07-Q002 |
| CH07-F08 | CH07 | NOT_TESTABLE | NOT_TESTABLE | Cotización guardada pero no activada | CH07-Q002, CH07-Q003 |
| CH07-F09 | CH07 | NOT_TESTABLE | NOT_TESTABLE | Resultado de una transición de estado | CH07-Q002 |
| CH08-F01 | CH08 | BLOCKED_INTEGRATION | BLOCKED_INTEGRATION | Perfil administrativo de ejecución | CH08-SUPABASE-ADMINISTRATIVE-EXECUTION-RPC |
| CH08-F02 | CH08 | BLOCKED_INTEGRATION | BLOCKED_INTEGRATION | Campos administrativos y de aseguradora | CH08-Q002, CH08-SUPABASE-ADMINISTRATIVE-EXECUTION-RPC, CH08-Q002, CH08-Q007 |
| CH08-F03 | CH08 | BLOCKED_INTEGRATION | BLOCKED_INTEGRATION | Guardado del perfil administrativo | CH08-SUPABASE-ADMINISTRATIVE-EXECUTION-RPC |
| CH08-F04 | CH08 | PARTIAL | CLIENT_DEFINITION | Listado de cuentas por cobrar y exportaciones | CH08-Q009, CH08-Q009 |
| CH08-F05 | CH08 | PARTIAL | CLIENT_DEFINITION | Acciones de una cuenta | CH08-Q004, CH08-Q005, CH08-Q004, CH08-Q005 |
| CH08-F06 | CH08 | PARTIAL | CLIENT_DEFINITION | Histórico de estados de cuenta | CH08-Q004 |
| CH08-F07 | CH08 | PARTIAL | CLIENT_DEFINITION | Pagos de hospitalización | CH08-Q003, CH08-Q003, CH08-Q006 |
| CH08-F08 | CH08 | PARTIAL | CLIENT_DEFINITION | Configuración de estado de cuenta | CH08-Q002, CH08-Q003 |
| CH08-F09 | CH08 | PARTIAL | CLIENT_DEFINITION | Vista previa de cuenta del paciente | CH08-Q002, CH08-Q003 |
| CH08-F10 | CH08 | PARTIAL | CLIENT_DEFINITION | Resumen de pago | CH08-Q001, CH08-Q003 |
| CH08-F11 | CH08 | NOT_TESTABLE | NOT_TESTABLE | Interpretación de total pendiente negativo | CH08-Q001, CH08-Q001 |
| CH08-F12 | CH08 | NOT_TESTABLE | NOT_TESTABLE | Estado de cuenta automático | CH08-Q010, CH08-Q010 |
| CH09-F01 | CH09 | PARTIAL | BLOCKED_CLIENT | Listado de Hospitalización Clínica | CH09-Q002, CH09-Q004, CH09-Q002, CH09-Q004 |
| CH09-F02 | CH09 | PARTIAL | BLOCKED_CLIENT | Acciones de una hospitalización clínica | CH09-Q006, CH09-Q006 |
| CH09-F03 | CH09 | PARTIAL | CLINICAL_APPROVAL | Versiones de perfiles clínicos por hospitalización | CH09-Q002, CH09-Q003, CH09-Q010 |
| CH09-F04 | CH09 | PARTIAL | CLINICAL_APPROVAL | Formulario de perfil clínico | CH09-Q002, CH09-Q004, CH09-Q008 |
| CH09-F05 | CH09 | PARTIAL | CLINICAL_APPROVAL | Catálogo codificado de diagnósticos | CH09-Q001 |
| CH09-F06 | CH09 | PARTIAL | CLINICAL_APPROVAL | Grupos operativos del perfil | CH09-Q004 |
| CH09-F07 | CH09 | PARTIAL | CLINICAL_APPROVAL | Dispositivos y planificación de turnos | CH09-Q004 |
| CH09-F08 | CH09 | PARTIAL | CLINICAL_APPROVAL | Listado de Reporte de salud y menú clínico | CH09-Q006 |
| CH09-F09 | CH09 | PARTIAL | CLINICAL_APPROVAL | Reporte longitudinal por pestañas | CH09-Q007, CH09-Q008, CH09-Q009 |
| CH09-F10 | CH09 | PARTIAL | CLINICAL_APPROVAL | Cambio de rango del reporte | CH09-Q005 |
| CH09-F11 | CH09 | PARTIAL | CLINICAL_APPROVAL | Configuración de secciones para impresión | CH09-Q007, CH09-Q008, CH09-Q009 |
| CH09-F12 | CH09 | NOT_TESTABLE | NOT_TESTABLE | Resultado de Imprimir no demostrado | CH09-Q010, CH09-Q010 |
| CH09-F13 | CH09 | NOT_TESTABLE | NOT_TESTABLE | Intervalo visual discontinuo antes de repetir la confirmación | CH09-Q011, CH09-Q011 |
| CH09-F14 | CH09 | NOT_TESTABLE | NOT_TESTABLE | Contenido del expediente impreso descrito verbalmente | CH09-Q013, CH09-Q013 |
| CH10-F01 | CH10 | PARTIAL |  | Listado de pacientes de Orden Médica | CH10-Q011, CH10-Q011, CH10-Q012 |
| CH10-F02 | CH10 | PARTIAL |  | Elección de tipo de documento | CH10-Q001, CH10-Q001 |
| CH10-F03 | CH10 | PARTIAL |  | Encabezado y tratamientos de tarjeta | CH10-Q001, CH10-Q003, CH10-Q005, CH10-Q006, CH10-Q001, CH10-Q003, CH10-Q005, CH10-Q006 |
| CH10-F04 | CH10 | PARTIAL | CLINICAL_APPROVAL | Editor detallado de tratamiento | CH10-Q006, CR-019-Q001, CH10-Q003, CH10-Q005, CH10-Q006, CR-019-Q001 |
| CH10-F05 | CH10 | NOT_TESTABLE | NOT_TESTABLE | Catálogos visibles de pauta y horarios | CH10-Q003, CH10-Q005, CH10-Q003, CH10-Q005 |
| CH10-F06 | CH10 | NOT_TESTABLE | NOT_TESTABLE | Derivación aparente de fecha final | CH10-Q004, CH10-Q004 |
| CH10-F07 | CH10 | PARTIAL | CLINICAL_APPROVAL | Composición de orden por etiquetas | CH10-Q007, CH10-Q008 |
| CH10-F08 | CH10 | PARTIAL | CLINICAL_APPROVAL | Consulta de órdenes, tarjetas e historial | CH10-Q009, CH10-Q010, CH10-Q013, CH10-Q001, CH10-Q002, CH10-Q009, CH10-Q010, CH10-Q011, CH10-Q013 |
| CH10-F09 | CH10 | NOT_TESTABLE | NOT_TESTABLE | Impresiones de tarjeta de medicamentos | CH10-Q009, CH10-Q010, CH10-Q013, CH10-Q009, CH10-Q010, CH10-Q013 |
| CH10-F10 | CH10 | NOT_TESTABLE | NOT_TESTABLE | Permisos y corrección clínica | CH10-Q001, CH10-Q001 |
| CH11-F02 | CH11 | PARTIAL |  | Navegación y vistas de calendario | CH11-Q002, CH11-Q003, CH11-Q004, CH11-Q006, CH11-Q008, CH11-Q002, CH11-Q003, CH11-Q004, CH11-Q006, CH11-Q008, CR-010 |
| CH11-F03 | CH11 | PARTIAL | CLIENT_DEFINITION | Formulario de creación de visita | CH11-Q001, CH11-Q003, CH11-Q006, CH11-Q008, CH11-Q001, CH11-Q003, CH11-Q006, CH11-Q008, CR-010 |
| CH11-F04 | CH11 | PARTIAL | CLIENT_DEFINITION | Clasificación puntual o turno | CR-010, CH11-Q001, CH11-Q003, CH11-Q006, CH11-Q008 |
| CH11-F05 | CH11 | PARTIAL | CLIENT_DEFINITION | Catálogo de tipos de visita | CH11-Q001, CH11-Q003, CH11-Q006, CH11-Q008 |
| CH11-F06 | CH11 | PARTIAL | CLIENT_DEFINITION | Detalle de visita finalizada | CH11-Q002, CH11-Q004, CH11-Q006, CH11-Q008, CH11-Q002, CH11-Q004, CH11-Q006, CH11-Q008, CR-010 |
| CH11-F07 | CH11 | NOT_TESTABLE | NOT_TESTABLE | Tipo de atención en liquidación | CH11-Q002, CH11-Q003 |
| CH11-F08 | CH11 | NOT_TESTABLE | NOT_TESTABLE | Ajustes al pago de servicio profesional | CH11-Q003 |
| CH11-F09 | CH11 | NOT_TESTABLE | NOT_TESTABLE | Reglas de liquidación y permisos | CH11-Q003, CH11-Q006, CH11-Q008 |
| CH12-F01 | CH12 | PARTIAL | CLIENT_DEFINITION | Resumen de cuentas por pagar | CH12-Q011, CH12-Q001, CH12-Q002, CH12-Q003, CH12-Q007, CH12-Q008, CH12-Q009, CH12-Q010, CH12-Q011 |
| CH12-F02 | CH12 | PARTIAL | CLIENT_DEFINITION | Listado de pagos de servicios | CH12-Q001, CH12-Q002, CH12-Q003, CH12-Q001, CH12-Q002, CH12-Q003 |
| CH12-F03 | CH12 | NOT_TESTABLE | NOT_TESTABLE | Acciones de pagos y reportes | CH12-Q001, CH12-Q002, CH12-Q003, CH12-Q001, CH12-Q002, CH12-Q003 |
| CH12-F04 | CH12 | BLOCKED_CLIENT | CLIENT_DEFINITION | Filtro de pagos | CH12-Q001, CH12-Q002, CH12-Q003 |
| CH12-F05 | CH12 | PARTIAL | CLIENT_DEFINITION | Edición de pago de servicio profesional | CH12-Q004, CH12-Q007, CH12-Q002, CH12-Q003, CH12-Q004, CH12-Q007 |
| CH12-F06 | CH12 | PARTIAL | CLIENT_DEFINITION | Conceptos de adición o descuento | CH12-Q006, CH12-Q005, CH12-Q006, CH12-Q007 |
| CH12-F07 | CH12 | BLOCKED_CLIENT | CLIENT_DEFINITION | Catálogo visible de motivos | CH12-Q005, CH12-Q005, CH12-Q006, CH12-Q007 |
| CH12-F08 | CH12 | NOT_TESTABLE | NOT_TESTABLE | Reglas financieras de montos y aprobación | CH12-Q004, CH12-Q007, CH12-Q004, CH12-Q007 |
| CH13-F01 | CH13 | PARTIAL | CLIENT_DEFINITION | Listado de compras | CH13-Q001, CH13-Q009, CH13-Q001, CH13-Q009, CH13-Q012 |
| CH13-F02 | CH13 | NOT_TESTABLE | NOT_TESTABLE | Estados visibles de compra | CH13-Q001, CH13-Q009, CH13-Q001, CH13-Q009 |
| CH13-F03 | CH13 | BLOCKED_CLIENT | CLIENT_DEFINITION | Elección de modalidad de compra | CH13-Q008, CH13-Q008 |
| CH13-F04 | CH13 | PARTIAL | CLIENT_DEFINITION | Formulario de orden de compra | CH13-Q001, CH13-Q004, CH13-Q008, CH13-Q014 |
| CH13-F05 | CH13 | BLOCKED_CLIENT | CLIENT_DEFINITION | Tabla de ítems de orden | CH13-Q001, CH13-Q004, CH13-Q014 |
| CH13-F06 | CH13 | BLOCKED_CLIENT | CLIENT_DEFINITION | Formulario de compra por caja menuda | CH13-Q008, CH13-Q014, CH13-Q004, CH13-Q006, CH13-Q007, CH13-Q008, CH13-Q014 |
| CH13-F07 | CH13 | BLOCKED_CLIENT | CLIENT_DEFINITION | Desglose de totales de caja menuda | CH13-Q004, CH13-Q004, CH13-Q005, CH13-Q006 |
| CH13-F08 | CH13 | PARTIAL | BLOCKED_INTEGRATION | Detalle de compra y adjuntos | CH13-Q007, CH13-Q007 |
| CH13-F09 | CH13 | BLOCKED_CLIENT | CLIENT_DEFINITION | Acciones sobre compra | CH13-Q010, CH13-Q011, CH13-Q012, CH13-Q013, CH13-Q010, CH13-Q011, CH13-Q012, CH13-Q013 |
| CH13-F10 | CH13 | NOT_TESTABLE | NOT_TESTABLE | Relación de compras con inventario | CH13-Q002, CH13-Q003, CH13-Q002, CH13-Q003 |
| CH13-F11 | CH13 | NOT_TESTABLE | NOT_TESTABLE | Reglas fiscales, de anulación y autorización | CH13-Q002, CH13-Q003, CH13-Q002, CH13-Q003 |
| CH14-F01 | CH14 | PARTIAL | CLIENT_DEFINITION | Existencias disponibles, comprometidas y totales | CH14-Q001, CH14-Q015, CH14-Q001, CH14-Q015 |
| CH14-F02 | CH14 | PARTIAL | CLIENT_DEFINITION | Historial de movimientos por item | CH14-Q001, CH14-Q001 |
| CH14-F03 | CH14 | NOT_TESTABLE | NOT_TESTABLE | Inventario comprometido como estado temporal | CH14-Q001, CH14-Q001 |
| CH14-F04 | CH14 | PARTIAL | CLIENT_DEFINITION | Panel de acuses por pacientes y recursos | CH14-Q002 |
| CH14-F05 | CH14 | NOT_TESTABLE | NOT_TESTABLE | Gestión y exportación de acuses | CH14-Q002, CH14-Q003, CH14-Q002, CH14-Q003 |
| CH14-F06 | CH14 | PARTIAL | CLIENT_DEFINITION | Cierres pendientes, totales y cerrados | CH14-Q007 |
| CH14-F07 | CH14 | MISSING | CLIENT_DEFINITION | Advertencia de cierre ya abierto | CH14-Q006, CH14-Q006 |
| CH14-F08 | CH14 | NOT_TESTABLE | NOT_TESTABLE | Aprobación de cierre total | CH14-Q007, CH14-Q007 |
| CH14-F09 | CH14 | PARTIAL | CLIENT_DEFINITION | Catálogo de proveedores | CH14-Q008, CH14-Q008 |
| CH14-F10 | CH14 | PARTIAL | CLIENT_DEFINITION | Catálogo de bodegas y traslados | CH14-Q009, CH14-Q009 |
| CH14-F11 | CH14 | MISSING | CLIENT_DEFINITION | Lotes, números de serie y vencimiento | CH14-Q010, CH14-Q011, CH14-Q010, CH14-Q011 |
| CH14-F12 | CH14 | PARTIAL | CLIENT_DEFINITION | Catálogo de kits de insumos | CH14-Q012, CH14-Q013, CH14-Q015, CH14-Q012, CH14-Q013, CH14-Q015 |
| CH14-F13 | CH14 | MISSING | CLIENT_DEFINITION | Composición cuantificada del kit | CH14-Q012, CH14-Q013, CH14-Q012, CH14-Q013 |
| CH14-F14 | CH14 | MISSING | CLIENT_DEFINITION | Creación de acuse para hospitalización | CH14-Q001, CH14-Q002, CH14-Q004, CH14-Q005, CH14-Q016, CH14-Q001, CH14-Q002, CH14-Q004, CH14-Q005, CH14-Q016 |
| CH14-F15 | CH14 | MISSING | CLIENT_DEFINITION | Detección de items faltantes | CH14-Q005, CH14-Q014, CH14-Q005, CH14-Q014 |
| CH14-F16 | CH14 | NOT_TESTABLE | CLIENT_DEFINITION | Vínculo de faltantes con cotización | CH14-Q014, CH14-Q014 |
| CH15-F01 | CH15 | PARTIAL | CLIENT_DEFINITION | Reconciliación de items faltantes | CH15-Q001 |
| CH15-F02 | CH15 | PARTIAL | CLIENT_DEFINITION | Solicitudes desde la casa del paciente | CH15-Q002 |
| CH15-F03 | CH15 | PARTIAL | CLIENT_DEFINITION | Alta manual de items en un acuse | CH15-Q001, CH15-Q002 |
| CH15-F04 | CH15 | PARTIAL | CLIENT_DEFINITION | Carga de acuse desde plantilla o cotización | CH15-Q003 |
| CH15-F05 | CH15 | NOT_TESTABLE | CLIENT_DEFINITION | Estados seleccionables de cotización | CH15-Q003, CH15-Q003 |
| CH15-F06 | CH15 | PARTIAL | CLIENT_DEFINITION | Catálogo y alta de medicamentos | CH15-Q004, CH15-Q004 |
| CH15-F07 | CH15 | PARTIAL | CLIENT_DEFINITION | Advertencia por cambios no guardados | CH15-Q004, CH15-Q005 |
| CH15-F08 | CH15 | PARTIAL | CLIENT_DEFINITION | Catálogo y alta de insumos | CH15-Q004, CH15-Q004 |
| CH15-F09 | CH15 | PARTIAL | CLIENT_DEFINITION | Catálogo de estudios diagnósticos | CH15-Q004, CH15-Q004 |
| CH15-F10 | CH15 | PARTIAL | CLIENT_DEFINITION | Catálogo y alta de honorarios | CH15-Q004, CH15-Q006, CH15-Q004, CH15-Q006 |
| CH15-F11 | CH15 | PARTIAL | CLIENT_DEFINITION | Confirmación de guardado de honorario | CH15-Q006 |
| CH15-F12 | CH15 | PARTIAL | CLIENT_DEFINITION | Acciones y edición de honorarios | CH15-Q006, CH15-Q007 |
| CH15-F13 | CH15 | PARTIAL | CLIENT_DEFINITION | Catálogo de servicios | CH15-Q004, CH15-Q004 |
| CH15-F14 | CH15 | PARTIAL | CLIENT_DEFINITION | Matriz de perfiles de descuento | CH15-Q004, CH15-Q004 |
| CH15-F15 | CH15 | NOT_TESTABLE | CLIENT_DEFINITION | Regla de lotes para consumos internos | CH15-Q005, CH15-Q005 |
| CH15-F16 | CH15 | NOT_TESTABLE | CLIENT_DEFINITION | Honorario vinculado a profesional | CH15-Q006, CH15-Q006 |
| CH16-F01 | CH16 | PARTIAL | CLIENT_DEFINITION | Matriz de descuentos por familia | CH16-Q001, CH16-Q002, CH16-Q003, CH16-Q005, CH16-Q001, CH16-Q002, CH16-Q003, CH16-Q005 |
| CH16-F02 | CH16 | MISSING | CLIENT_DEFINITION | Catálogo paginado y exportable | CH16-Q001, CH16-Q005, CH16-Q001, CH16-Q005 |
| CH16-F03 | CH16 | MISSING | CLIENT_DEFINITION | Perfiles con categorías excluidas | CH16-Q001, CH16-Q002, CH16-Q003, CH16-Q001, CH16-Q002, CH16-Q003 |
| CH16-F04 | CH16 | MISSING | CLIENT_DEFINITION | Alta de perfil de descuento | CH16-Q001, CH16-Q003, CH16-Q005, CH16-Q001, CH16-Q003, CH16-Q005 |
| CH16-F05 | CH16 | MISSING | CLIENT_DEFINITION | Marca de jubilado | CH16-Q004, CH16-Q005, CH16-Q004, CH16-Q005 |
| CH16-F06 | CH16 | NOT_TESTABLE | CLIENT_DEFINITION | Perfiles negociados por categoría | CH16-Q001, CH16-Q002, CH16-Q006, CH16-Q001, CH16-Q002, CH16-Q006 |
| CH16-F07 | CH16 | MISSING | CLIENT_DEFINITION | Recarga del catálogo después del alta | CH16-Q005, CH16-Q005 |
| CH16-F08 | CH16 | MISSING | CLIENT_DEFINITION | Acceso al reporte de salud | CH16-Q008, CH16-Q008 |
| CH16-F09 | CH16 | NOT_TESTABLE | CLIENT_DEFINITION | Bloqueo de edición clínica tras guardar | CH16-Q007, CH16-Q007 |
| CH17-F01 | CH17 | PARTIAL | CLIENT_DEFINITION | Listado clínico con triage y auditoría | CH16-Q008, CH16-Q008 |
| CH17-F02 | CH17 | PARTIAL | CLIENT_DEFINITION | Acciones de la hospitalización | CH17-Q007, CH17-Q007 |
| CH17-F03 | CH17 | PARTIAL | CLIENT_DEFINITION | Reporte clínico por hospitalización | CH16-Q008, CH16-Q008 |
| CH17-F04 | CH17 | MISSING | CLIENT_DEFINITION | Cambio de rango temporal | CH16-Q008, CH17-Q008, CH16-Q008, CH17-Q008 |
| CH17-F05 | CH17 | MISSING | CLIENT_DEFINITION | Información principal del paciente | CH16-Q008, CH16-Q008 |
| CH17-F06 | CH17 | MISSING | CLIENT_DEFINITION | Seguros seleccionables para impresión | CH16-Q008, CH17-Q001, CH16-Q008, CH17-Q001 |
| CH17-F07 | CH17 | NOT_TESTABLE | CLIENT_DEFINITION | Salida imprimible configurable | CH17-Q001, CH17-Q001 |
| CH17-F08 | CH17 | MISSING | CLIENT_DEFINITION | Navegación de Evaluación Clínica | CH16-Q008, CH17-Q002, CH16-Q008, CH17-Q002 |
| CH17-F09 | CH17 | MISSING | CLIENT_DEFINITION | Antecedentes clínicos estructurados | CH16-Q008, CH17-Q002, CH16-Q008, CH17-Q002 |
| CH17-F10 | CH17 | MISSING | CLIENT_DEFINITION | Captura de alergias desde catálogo | CH16-Q008, CH17-Q002, CH16-Q008, CH17-Q002 |
| CH17-F11 | CH17 | MISSING | CLIENT_DEFINITION | Signos vitales agrupados por origen | CH16-Q008, CH17-Q009, CH16-Q008, CH17-Q009 |
| CH17-F12 | CH17 | MISSING | CLIENT_DEFINITION | Listado de notas de enfermería | CH16-Q008, CH17-Q001, CH17-Q010, CH16-Q008, CH17-Q001, CH17-Q010 |
| CH17-F13 | CH17 | MISSING | CLIENT_DEFINITION | Edición de nota clínica | CH16-Q008, CH17-Q010, CH17-Q011, CH16-Q008, CH17-Q010, CH17-Q011 |
| CH17-F14 | CH17 | NOT_TESTABLE | CLIENT_DEFINITION | Auditoría de nota con IA | CH17-Q003, CH17-Q003 |
| CH17-F15 | CH17 | NOT_TESTABLE | CLIENT_DEFINITION | Restricción de edición por rol | CH17-Q005, CH17-Q005 |
| CH17-F16 | CH17 | NOT_TESTABLE | CLIENT_DEFINITION | Aplicación operativa de enfermería | CH17-Q006, CH17-Q006 |
| CH17-F17 | CH17 | NOT_TESTABLE | CLIENT_DEFINITION | Compartir nota de enfermería por WhatsApp | CH17-Q004, CH17-Q004 |

## Matriz completa 210/210

| ID | Cap. | P | ClasificaciÃ³n | Paridad | Funcional | Persistencia | Permisos | Ruta React | Playwright | Selenium | Bloqueo | FunciÃ³n |
|---|---|---|---|---|---|---|---|---|---:|---:|---|---|
| CH01-F001 | CH01 | P1 | INFERRED | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 0 |  | Acceso mediante ruta directa al módulo de pacientes |
| CH01-F002 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 1 |  | Listado de pacientes |
| CH01-F003 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 0 |  | Columnas del catálogo de pacientes |
| CH01-F004 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 0 |  | Búsqueda y paginación de pacientes |
| CH01-F005 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 1 |  | Exportar y crear paciente |
| CH01-F006 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 0 |  | Estados de carga y vacío de tabla |
| CH01-F007 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 1 |  | Indicadores de triage, notificación y estado |
| CH01-F008 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 0 |  | Menú lateral colapsable y jerárquico |
| CH01-F009 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 0 |  | Dashboard operativo |
| CH01-F010 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 0 |  | Pacientes con valores fuera de rango |
| CH01-F011 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 1 |  | Menú de usuario y contexto organizacional |
| CH01-F012 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 0 |  | Cierre de sesión |
| CH01-F013 | CH01 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 1 |  | Formulario de inicio de sesión |
| CH01-F014 | CH01 | P1 | INFERRED | EXACT | VERIFIED | NOT_APPLICABLE | NOT_APPLICABLE | /patients | 1 | 1 |  | Instalación en dispositivo aparente |
| CH02-F001 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 0 |  | Ruta autenticada hasta Pacientes |
| CH02-F002 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 0 |  | Listado de pacientes con vistas y acciones |
| CH02-F003 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 1 | 0 |  | Formulario de alta por secciones |
| CH02-F004 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 0 |  | Datos personales obligatorios y opcionales |
| CH02-F005 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 0 |  | Documento y fecha de nacimiento |
| CH02-F006 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 1 |  | Selectores demográficos y organizacionales |
| CH02-F007 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 0 |  | Consentimiento visible para notificaciones Botmaker/WhatsApp |
| CH02-F008 | CH02 | P2 | VERBAL | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 0 |  | Paciente regular frente a paciente asegurado |
| CH02-F009 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 1 |  | Catálogo buscable de seguros |
| CH02-F010 | CH02 | P2 | UNCERTAIN | NOT_APPLICABLE | VERIFIED | NOT_APPLICABLE | VERIFIED | /patients | 0 | 0 |  | Resultados anómalos en el catálogo de seguros |
| CH02-F011 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 1 |  | Decisión de titularidad del seguro |
| CH02-F012 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 1 |  | Datos condicionales de cobertura |
| CH02-F013 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 0 |  | Contactos asociados al paciente |
| CH02-F014 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 1 |  | Dirección con importación y limpieza |
| CH02-F015 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 2 | 1 |  | Mapa embebido para ubicación geográfica |
| CH02-F016 | CH02 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /patients | 1 | 0 |  | Acciones Atrás y Guardar sin resultado observado |
| CH03-F001 | CH03 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 1 | 0 |  | Menú financiero desde Pacientes |
| CH03-F002 | CH03 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 1 | 0 |  | Panel y pestañas de Hospitalización Administrativa |
| CH03-F003 | CH03 | P2 | UNCERTAIN | NOT_TESTABLE | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 0 | 0 | NOT_TESTABLE | Pestaña Preadmisión transitoria |
| CH03-F004 | CH03 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 1 | 0 |  | Filtros de hospitalizaciones activas |
| CH03-F005 | CH03 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 1 | 0 |  | Tabla de hospitalizaciones activas |
| CH03-F006 | CH03 | P2 | VERBAL | BLOCKED_CLIENT | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 0 | 0 | BLOCKED_CLIENT | Interpretación verbal de hospitalización activa |
| CH03-F007 | CH03 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 1 | 0 |  | Vista de pacientes inactivos |
| CH03-F008 | CH03 | P1 | VISIBLE | NOT_APPLICABLE | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 1 | 0 |  | Carga y estado vacío simultáneos |
| CH03-F009 | CH03 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /hospitalizations | 1 | 0 |  | Filtros y alta desde Cotizaciones |
| CH03-F010 | CH03 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 1 | 0 |  | Seguimiento de cotización, preautorización, seguro y reclamo |
| CH03-F011 | CH03 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /hospitalizations | 1 | 0 |  | Fecha de creación y total por cotización |
| CH03-F012 | CH03 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /hospitalizations | 1 | 0 |  | Nueva cotización y datos del paciente |
| CH03-F013 | CH03 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /hospitalizations | 1 | 0 |  | Datos iniciales de factura |
| CH04-F001 | CH04 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /quotes | 1 | 1 |  | Nueva cotización por secciones |
| CH04-F002 | CH04 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 |  | Selector buscable de paciente |
| CH04-F003 | CH04 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | NOT_TESTABLE | Resultados de paciente con etiquetas de cotización |
| CH04-F004 | CH04 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /quotes | 1 | 1 |  | Autocompletado de datos del paciente |
| CH04-F005 | CH04 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 | CLIENT_DEFINITION | Fecha requerida con calendario |
| CH04-F006 | CH04 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 |  | Grupo de descuento obligatorio |
| CH04-F007 | CH04 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 |  | Referido por como multiselección buscable |
| CH04-F008 | CH04 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | NOT_TESTABLE | Catálogo heterogéneo de referidos |
| CH04-F009 | CH04 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /quotes | 1 | 1 |  | Acción auxiliar para Referido por |
| CH04-F010 | CH04 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /quotes | 2 | 2 | CLIENT_DEFINITION | Giftcard y Comentarios |
| CH04-F011 | CH04 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 | CLIENT_DEFINITION | Categorías de ítems y filtro de inventario |
| CH05-F001 | CH05 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /quotes | 1 | 1 |  | Categorías de conceptos en Nueva cotización |
| CH05-F002 | CH05 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 | CLIENT_DEFINITION | Socio de negocios selecciona catálogo de precios |
| CH05-F003 | CH05 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /quotes | 1 | 1 | NOT_TESTABLE | Bloqueo visual Procesando durante cargas y adiciones |
| CH05-F004 | CH05 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /quotes | 1 | 1 | CLIENT_DEFINITION | Catálogo de Servicios con búsqueda incremental |
| CH05-F005 | CH05 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 | CLIENT_DEFINITION | Selección de servicio autocompleta precio |
| CH05-F006 | CH05 | P1 | VISIBLE | EXACT | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 |  | Cantidad requerida y acción Añadir |
| CH05-F007 | CH05 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 | CLIENT_DEFINITION | Ledger de conceptos agrupado por tipo |
| CH05-F008 | CH05 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 | CLIENT_DEFINITION | Resumen de subtotal, descuentos, impuesto y total |
| CH05-F009 | CH05 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | CLIENT_DEFINITION | Múltiples líneas de Servicios |
| CH05-F010 | CH05 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /quotes | 1 | 1 | CLIENT_DEFINITION | Compositor específico de Medicamentos |
| CH05-F011 | CH05 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | CLIENT_DEFINITION | Catálogo de medicamentos muestra conteos entre paréntesis |
| CH05-F012 | CH05 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /quotes | 1 | 1 |  | Estado sin resultados en búsqueda |
| CH05-F013 | CH05 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | CLINICAL_APPROVAL | Selección de medicamento autocompleta precio |
| CH05-F014 | CH05 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | NOT_TESTABLE | Intento de añadir Invanz restablece el compositor |
| CH05-F015 | CH05 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | CLIENT_DEFINITION | Filtro de inventario y acciones finales visibles |
| CH06-F01 | CH06 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /quotes | 2 | 2 |  | Categorías de ítems de cotización |
| CH06-F02 | CH06 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 | CLIENT_DEFINITION | Catálogo por socio de negocios |
| CH06-F03 | CH06 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 | CLIENT_DEFINITION | Selección de insumos con existencia |
| CH06-F04 | CH06 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /quotes | 1 | 1 | CLIENT_DEFINITION | Selección de estudios diagnósticos |
| CH06-F05 | CH06 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /quotes | 2 | 2 | CLIENT_DEFINITION | Honorarios por profesional o servicio |
| CH06-F06 | CH06 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | CLIENT_DEFINITION | Tabla agrupada y cálculo por renglón |
| CH06-F07 | CH06 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | CLIENT_DEFINITION | Descuentos, impuesto y totales |
| CH06-F08 | CH06 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | CLIENT_DEFINITION | Autocompletado por paciente |
| CH06-F09 | CH06 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | NOT_TESTABLE | Persistencia y retroceso |
| CH06-F10 | CH06 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /quotes | 0 | 0 | NOT_TESTABLE | Contenido de Equipos y Extras |
| CH07-F01 | CH07 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 1 | 1 |  | Listado de cotizaciones de hospitalización |
| CH07-F02 | CH07 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 1 | 1 |  | Estados de cotización, preautorización y reclamo |
| CH07-F03 | CH07 | P1 | VISIBLE | EXACT | VERIFIED | NOT_APPLICABLE | VERIFIED | /hospitalizations | 1 | 1 |  | Búsqueda de cotización |
| CH07-F04 | CH07 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /insurance | 0 | 0 | CLIENT_DEFINITION | Menú contextual y documentos |
| CH07-F05 | CH07 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /insurance | 1 | 0 | BLOCKED_INTEGRATION | Envío por correo o WhatsApp |
| CH07-F06 | CH07 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /insurance | 0 | 0 | NOT_TESTABLE | Generación y envío directo de PDF |
| CH07-F07 | CH07 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /insurance | 0 | 0 | CLIENT_DEFINITION | Transiciones de estado |
| CH07-F08 | CH07 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /insurance | 0 | 0 | NOT_TESTABLE | Cotización guardada pero no activada |
| CH07-F09 | CH07 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /insurance | 0 | 0 | NOT_TESTABLE | Resultado de una transición de estado |
| CH08-F01 | CH08 | P1 | VISIBLE | BLOCKED_INTEGRATION | DEMO_LOCAL_VERIFIED | DEMO_LOCAL_VERIFIED | DEMO_LOCAL_VERIFIED | /hospitalizations/:id | 2 | 2 | BLOCKED_INTEGRATION | Perfil administrativo de ejecución |
| CH08-F02 | CH08 | P1 | VISIBLE | BLOCKED_INTEGRATION | DEMO_LOCAL_VERIFIED | DEMO_LOCAL_VERIFIED | DEMO_LOCAL_VERIFIED | /hospitalizations/:id | 2 | 2 | BLOCKED_INTEGRATION | Campos administrativos y de aseguradora |
| CH08-F03 | CH08 | P1 | VISIBLE | BLOCKED_INTEGRATION | DEMO_LOCAL_VERIFIED | DEMO_LOCAL_VERIFIED | DEMO_LOCAL_VERIFIED | /hospitalizations/:id | 2 | 2 | BLOCKED_INTEGRATION | Guardado del perfil administrativo |
| CH08-F04 | CH08 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /receivables | 0 | 0 | CLIENT_DEFINITION | Listado de cuentas por cobrar y exportaciones |
| CH08-F05 | CH08 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /receivables | 0 | 0 | CLIENT_DEFINITION | Acciones de una cuenta |
| CH08-F06 | CH08 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /receivables | 0 | 0 | CLIENT_DEFINITION | Histórico de estados de cuenta |
| CH08-F07 | CH08 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /receivables | 0 | 0 | CLIENT_DEFINITION | Pagos de hospitalización |
| CH08-F08 | CH08 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /receivables | 0 | 0 | CLIENT_DEFINITION | Configuración de estado de cuenta |
| CH08-F09 | CH08 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /receivables | 0 | 0 | CLIENT_DEFINITION | Vista previa de cuenta del paciente |
| CH08-F10 | CH08 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /receivables | 0 | 0 | CLIENT_DEFINITION | Resumen de pago |
| CH08-F11 | CH08 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /receivables | 0 | 0 | NOT_TESTABLE | Interpretación de total pendiente negativo |
| CH08-F12 | CH08 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /receivables | 0 | 0 | NOT_TESTABLE | Estado de cuenta automático |
| CH09-F01 | CH09 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /clinical/hospitalizations | 3 | 1 | BLOCKED_CLIENT | Listado de Hospitalización Clínica |
| CH09-F02 | CH09 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /clinical/hospitalizations | 1 | 1 | BLOCKED_CLIENT | Acciones de una hospitalización clínica |
| CH09-F03 | CH09 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | CLINICAL_APPROVAL | Versiones de perfiles clínicos por hospitalización |
| CH09-F04 | CH09 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | CLINICAL_APPROVAL | Formulario de perfil clínico |
| CH09-F05 | CH09 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | CLINICAL_APPROVAL | Catálogo codificado de diagnósticos |
| CH09-F06 | CH09 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | CLINICAL_APPROVAL | Grupos operativos del perfil |
| CH09-F07 | CH09 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | CLINICAL_APPROVAL | Dispositivos y planificación de turnos |
| CH09-F08 | CH09 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | CLINICAL_APPROVAL | Listado de Reporte de salud y menú clínico |
| CH09-F09 | CH09 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | CLINICAL_APPROVAL | Reporte longitudinal por pestañas |
| CH09-F10 | CH09 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | CLINICAL_APPROVAL | Cambio de rango del reporte |
| CH09-F11 | CH09 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | CLINICAL_APPROVAL | Configuración de secciones para impresión |
| CH09-F12 | CH09 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | NOT_TESTABLE | Resultado de Imprimir no demostrado |
| CH09-F13 | CH09 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | NOT_TESTABLE | Intervalo visual discontinuo antes de repetir la confirmación |
| CH09-F14 | CH09 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | NOT_TESTABLE | Contenido del expediente impreso descrito verbalmente |
| CH10-F01 | CH10 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /clinical/orders | 2 | 1 |  | Listado de pacientes de Orden Médica |
| CH10-F02 | CH10 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /clinical/orders | 1 | 1 |  | Elección de tipo de documento |
| CH10-F03 | CH10 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/orders | 0 | 0 |  | Encabezado y tratamientos de tarjeta |
| CH10-F04 | CH10 | P0 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/orders | 0 | 0 | CLINICAL_APPROVAL | Editor detallado de tratamiento |
| CH10-F05 | CH10 | P1 | VISIBLE | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/orders | 0 | 0 | NOT_TESTABLE | Catálogos visibles de pauta y horarios |
| CH10-F06 | CH10 | P0 | INFERRED | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/orders | 0 | 0 | NOT_TESTABLE | Derivación aparente de fecha final |
| CH10-F07 | CH10 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/orders | 0 | 0 | CLINICAL_APPROVAL | Composición de orden por etiquetas |
| CH10-F08 | CH10 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/orders | 0 | 0 | CLINICAL_APPROVAL | Consulta de órdenes, tarjetas e historial |
| CH10-F09 | CH10 | P1 | VISIBLE | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/orders | 0 | 0 | NOT_TESTABLE | Impresiones de tarjeta de medicamentos |
| CH10-F10 | CH10 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/orders | 0 | 0 | NOT_TESTABLE | Permisos y corrección clínica |
| CH11-F01 | CH11 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /agenda | 1 | 1 |  | Agenda filtrable por paciente |
| CH11-F02 | CH11 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /agenda | 1 | 1 |  | Navegación y vistas de calendario |
| CH11-F03 | CH11 | P1 | VISIBLE | PARTIAL | VERIFIED | VERIFIED | VERIFIED | /agenda | 2 | 2 | CLIENT_DEFINITION | Formulario de creación de visita |
| CH11-F04 | CH11 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /agenda | 1 | 1 | CLIENT_DEFINITION | Clasificación puntual o turno |
| CH11-F05 | CH11 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /agenda | 1 | 1 | CLIENT_DEFINITION | Catálogo de tipos de visita |
| CH11-F06 | CH11 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /agenda | 1 | 1 | CLIENT_DEFINITION | Detalle de visita finalizada |
| CH11-F07 | CH11 | P1 | VISIBLE | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /agenda | 0 | 0 | NOT_TESTABLE | Tipo de atención en liquidación |
| CH11-F08 | CH11 | P1 | VISIBLE | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /agenda | 0 | 0 | NOT_TESTABLE | Ajustes al pago de servicio profesional |
| CH11-F09 | CH11 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /agenda | 0 | 0 | NOT_TESTABLE | Reglas de liquidación y permisos |
| CH12-F01 | CH12 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /clinical/nursing | 2 | 2 | CLIENT_DEFINITION | Resumen de cuentas por pagar |
| CH12-F02 | CH12 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/nursing | 0 | 0 | CLIENT_DEFINITION | Listado de pagos de servicios |
| CH12-F03 | CH12 | P2 | VISIBLE | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/nursing | 0 | 0 | NOT_TESTABLE | Acciones de pagos y reportes |
| CH12-F04 | CH12 | P2 | VISIBLE | BLOCKED_CLIENT | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/nursing | 0 | 0 | CLIENT_DEFINITION | Filtro de pagos |
| CH12-F05 | CH12 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/nursing | 0 | 0 | CLIENT_DEFINITION | Edición de pago de servicio profesional |
| CH12-F06 | CH12 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/nursing | 0 | 0 | CLIENT_DEFINITION | Conceptos de adición o descuento |
| CH12-F07 | CH12 | P2 | VISIBLE | BLOCKED_CLIENT | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/nursing | 0 | 0 | CLIENT_DEFINITION | Catálogo visible de motivos |
| CH12-F08 | CH12 | P0 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/nursing | 0 | 0 | NOT_TESTABLE | Reglas financieras de montos y aprobación |
| CH13-F01 | CH13 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /purchases | 1 | 1 | CLIENT_DEFINITION | Listado de compras |
| CH13-F02 | CH13 | P0 | VISIBLE | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /purchases | 0 | 0 | NOT_TESTABLE | Estados visibles de compra |
| CH13-F03 | CH13 | P1 | VISIBLE | BLOCKED_CLIENT | UNVERIFIED | UNVERIFIED | UNVERIFIED | /purchases | 0 | 0 | CLIENT_DEFINITION | Elección de modalidad de compra |
| CH13-F04 | CH13 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /purchases | 0 | 0 | CLIENT_DEFINITION | Formulario de orden de compra |
| CH13-F05 | CH13 | P1 | VISIBLE | BLOCKED_CLIENT | UNVERIFIED | UNVERIFIED | UNVERIFIED | /purchases | 0 | 0 | CLIENT_DEFINITION | Tabla de ítems de orden |
| CH13-F06 | CH13 | P0 | VISIBLE | BLOCKED_CLIENT | UNVERIFIED | UNVERIFIED | UNVERIFIED | /purchases | 0 | 0 | CLIENT_DEFINITION | Formulario de compra por caja menuda |
| CH13-F07 | CH13 | P0 | VISIBLE | BLOCKED_CLIENT | UNVERIFIED | UNVERIFIED | UNVERIFIED | /purchases | 0 | 0 | CLIENT_DEFINITION | Desglose de totales de caja menuda |
| CH13-F08 | CH13 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /purchases | 0 | 0 | BLOCKED_INTEGRATION | Detalle de compra y adjuntos |
| CH13-F09 | CH13 | P0 | VISIBLE | BLOCKED_CLIENT | UNVERIFIED | UNVERIFIED | UNVERIFIED | /purchases | 0 | 0 | CLIENT_DEFINITION | Acciones sobre compra |
| CH13-F10 | CH13 | P0 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /purchases | 0 | 0 | NOT_TESTABLE | Relación de compras con inventario |
| CH13-F11 | CH13 | P0 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /purchases | 0 | 0 | NOT_TESTABLE | Reglas fiscales, de anulación y autorización |
| CH14-F01 | CH14 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /inventory | 2 | 1 | CLIENT_DEFINITION | Existencias disponibles, comprometidas y totales |
| CH14-F02 | CH14 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /inventory | 2 | 1 | CLIENT_DEFINITION | Historial de movimientos por item |
| CH14-F03 | CH14 | P0 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /inventory | 0 | 0 | NOT_TESTABLE | Inventario comprometido como estado temporal |
| CH14-F04 | CH14 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /inventory | 1 | 1 | CLIENT_DEFINITION | Panel de acuses por pacientes y recursos |
| CH14-F05 | CH14 | P0 | VISIBLE | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /inventory | 0 | 0 | NOT_TESTABLE | Gestión y exportación de acuses |
| CH14-F06 | CH14 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /inventory | 2 | 1 | CLIENT_DEFINITION | Cierres pendientes, totales y cerrados |
| CH14-F07 | CH14 | P0 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /inventory | 0 | 0 | CLIENT_DEFINITION | Advertencia de cierre ya abierto |
| CH14-F08 | CH14 | P0 | VISIBLE | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /inventory | 0 | 0 | NOT_TESTABLE | Aprobación de cierre total |
| CH14-F09 | CH14 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /inventory | 3 | 1 | CLIENT_DEFINITION | Catálogo de proveedores |
| CH14-F10 | CH14 | P0 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /inventory | 2 | 1 | CLIENT_DEFINITION | Catálogo de bodegas y traslados |
| CH14-F11 | CH14 | P0 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /inventory | 0 | 0 | CLIENT_DEFINITION | Lotes, números de serie y vencimiento |
| CH14-F12 | CH14 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /inventory | 2 | 1 | CLIENT_DEFINITION | Catálogo de kits de insumos |
| CH14-F13 | CH14 | P0 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /inventory | 0 | 0 | CLIENT_DEFINITION | Composición cuantificada del kit |
| CH14-F14 | CH14 | P0 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /inventory | 0 | 0 | CLIENT_DEFINITION | Creación de acuse para hospitalización |
| CH14-F15 | CH14 | P0 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /inventory | 0 | 0 | CLIENT_DEFINITION | Detección de items faltantes |
| CH14-F16 | CH14 | P1 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /inventory | 0 | 0 | CLIENT_DEFINITION | Vínculo de faltantes con cotización |
| CH15-F01 | CH15 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs | 0 | 0 | CLIENT_DEFINITION | Reconciliación de items faltantes |
| CH15-F02 | CH15 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs | 0 | 0 | CLIENT_DEFINITION | Solicitudes desde la casa del paciente |
| CH15-F03 | CH15 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs | 0 | 0 | CLIENT_DEFINITION | Alta manual de items en un acuse |
| CH15-F04 | CH15 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs | 0 | 0 | CLIENT_DEFINITION | Carga de acuse desde plantilla o cotización |
| CH15-F05 | CH15 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs | 0 | 0 | CLIENT_DEFINITION | Estados seleccionables de cotización |
| CH15-F06 | CH15 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /catalogs/medications | 2 | 1 | CLIENT_DEFINITION | Catálogo y alta de medicamentos |
| CH15-F07 | CH15 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs | 0 | 0 | CLIENT_DEFINITION | Advertencia por cambios no guardados |
| CH15-F08 | CH15 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /catalogs/supplies | 2 | 1 | CLIENT_DEFINITION | Catálogo y alta de insumos |
| CH15-F09 | CH15 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /catalogs/studies | 2 | 1 | CLIENT_DEFINITION | Catálogo de estudios diagnósticos |
| CH15-F10 | CH15 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /catalogs/fees | 2 | 1 | CLIENT_DEFINITION | Catálogo y alta de honorarios |
| CH15-F11 | CH15 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs | 0 | 0 | CLIENT_DEFINITION | Confirmación de guardado de honorario |
| CH15-F12 | CH15 | P1 | VISIBLE | PARTIAL | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs | 0 | 0 | CLIENT_DEFINITION | Acciones y edición de honorarios |
| CH15-F13 | CH15 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /catalogs/services | 2 | 1 | CLIENT_DEFINITION | Catálogo de servicios |
| CH15-F14 | CH15 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /catalogs/discounts | 2 | 1 | CLIENT_DEFINITION | Matriz de perfiles de descuento |
| CH15-F15 | CH15 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs | 0 | 0 | CLIENT_DEFINITION | Regla de lotes para consumos internos |
| CH15-F16 | CH15 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs | 0 | 0 | CLIENT_DEFINITION | Honorario vinculado a profesional |
| CH16-F01 | CH16 | P1 | VISIBLE | PARTIAL | VERIFIED | NOT_APPLICABLE | VERIFIED | /catalogs/discounts | 1 | 1 | CLIENT_DEFINITION | Matriz de descuentos por familia |
| CH16-F02 | CH16 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs/discounts | 0 | 0 | CLIENT_DEFINITION | Catálogo paginado y exportable |
| CH16-F03 | CH16 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs/discounts | 0 | 0 | CLIENT_DEFINITION | Perfiles con categorías excluidas |
| CH16-F04 | CH16 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs/discounts | 0 | 0 | CLIENT_DEFINITION | Alta de perfil de descuento |
| CH16-F05 | CH16 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs/discounts | 0 | 0 | CLIENT_DEFINITION | Marca de jubilado |
| CH16-F06 | CH16 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED |  | 0 | 0 | CLIENT_DEFINITION | Perfiles negociados por categoría |
| CH16-F07 | CH16 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /catalogs/discounts | 0 | 0 | CLIENT_DEFINITION | Recarga del catálogo después del alta |
| CH16-F08 | CH16 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | CLIENT_DEFINITION | Acceso al reporte de salud |
| CH16-F09 | CH16 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED |  | 0 | 0 | CLIENT_DEFINITION | Bloqueo de edición clínica tras guardar |
| CH17-F01 | CH17 | P1 | VISIBLE | PARTIAL | UNVERIFIED | NOT_APPLICABLE | UNVERIFIED | /clinical/reports | 1 | 1 | CLIENT_DEFINITION | Listado clínico con triage y auditoría |
| CH17-F02 | CH17 | P1 | VISIBLE | PARTIAL | UNVERIFIED | NOT_APPLICABLE | UNVERIFIED | /clinical/reports | 1 | 1 | CLIENT_DEFINITION | Acciones de la hospitalización |
| CH17-F03 | CH17 | P1 | VISIBLE | PARTIAL | UNVERIFIED | NOT_APPLICABLE | UNVERIFIED | /clinical/reports | 1 | 1 | CLIENT_DEFINITION | Reporte clínico por hospitalización |
| CH17-F04 | CH17 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Cambio de rango temporal |
| CH17-F05 | CH17 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Información principal del paciente |
| CH17-F06 | CH17 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Seguros seleccionables para impresión |
| CH17-F07 | CH17 | P2 | UNCERTAIN | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/hospitalizations | 0 | 0 | CLIENT_DEFINITION | Salida imprimible configurable |
| CH17-F08 | CH17 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Navegación de Evaluación Clínica |
| CH17-F09 | CH17 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Antecedentes clínicos estructurados |
| CH17-F10 | CH17 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Captura de alergias desde catálogo |
| CH17-F11 | CH17 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Signos vitales agrupados por origen |
| CH17-F12 | CH17 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Listado de notas de enfermería |
| CH17-F13 | CH17 | P1 | VISIBLE | MISSING | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Edición de nota clínica |
| CH17-F14 | CH17 | P2 | VISIBLE | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Auditoría de nota con IA |
| CH17-F15 | CH17 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Restricción de edición por rol |
| CH17-F16 | CH17 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Aplicación operativa de enfermería |
| CH17-F17 | CH17 | P2 | VERBAL | NOT_TESTABLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | /clinical/reports | 0 | 0 | CLIENT_DEFINITION | Compartir nota de enfermería por WhatsApp |

## Veredicto automÃ¡tico

**TRAZABILIDAD COMPLETA:** todos los gaps no EXACT estÃ¡n acompaÃ±ados por una restricciÃ³n/bloqueo explÃ­cito. Esto no autoriza inventar reglas ni habilitar funciones sensibles sin aprobaciÃ³n.

