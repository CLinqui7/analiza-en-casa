# Auditoría exhaustiva de paridad con el video

## Analiza en Casa · React/Next

- **Fecha del corte:** 29 de agosto de 2026.
- **Repositorio:** `CLinqui7/analiza-en-casa`.
- **Rama revisada:** `codex/react-full-parity-selenium-100`.
- **SHA remoto revisado:** `77d3998e1eb95a677112a6ff65eb0956c781536e`.
- **Alcance:** código confirmado en GitHub. Los cambios locales de Seguros que Codex todavía no haya enviado no forman parte de este corte.
- **Base de video:** 17 capítulos, 1,359 eventos revisados y 210 requisitos canónicos reconstruidos.

> Regla estricta: una ruta no se considera idéntica al video si faltan columnas, controles, subflujos, estados, modales, catálogos, vínculos o resultados visibles, aunque la pantalla exista y sus pruebas pasen.

## Conclusión ejecutiva

**No, todavía no están todas las funciones del video en React.**

- Coincidencia funcional sustancial: **29/210 (13.8%)**.
- Implementación parcial: **48/210 (22.9%)**.
- Funciones o superficies que faltan: **90/210 (42.9%)**.
- Bloqueos por decisión del cliente: **34/210 (16.2%)**.
- Bloqueos por integración externa: **2/210 (1.0%)**.
- Resultados que el propio video no demuestra: **7/210 (3.3%)**.

En total, **77/210 (36.7%)** tienen al menos una implementación reconocible. La cobertura fuerte está concentrada en Pacientes, Hospitalizaciones administrativas y Cotizaciones; la brecha grande comienza en Cuentas por cobrar/Pagos y crece en Clínica, Agenda, Cuentas por pagar, Compras, Inventario avanzado, Catálogos y Descuentos.

## Defectos de gobernanza QA detectados

1. El Dashboard afirma `Faltantes en matriz = 0`, aunque la matriz React conserva rutas `MISSING` y `MIGRATED_PARTIAL`.
2. `MIGRATED_EXACT` se usa como etiqueta de ruta, no como prueba de paridad control por control.
3. `MASTER_VIDEO_REQUIREMENTS` y `VIDEO_VS_PLATFORM_GAP_MATRIX` no se han regenerado como verdad actual de React requisito por requisito.
4. Selenium certifica bien las acciones que existen, pero no puede detectar controles del video que nunca fueron migrados.

## Situación por rutas React

- **7 rutas marcadas exactas:** Dashboard, Pacientes, Detalle de paciente, Edición de paciente, Hospitalizaciones, Cotizaciones y Ayuda.
- **20 rutas parciales:** Seguros, Cuentas por cobrar, Pagos, superficies clínicas, Enfermería, Agenda, Horas, Compras, Inventario, Movimientos, Kárdex, Catálogos, Auditoría y Portal.
- **13 rutas ausentes:** Cuentas por pagar, Acuses/compromisos, Cierres, Bodegas, Kits, Lotes/series, Proveedores, Descuentos, Médicos, Estados de cuenta profesionales, Reportes, Configuración y QA.

## Matriz capítulo por capítulo

### CH01 · Contexto inicial, acceso, dashboard y listado de pacientes

**Resumen:** COINCIDE: 4, PARCIAL: 6, FALTA: 4.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH01-F001 | Acceso mediante ruta directa al módulo de pacientes | **PARCIAL** | Existe /patients protegido por sesión. | No existe compatibilidad/redirect explícito para la ruta observada /pacientes.php ni prueba del retorno exacto. |
| CH01-F002 | Listado de pacientes | **COINCIDE** | Listado React operativo con activos/inactivos, búsqueda, detalle y acciones. | La presentación no es idéntica, pero la función base está. |
| CH01-F003 | Columnas del catálogo de pacientes | **PARCIAL** | Muestra paciente, documento, aseguradora, contacto y acción. | Faltan edad, empresa en tabla, triage, notificación Botmaker y estado como columnas visibles. |
| CH01-F004 | Búsqueda y paginación de pacientes | **COINCIDE** | Búsqueda normalizada, selector de tamaño y navegación de páginas. | Sin brecha funcional mayor. |
| CH01-F005 | Exportar y crear paciente | **PARCIAL** | Crear paciente y exportar CSV funcionan. | El video muestra Excel; la plataforma ofrece CSV y no replica exactamente el formato. |
| CH01-F006 | Estados de carga y vacío de tabla | **COINCIDE** | Estados de carga/error/vacío explícitos. | Sin brecha funcional mayor. |
| CH01-F007 | Indicadores de triage, notificación y estado | **FALTA** | Solo existe estado activo/inactivo como acción. | No hay triage ni indicador/consentimiento Botmaker por fila. |
| CH01-F008 | Menú lateral colapsable y jerárquico | **PARCIAL** | Clínico, Inventario y Reportes son grupos colapsables. | Faltan varios grupos/rutas observados y la jerarquía completa del video. |
| CH01-F009 | Dashboard operativo | **PARCIAL** | Dashboard con métricas sintéticas, mediciones y auditoría. | No conserva las seis tarjetas exactas ni sus significados; añade métricas distintas. |
| CH01-F010 | Pacientes con valores fuera de rango | **FALTA** | Muestra mediciones recientes sin clasificar. | No existe sección de valores fuera de rango/Normales ni reglas de umbral. |
| CH01-F011 | Menú de usuario y contexto organizacional | **FALTA** | Muestra rol/entorno en sidebar. | No existe menú de usuario con organización y “Mi usuario” como en el video. |
| CH01-F012 | Cierre de sesión | **COINCIDE** | Cerrar sesión elimina la sesión y vuelve al login. | Sin brecha funcional mayor. |
| CH01-F013 | Formulario de inicio de sesión | **PARCIAL** | Correo, contraseña e iniciar sesión. | Falta recuperación de contraseña visible; además usa correo en lugar de la etiqueta Usuario del video. |
| CH01-F014 | Instalación en dispositivo aparente | **FALTA** | No existe control PWA/instalación en el login React. | Implementar manifest/service worker y prompt seguro si es requisito real. |

### CH02 · Alta y edición de pacientes

**Resumen:** COINCIDE: 9, PARCIAL: 4, FALTA: 2, BLOQUEADO_CLIENTE: 1.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH02-F001 | Ruta autenticada hasta Pacientes | **COINCIDE** | Login, dashboard y ruta protegida a Pacientes. | Sin brecha funcional mayor. |
| CH02-F002 | Listado de pacientes con vistas y acciones | **PARCIAL** | Activos, inactivos, importar, exportar, nuevo, búsqueda y paginación. | Carga masiva no es pestaña y faltan columnas operativas del video. |
| CH02-F003 | Formulario de alta por secciones | **COINCIDE** | Datos generales, seguro, contactos y dirección en secciones. | Sin brecha funcional mayor. |
| CH02-F004 | Datos personales obligatorios y opcionales | **COINCIDE** | Incluye los campos personales principales y validación. | Catálogos de algunos campos siguen como texto libre. |
| CH02-F005 | Documento y fecha de nacimiento | **COINCIDE** | DUI/Pasaporte/Otro, limpieza al cambiar y fecha. | Formato oficial fuera del DUI demo sigue configurable. |
| CH02-F006 | Selectores demográficos y organizacionales | **PARCIAL** | Sexo y sangre son selectores; empresa/estado civil/nacionalidad/ocupación existen. | Varios campos son texto libre, no catálogos buscables como se observa. |
| CH02-F007 | Consentimiento visible para notificaciones Botmaker/WhatsApp | **FALTA** | No existe campo de consentimiento de mensajería en el modelo/formulario React. | Agregar consentimiento, fuente, fecha y revocación sin mezclarlo con datos clínicos. |
| CH02-F008 | Paciente regular frente a paciente asegurado | **COINCIDE** | Selector REGULAR/INSURED y campos condicionales. | La política de cobertura sigue correctamente sin inferirse. |
| CH02-F009 | Catálogo buscable de seguros | **PARCIAL** | Selector con dos aseguradoras sintéticas. | No es buscable ni usa un maestro real. |
| CH02-F010 | Resultados anómalos en el catálogo de seguros | **BLOQUEADO_CLIENTE** | No se replicó el comportamiento anómalo. | El video no aclara si las entradas con apariencia de persona son válidas o un defecto. |
| CH02-F011 | Decisión de titularidad del seguro | **COINCIDE** | Checkbox de titularidad y datos del titular. | No existe lógica de múltiples coberturas. |
| CH02-F012 | Datos condicionales de cobertura | **COINCIDE** | Póliza, certificado/unidad, titular, fechas condicionales. | Validaciones oficiales de póliza/cobertura siguen pendientes. |
| CH02-F013 | Contactos asociados al paciente | **COINCIDE** | Múltiples contactos, principal, agregar y eliminar. | Catálogos de parentesco/rol/país siguen como texto libre. |
| CH02-F014 | Dirección con importación y limpieza | **PARCIAL** | Enlace, coordenadas, dirección, referencia y limpiar funcionan. | Consultar enlace solo muestra aviso; no importa una dirección real. |
| CH02-F015 | Mapa embebido para ubicación geográfica | **FALTA** | No hay mapa embebido ni marcador. | Requiere proveedor y política de geolocalización. |
| CH02-F016 | Acciones Atrás y Guardar sin resultado observado | **COINCIDE** | Cancelar/guardar con validación, persistencia y edición. | El video no demuestra el resultado exacto, pero la plataforma implementa un flujo seguro. |

### CH03 · Hospitalización y navegación de preautorizaciones

**Resumen:** COINCIDE: 4, PARCIAL: 7, BLOQUEADO_CLIENTE: 2.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH03-F001 | Menú financiero desde Pacientes | **PARCIAL** | Existen Cotizaciones, Seguros, CxC y Pagos como rutas globales. | No existe el mismo menú contextual desde cada paciente. |
| CH03-F002 | Panel y pestañas de Hospitalización Administrativa | **PARCIAL** | Listado, filtros, creación, detalle y edición de hospitalizaciones. | No replica el panel/tablero y pestañas exactas del video. |
| CH03-F003 | Pestaña Preadmisión transitoria | **BLOQUEADO_CLIENTE** | No se implementó. | La evidencia no determina si es función habilitable o residuo de renderizado. |
| CH03-F004 | Filtros de hospitalizaciones activas | **COINCIDE** | Estado, fecha de inicio y tipo de cuenta, con reset. | Sin brecha funcional mayor para los filtros visibles. |
| CH03-F005 | Tabla de hospitalizaciones activas | **COINCIDE** | Tabla con caso, documento, paciente, fecha, cuenta, estado, responsable y próxima acción. | Sin brecha funcional mayor. |
| CH03-F006 | Interpretación verbal de hospitalización activa | **BLOQUEADO_CLIENTE** | No se automatizan cierres/transiciones. | No hay regla confirmada para crear/cerrar estado activo. |
| CH03-F007 | Vista de pacientes inactivos | **PARCIAL** | Pacientes tiene pestaña Inactivos. | No está integrada al panel administrativo observado en este capítulo. |
| CH03-F008 | Carga y estado vacío simultáneos | **COINCIDE** | React separa carga, error y vacío. | Corrige la ambigüedad observada en el video. |
| CH03-F009 | Filtros y alta desde Cotizaciones | **PARCIAL** | Cotizaciones tiene búsqueda y alta. | No replica todos los filtros del listado observado. |
| CH03-F010 | Seguimiento de cotización, preautorización, seguro y reclamo | **PARCIAL** | Cotización enlaza a Seguro y Pagos; Insurance está en desarrollo. | Falta flujo completo de preautorización/reclamo e historial. |
| CH03-F011 | Fecha de creación y total por cotización | **COINCIDE** | Listado/detalle de cotizaciones muestra creación y cálculos. | Sin brecha funcional mayor. |
| CH03-F012 | Nueva cotización y datos del paciente | **PARCIAL** | Paciente se deriva de la hospitalización. | No hay selector buscable de paciente ni snapshot completo visible. |
| CH03-F013 | Datos iniciales de factura | **PARCIAL** | Caso, paciente, resumen/comentarios y constructor. | Faltan fecha de factura, grupo de descuento, referido por y giftcard. |

### CH04 · Cotización: datos generales

**Resumen:** PARCIAL: 4, FALTA: 5, BLOQUEADO_CLIENTE: 2.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH04-F001 | Nueva cotización por secciones | **PARCIAL** | Constructor por categorías, resumen, comentarios y totales. | Faltan varias secciones de cabecera observadas. |
| CH04-F002 | Selector buscable de paciente | **FALTA** | Se elige hospitalización; el paciente se deriva. | No existe búsqueda directa de paciente por nombre/documento. |
| CH04-F003 | Resultados de paciente con etiquetas de cotización | **BLOQUEADO_CLIENTE** | No se replicaron etiquetas ambiguas. | El video no explica qué significa una entrada rotulada Cotización. |
| CH04-F004 | Autocompletado de datos del paciente | **PARCIAL** | Nombre/paciente se deriva del caso. | No muestra snapshot de DUI/NIT, teléfono y correo como en el video. |
| CH04-F005 | Fecha requerida con calendario | **FALTA** | Quote React no captura invoiceDate. | Agregar fecha con zona/rangos configurables. |
| CH04-F006 | Grupo de descuento obligatorio | **FALTA** | Existe descuento manual por tipo, no grupo de descuento. | Falta catálogo/grupo y elegibilidad/aprobación. |
| CH04-F007 | Referido por como multiselección buscable | **FALTA** | No existe referido por. | Agregar multiselección/tagging con catálogo autorizado. |
| CH04-F008 | Catálogo heterogéneo de referidos | **BLOQUEADO_CLIENTE** | No existe catálogo. | Falta definir tipos, alcance y máximo de etiquetas. |
| CH04-F009 | Acción auxiliar para Referido por | **FALTA** | No existe botón + ni alta provisional. | Implementar solo tras definir catálogo y deduplicación. |
| CH04-F010 | Giftcard y Comentarios | **PARCIAL** | Comentarios sí; giftcard no. | Falta captura/validación de giftcard. |
| CH04-F011 | Categorías de ítems y filtro de inventario | **PARCIAL** | Las siete categorías existen. | Falta “Solo disponibles en inventario” y vínculo real con existencias. |

### CH05 · Cotización: servicios, estudios y medicamentos

**Resumen:** COINCIDE: 4, PARCIAL: 2, FALTA: 8, NO_DEMOSTRABLE: 1.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH05-F001 | Categorías de conceptos en Nueva cotización | **COINCIDE** | Servicios, estudios, medicamentos, insumos, equipos, honorarios y extras. | Sin brecha funcional mayor. |
| CH05-F002 | Socio de negocios selecciona catálogo de precios | **FALTA** | No existe socio/lista de precios. | Requiere maestro y reglas de vigencia/moneda. |
| CH05-F003 | Bloqueo visual Procesando durante cargas y adiciones | **FALTA** | No hay overlay/estado Procesando en el compositor. | Agregar estado de carga si hay operaciones asíncronas. |
| CH05-F004 | Catálogo de Servicios con búsqueda incremental | **FALTA** | Concepto es texto manual. | Falta catálogo buscable. |
| CH05-F005 | Selección de servicio autocompleta precio | **FALTA** | Precio es manual. | Falta tarifario autorizado. |
| CH05-F006 | Cantidad requerida y acción Añadir | **COINCIDE** | Cantidad validada y acción agregar línea. | Sin brecha funcional mayor. |
| CH05-F007 | Ledger de conceptos agrupado por tipo | **COINCIDE** | Items se visualizan por categoría y se detallan por versión. | Sin brecha funcional mayor. |
| CH05-F008 | Resumen de subtotal, descuentos, impuesto y total | **PARCIAL** | Subtotal, descuentos, total, aseguradora y paciente. | Falta impuesto porque tasa/base no están confirmadas. |
| CH05-F009 | Múltiples líneas de Servicios | **COINCIDE** | Admite varias líneas por categoría. | Sin brecha funcional mayor. |
| CH05-F010 | Compositor específico de Medicamentos | **FALTA** | Medicamentos usa el mismo editor genérico. | Faltan medicamento/presentación y controles específicos. |
| CH05-F011 | Catálogo de medicamentos muestra conteos entre paréntesis | **FALTA** | No hay catálogo de medicamentos. | Falta maestro y significado del conteo. |
| CH05-F012 | Estado sin resultados en búsqueda | **FALTA** | No hay búsqueda de catálogo. | Agregar al implementar catálogos. |
| CH05-F013 | Selección de medicamento autocompleta precio | **FALTA** | Precio manual. | Falta catálogo/tarifario autorizado. |
| CH05-F014 | Intento de añadir Invanz restablece el compositor | **NO_DEMOSTRABLE** | No se replica un resultado no visible. | El video no confirma si la línea se insertó. |
| CH05-F015 | Filtro de inventario y acciones finales visibles | **PARCIAL** | Guardar/cancelar existen. | Falta filtro de disponibilidad y relación con reservas/lotes. |

### CH06 · Cotización: insumos, equipos, honorarios, extras y totales

**Resumen:** COINCIDE: 4, PARCIAL: 4, FALTA: 2.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH06-F01 | Categorías de ítems de cotización | **COINCIDE** | Siete categorías implementadas. | Sin brecha funcional mayor. |
| CH06-F02 | Catálogo por socio de negocios | **FALTA** | No existe. | Requiere maestro y lista de precios. |
| CH06-F03 | Selección de insumos con existencia | **FALTA** | Insumos son texto/precio manual. | No consulta existencias, lotes ni bodegas. |
| CH06-F04 | Selección de estudios diagnósticos | **PARCIAL** | Categoría Estudios existe con líneas manuales. | Falta catálogo buscable y autofill. |
| CH06-F05 | Honorarios por profesional o servicio | **PARCIAL** | Categoría Honorarios existe. | No vincula profesional ni tarifa. |
| CH06-F06 | Tabla agrupada y cálculo por renglón | **COINCIDE** | Cantidad, precio, descuento y subtotal por línea. | Sin brecha funcional mayor. |
| CH06-F07 | Descuentos, impuesto y totales | **PARCIAL** | Descuento manual y totales. | Falta impuesto y política por renglón. |
| CH06-F08 | Autocompletado por paciente | **COINCIDE** | Paciente se deriva del caso/hospitalización. | Sin brecha funcional mayor. |
| CH06-F09 | Persistencia y retroceso | **COINCIDE** | Borrador, editar/cancelar, reload y detalle. | El resultado exacto del video no se ve, pero el flujo actual es verificable. |
| CH06-F10 | Contenido de Equipos y Extras | **PARCIAL** | Ambas categorías aceptan líneas manuales. | No hay catálogos/campos específicos. |

### CH07 · Preautorización, seguro y reclamo

**Resumen:** COINCIDE: 2, PARCIAL: 3, BLOQUEADO_CLIENTE: 2, BLOQUEADO_INTEGRACION: 1, NO_DEMOSTRABLE: 1.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH07-F01 | Listado de cotizaciones de hospitalización | **COINCIDE** | Listado de cotizaciones vinculadas a casos. | Sin brecha funcional mayor. |
| CH07-F02 | Estados de cotización, preautorización y reclamo | **PARCIAL** | Cotización tiene DRAFT/SENT; seguro está en desarrollo. | Faltan estados completos de preautorización y reclamo. |
| CH07-F03 | Búsqueda de cotización | **COINCIDE** | Busca ID, paciente, caso y estado. | Sin brecha funcional mayor. |
| CH07-F04 | Menú contextual y documentos | **PARCIAL** | Detalle ofrece editar, enviar, revisar, imprimir, seguro, pagos y canales seguros. | Faltan menú/documentos exactos, duplicar/eliminar y variantes impresas. |
| CH07-F05 | Envío por correo o WhatsApp | **BLOQUEADO_INTEGRACION** | WhatsApp muestra estado seguro no configurado; email no existe. | No hay proveedor ni evidencia de entrega. |
| CH07-F06 | Generación y envío directo de PDF | **BLOQUEADO_CLIENTE** | Solo window.print; no PDF oficial. | No se conoce variante/documento oficial ni canal. |
| CH07-F07 | Transiciones de estado | **BLOQUEADO_CLIENTE** | No se inventó la máquina de estados. | Falta confirmar eventos, permisos e idempotencia. |
| CH07-F08 | Cotización guardada pero no activada | **PARCIAL** | DRAFT persistente representa guardada no enviada. | El significado “activada” sigue sin definición. |
| CH07-F09 | Resultado de una transición de estado | **NO_DEMOSTRABLE** | No se implementa resultado no observado. | El video solo abre selector, sin confirmar transición. |

### CH08 · Perfil administrativo, cuentas por cobrar y pagos

**Resumen:** PARCIAL: 1, FALTA: 9, BLOQUEADO_CLIENTE: 2.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH08-F01 | Perfil administrativo de ejecución | **FALTA** | No existe perfil administrativo completo. | Crear formulario y detalle administrativo. |
| CH08-F02 | Campos administrativos y de aseguradora | **FALTA** | No existen health manager, revenue, solicitud, forma de pago, categoría, hospital de origen, etc. | Requiere modelos/catálogos. |
| CH08-F03 | Guardado del perfil administrativo | **FALTA** | No existe el perfil que guardar. | Implementar persistencia y auditoría. |
| CH08-F04 | Listado de cuentas por cobrar y exportaciones | **FALTA** | /receivables reutiliza la tabla simple de pagos. | Falta listado de cuentas/saldos, filtros y Excel/reporte. |
| CH08-F05 | Acciones de una cuenta | **FALTA** | Solo aplicar/reversar pagos. | Faltan historial, estado de cuenta, archivar, reporte y acciones de cuenta. |
| CH08-F06 | Histórico de estados de cuenta | **FALTA** | No existe historial de estados de cuenta. | Implementar snapshots/versiones. |
| CH08-F07 | Pagos de hospitalización | **PARCIAL** | Aplicar pago idempotente y reversar con motivo. | Falta asignación por cuenta/caso, edición, eliminación y conciliación. |
| CH08-F08 | Configuración de estado de cuenta | **FALTA** | No existe. | Implementar selección de período/secciones/ajustes cuando se confirmen. |
| CH08-F09 | Vista previa de cuenta del paciente | **FALTA** | No existe preview. | Implementar composición y cálculo seguro. |
| CH08-F10 | Resumen de pago | **FALTA** | No existe vista detallada/imprimible del pago. | Implementar detalle y print si se confirma. |
| CH08-F11 | Interpretación de total pendiente negativo | **BLOQUEADO_CLIENTE** | No se interpreta automáticamente. | Definir si representa crédito, sobrepago o inconsistencia. |
| CH08-F12 | Estado de cuenta automático | **BLOQUEADO_CLIENTE** | No existe generación automática. | Falta periodicidad, destinatario y canal seguro. |

### CH09 · Hospitalización clínica y reporte de salud

**Resumen:** PARCIAL: 4, FALTA: 6, BLOQUEADO_CLIENTE: 2, NO_DEMOSTRABLE: 2.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH09-F01 | Listado de Hospitalización Clínica | **PARCIAL** | Lista hospitalizaciones y cuenta documentos. | Faltan triage, auditoría y columnas clínicas. |
| CH09-F02 | Acciones de una hospitalización clínica | **FALTA** | Solo enlace genérico a evoluciones. | Faltan menú/acciones clínicas por caso. |
| CH09-F03 | Versiones de perfiles clínicos por hospitalización | **FALTA** | No existe ClinicalProfile versionado. | Implementar perfil con historial inmutable. |
| CH09-F04 | Formulario de perfil clínico | **FALTA** | No existe. | Faltan datos clínicos estructurados observados. |
| CH09-F05 | Catálogo codificado de diagnósticos | **BLOQUEADO_CLIENTE** | No existe catálogo. | Debe confirmarse estándar/versión y fuente autorizada. |
| CH09-F06 | Grupos operativos del perfil | **FALTA** | No existen grupos/subgrupos, triage, tipo/frecuencia. | Implementar estructura una vez confirmados catálogos. |
| CH09-F07 | Dispositivos y planificación de turnos | **PARCIAL** | Hospitalización guarda dispositivos y Agenda crea turnos. | No están integrados al perfil clínico ni generan planificación por frecuencia. |
| CH09-F08 | Listado de Reporte de salud y menú clínico | **PARCIAL** | Ruta Reporte de salud y pestañas. | Falta listado por hospitalización con menú clínico completo. |
| CH09-F09 | Reporte longitudinal por pestañas | **PARCIAL** | Siete pestañas existen. | La mayoría son placeholders o vacías. |
| CH09-F10 | Cambio de rango del reporte | **FALTA** | No hay selector de rango. | Implementar fechas/rangos. |
| CH09-F11 | Configuración de secciones para impresión | **FALTA** | No hay modal de secciones ni print del reporte. | Implementar configurador. |
| CH09-F12 | Resultado de Imprimir no demostrado | **NO_DEMOSTRABLE** | No existe impresión clínica equivalente. | El video tampoco demuestra un PDF final. |
| CH09-F13 | Intervalo visual discontinuo antes de repetir la confirmación | **NO_DEMOSTRABLE** | No se infiere funcionalidad. | No hay evidencia continua. |
| CH09-F14 | Contenido del expediente impreso descrito verbalmente | **BLOQUEADO_CLIENTE** | No se implementa contenido descrito solo verbalmente. | Confirmar secciones, orden y permisos. |

### CH10 · Orden médica, tratamientos y tarjeta de medicamentos

**Resumen:** PARCIAL: 1, FALTA: 5, BLOQUEADO_CLIENTE: 3, NO_DEMOSTRABLE: 1.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH10-F01 | Listado de pacientes de Orden Médica | **PARCIAL** | La ruta busca pacientes y muestra cantidad coincidente. | No lista órdenes por paciente ni abre expediente de orden. |
| CH10-F02 | Elección de tipo de documento | **FALTA** | No existe selector de tipo de documento en Órdenes. | Agregar si forma parte del flujo real. |
| CH10-F03 | Encabezado y tratamientos de tarjeta | **FALTA** | No existe tarjeta de medicamentos funcional. | La ruta Medication Cards es solo bloqueo. |
| CH10-F04 | Editor detallado de tratamiento | **FALTA** | No existe. | Faltan medicamento, dosis, vía, frecuencia, duración, horarios, dilución y crónico. |
| CH10-F05 | Catálogos visibles de pauta y horarios | **BLOQUEADO_CLIENTE** | No existen. | Requiere catálogos oficiales y reglas. |
| CH10-F06 | Derivación aparente de fecha final | **BLOQUEADO_CLIENTE** | No existe cálculo. | Debe confirmarse inclusividad, zona horaria y crónicos. |
| CH10-F07 | Composición de orden por etiquetas | **FALTA** | No existen etiquetas de orden. | Implementar catálogo/ordenamiento tras confirmar reglas. |
| CH10-F08 | Consulta de órdenes, tarjetas e historial | **FALTA** | La ruta actual solo guarda acciones locales no clínicas. | Implementar persistencia de órdenes/tarjetas/historial. |
| CH10-F09 | Impresiones de tarjeta de medicamentos | **BLOQUEADO_CLIENTE** | No existe impresión. | Falta plantilla y contenido oficial. |
| CH10-F10 | Permisos y corrección clínica | **NO_DEMOSTRABLE** | Hay guardas genéricas, no flujo de orden/tarjeta. | El video no define permisos ni corrección completa. |

### CH11 · Agenda y turnos

**Resumen:** PARCIAL: 1, FALTA: 5, BLOQUEADO_CLIENTE: 3.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH11-F01 | Agenda filtrable por paciente | **FALTA** | Agenda lista turnos sin filtros. | Agregar búsqueda/filtro por paciente. |
| CH11-F02 | Navegación y vistas de calendario | **FALTA** | Solo tabla cronológica. | Faltan calendario día/semana/mes y navegación. |
| CH11-F03 | Formulario de creación de visita | **PARCIAL** | Modal crea turno con recurso, paciente, inicio/fin, estado y nota. | Faltan campos y semántica de visita observados. |
| CH11-F04 | Clasificación puntual o turno | **FALTA** | No existe selector puntual/turno. | Agregar distinción y reglas. |
| CH11-F05 | Catálogo de tipos de visita | **FALTA** | No existe. | Implementar maestro de tipos. |
| CH11-F06 | Detalle de visita finalizada | **FALTA** | No hay vista de detalle. | Implementar consulta de visita completada. |
| CH11-F07 | Tipo de atención en liquidación | **BLOQUEADO_CLIENTE** | No existe liquidación. | Definir categorías y efecto financiero. |
| CH11-F08 | Ajustes al pago de servicio profesional | **BLOQUEADO_CLIENTE** | No existe. | Definir adiciones/descuentos, autorización y relación con CxP. |
| CH11-F09 | Reglas de liquidación y permisos | **BLOQUEADO_CLIENTE** | No existe máquina de liquidación. | Confirmar reglas y roles. |

### CH12 · Cuentas por pagar y pagos de servicios

**Resumen:** FALTA: 6, BLOQUEADO_CLIENTE: 2.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH12-F01 | Resumen de cuentas por pagar | **FALTA** | La ruta /payables no existe. | Crear módulo y métricas. |
| CH12-F02 | Listado de pagos de servicios | **FALTA** | Pagos actuales son de cotizaciones/pacientes, no pagos profesionales. | Crear listado específico. |
| CH12-F03 | Acciones de pagos y reportes | **BLOQUEADO_CLIENTE** | No existen. | Falta definir acciones, documentos y permisos. |
| CH12-F04 | Filtro de pagos | **FALTA** | No existe en un módulo profesional. | Implementar filtros observados. |
| CH12-F05 | Edición de pago de servicio profesional | **FALTA** | No existe. | Implementar modal y persistencia. |
| CH12-F06 | Conceptos de adición o descuento | **FALTA** | No existe. | Agregar líneas y cálculo cuando reglas se confirmen. |
| CH12-F07 | Catálogo visible de motivos | **FALTA** | No existe. | Implementar catálogo de motivos observado. |
| CH12-F08 | Reglas financieras de montos y aprobación | **BLOQUEADO_CLIENTE** | No se automatizan. | Confirmar cálculo, topes, aprobación y auditoría. |

### CH13 · Compras y compras al por mayor

**Resumen:** PARCIAL: 2, FALTA: 6, BLOQUEADO_CLIENTE: 3.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH13-F01 | Listado de compras | **PARCIAL** | Lista borradores sintéticos. | Faltan más columnas, estados y acciones. |
| CH13-F02 | Estados visibles de compra | **BLOQUEADO_CLIENTE** | Solo DRAFT. | Falta máquina de estados y autorizaciones. |
| CH13-F03 | Elección de modalidad de compra | **FALTA** | No existe orden vs caja menuda. | Agregar selector y formularios distintos. |
| CH13-F04 | Formulario de orden de compra | **PARCIAL** | Solo ítem, referencia y nota. | Faltan proveedor, líneas, cantidades, costos, impuestos y fechas. |
| CH13-F05 | Tabla de ítems de orden | **FALTA** | Una compra referencia un solo catalogItemId. | Agregar múltiples líneas. |
| CH13-F06 | Formulario de compra por caja menuda | **FALTA** | No existe. | Implementar modalidad. |
| CH13-F07 | Desglose de totales de caja menuda | **FALTA** | No existe. | Implementar subtotales/impuestos/total según reglas. |
| CH13-F08 | Detalle de compra y adjuntos | **FALTA** | No hay detalle ni archivos. | Implementar rutas, adjuntos y políticas de seguridad. |
| CH13-F09 | Acciones sobre compra | **FALTA** | No existen ver/editar/anular/recibir/reportar. | Implementar acciones sustentadas. |
| CH13-F10 | Relación de compras con inventario | **BLOQUEADO_CLIENTE** | Guardar borrador no afecta stock. | Definir recepción, lotes y transición autorizada. |
| CH13-F11 | Reglas fiscales, de anulación y autorización | **BLOQUEADO_CLIENTE** | No se inventan. | Confirmar impuestos/documentos/roles. |

### CH14 · Inventario, movimientos, acuses, cierres, bodegas y kits

**Resumen:** COINCIDE: 1, PARCIAL: 2, FALTA: 7, BLOQUEADO_CLIENTE: 6.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH14-F01 | Existencias disponibles, comprometidas y totales | **PARCIAL** | Muestra saldo total derivado de movimientos. | Faltan disponible, comprometido y total por ítem. |
| CH14-F02 | Historial de movimientos por item | **COINCIDE** | Kárdex cronológico, filtros y saldo derivado. | Sin brecha funcional mayor para historial base. |
| CH14-F03 | Inventario comprometido como estado temporal | **BLOQUEADO_CLIENTE** | No existe reserva/compromiso. | Definir ciclo, expiración y liberación. |
| CH14-F04 | Panel de acuses por pacientes y recursos | **FALTA** | No existe ruta/panel. | Crear módulo de reservas/acuses. |
| CH14-F05 | Gestión y exportación de acuses | **BLOQUEADO_CLIENTE** | No existe. | Definir estados, permisos y exportación. |
| CH14-F06 | Cierres pendientes, totales y cerrados | **FALTA** | No existe ruta de cierres. | Crear módulo. |
| CH14-F07 | Advertencia de cierre ya abierto | **FALTA** | No hay cierres, por tanto tampoco guardia. | Implementar unicidad de cierre abierto. |
| CH14-F08 | Aprobación de cierre total | **BLOQUEADO_CLIENTE** | No existe. | Definir aprobación y efectos. |
| CH14-F09 | Catálogo de proveedores | **FALTA** | Ruta Suppliers no existe. | Crear maestro. |
| CH14-F10 | Catálogo de bodegas y traslados | **PARCIAL** | Hay dos bodegas hardcodeadas y tipo TRANSFER. | Falta maestro, origen/destino y movimiento contraparte. |
| CH14-F11 | Lotes, números de serie y vencimiento | **FALTA** | No existe. | Crear lotes/series/expiración. |
| CH14-F12 | Catálogo de kits de insumos | **FALTA** | No existe. | Crear maestro de kits. |
| CH14-F13 | Composición cuantificada del kit | **BLOQUEADO_CLIENTE** | No existe. | Definir reglas de consumo/descarga y composición. |
| CH14-F14 | Creación de acuse para hospitalización | **FALTA** | No existe. | Vincular hospitalización, items y cantidades. |
| CH14-F15 | Detección de items faltantes | **BLOQUEADO_CLIENTE** | No existe. | Definir disponibilidad, sustitución y timing. |
| CH14-F16 | Vínculo de faltantes con cotización | **BLOQUEADO_CLIENTE** | No existe. | Definir cuándo/como genera o modifica cotización. |

### CH15 · Acuse de inventario y catálogos de ítems

**Resumen:** FALTA: 13, BLOQUEADO_CLIENTE: 3.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH15-F01 | Reconciliación de items faltantes | **FALTA** | No existe flujo de acuses. | Implementar conciliación. |
| CH15-F02 | Solicitudes desde la casa del paciente | **FALTA** | No existe. | Implementar canal/registro y seguridad. |
| CH15-F03 | Alta manual de items en un acuse | **FALTA** | No existe. | Agregar editor de acuse. |
| CH15-F04 | Carga de acuse desde plantilla o cotización | **FALTA** | No existe. | Implementar plantillas y vínculo con quote. |
| CH15-F05 | Estados seleccionables de cotización | **BLOQUEADO_CLIENTE** | No existe en acuse. | Definir significado y permisos. |
| CH15-F06 | Catálogo y alta de medicamentos | **FALTA** | Catálogo actual solo SKU/nombre genérico. | Crear catálogo por familia y alta específica. |
| CH15-F07 | Advertencia por cambios no guardados | **FALTA** | No existe guardia global de formularios complejos. | Implementar dirty-state/confirmación. |
| CH15-F08 | Catálogo y alta de insumos | **FALTA** | No existe catálogo específico. | Crear familia y atributos. |
| CH15-F09 | Catálogo de estudios diagnósticos | **FALTA** | No existe. | Crear maestro. |
| CH15-F10 | Catálogo y alta de honorarios | **FALTA** | No existe. | Crear maestro. |
| CH15-F11 | Confirmación de guardado de honorario | **FALTA** | No existe. | Agregar persistencia y feedback. |
| CH15-F12 | Acciones y edición de honorarios | **FALTA** | No existe. | Agregar listar/editar/inactivar. |
| CH15-F13 | Catálogo de servicios | **FALTA** | No existe catálogo específico. | Crear maestro. |
| CH15-F14 | Matriz de perfiles de descuento | **FALTA** | Ruta Discounts no existe. | Crear perfiles/reglas. |
| CH15-F15 | Regla de lotes para consumos internos | **BLOQUEADO_CLIENTE** | No existe. | Definir selección/FEFO/serie y excepciones. |
| CH15-F16 | Honorario vinculado a profesional | **BLOQUEADO_CLIENTE** | No existe maestro profesional/relación. | Definir cardinalidad y tarifa. |

### CH16 · Descuentos y reglas por categoría

**Resumen:** PARCIAL: 2, FALTA: 5, BLOQUEADO_CLIENTE: 2.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH16-F01 | Matriz de descuentos por familia | **FALTA** | No existe módulo Discounts. | Crear matriz por categoría. |
| CH16-F02 | Catálogo paginado y exportable | **FALTA** | No existe. | Implementar listado, búsqueda, paginación y exportación. |
| CH16-F03 | Perfiles con categorías excluidas | **FALTA** | No existe. | Implementar exclusiones. |
| CH16-F04 | Alta de perfil de descuento | **FALTA** | No existe. | Crear formulario/persistencia. |
| CH16-F05 | Marca de jubilado | **PARCIAL** | Paciente tiene checkbox Jubilado. | No está conectado a perfiles/elegibilidad de descuentos. |
| CH16-F06 | Perfiles negociados por categoría | **BLOQUEADO_CLIENTE** | No existe. | Definir reglas, prioridad y aprobación. |
| CH16-F07 | Recarga del catálogo después del alta | **FALTA** | No existe alta de perfil. | Implementar tras crear módulo. |
| CH16-F08 | Acceso al reporte de salud | **PARCIAL** | Reporte de salud existe en navegación clínica. | No se reproduce el salto contextual observado desde descuentos. |
| CH16-F09 | Bloqueo de edición clínica tras guardar | **BLOQUEADO_CLIENTE** | Documentos firmados sí son inmutables, pero el flujo observado no está vinculado. | Confirmar regla exacta de bloqueo. |

### CH17 · Reporte de salud detallado e impresión

**Resumen:** COINCIDE: 1, PARCIAL: 5, FALTA: 7, BLOQUEADO_CLIENTE: 1, BLOQUEADO_INTEGRACION: 1, NO_DEMOSTRABLE: 2.

| ID | Función observada en el video | Veredicto actual | Qué existe hoy | Brecha para paridad |
|---|---|---|---|---|
| CH17-F01 | Listado clínico con triage y auditoría | **PARCIAL** | Lista hospitalizaciones/documentos; auditoría global existe. | Faltan triage y columnas exactas. |
| CH17-F02 | Acciones de la hospitalización | **FALTA** | No hay menú clínico por hospitalización. | Agregar acciones observadas. |
| CH17-F03 | Reporte clínico por hospitalización | **PARCIAL** | Reporte de salud global existe. | No está contextualizado completamente por caseId. |
| CH17-F04 | Cambio de rango temporal | **FALTA** | No hay filtros de rango. | Implementar. |
| CH17-F05 | Información principal del paciente | **PARCIAL** | Algunos nombres/casos aparecen. | Falta cabecera clínica completa. |
| CH17-F06 | Seguros seleccionables para impresión | **FALTA** | No existe configuración de impresión. | Implementar tras definir documento. |
| CH17-F07 | Salida imprimible configurable | **NO_DEMOSTRABLE** | No existe salida clínica equivalente. | El video no demuestra el archivo final, pero sí muestra configuración visible. |
| CH17-F08 | Navegación de Evaluación Clínica | **PARCIAL** | Pestaña Antecedentes y evaluaciones existe. | Contenido/acciones faltantes. |
| CH17-F09 | Antecedentes clínicos estructurados | **FALTA** | Panel solo indica ausencia. | Implementar modelo y captura. |
| CH17-F10 | Captura de alergias desde catálogo | **FALTA** | Solo aviso de configuración pendiente. | Crear catálogo y captura. |
| CH17-F11 | Signos vitales agrupados por origen | **COINCIDE** | Registra y muestra valores por fuente y fecha. | Sin clasificación automática, correctamente. |
| CH17-F12 | Listado de notas de enfermería | **FALTA** | Pestaña es placeholder vacío. | Implementar listado/modelo. |
| CH17-F13 | Edición de nota clínica | **FALTA** | Corrección genérica de documentos no equivale a nota de enfermería. | Implementar flujo específico con versionado. |
| CH17-F14 | Auditoría de nota con IA | **NO_DEMOSTRABLE** | No existe IA de auditoría. | La evidencia no define algoritmo/resultado. |
| CH17-F15 | Restricción de edición por rol | **PARCIAL** | Existen permisos clinical:write/sign. | Falta aplicar a notas/reportes específicos observados. |
| CH17-F16 | Aplicación operativa de enfermería | **BLOQUEADO_CLIENTE** | No existe app/flujo específico. | Falta alcance y reglas. |
| CH17-F17 | Compartir nota de enfermería por WhatsApp | **BLOQUEADO_INTEGRACION** | No existe envío. | Requiere proveedor, consentimiento y control de datos sensibles. |

## Prioridades que impiden afirmar «todas las funciones están»

### 1. Corregir la falsa sensación de cierre

- Regenerar una matriz React requisito por requisito desde los 210 requisitos del video.
- Derivar el estado de cada ruta desde esa matriz.
- Eliminar el contador fijo de cero faltantes del Dashboard.

### 2. Cerrar funciones visibles que no dependen de reglas clínicas o financieras

- Login/PWA, menú/contexto de usuario, columnas de Pacientes, consentimientos, mapa y catálogos.
- Cabecera completa de Cotizaciones: fecha, referido, giftcard, socio/lista de precios, búsqueda de catálogo y disponibilidad.
- Perfil administrativo, cuentas por cobrar, estados de cuenta, vistas previas y reportes.
- Agenda con calendario, filtros, tipos de visita y detalle.
- Cuentas por pagar, modalidades de compra, detalle/adjuntos y acciones.
- Inventario: acuses, cierres, bodegas, lotes, kits, proveedores y catálogos especializados.
- Descuentos: matriz, perfiles, exclusiones, alta, listado y exportación.

### 3. Mantener bloqueado lo que el video no define

- Umbrales clínicos y clasificación de triage.
- Máquinas de estados de hospitalización, seguro, reclamo, compras, cierres y liquidaciones.
- Catálogos clínicos oficiales, dosis, frecuencia, duración, horarios y fecha final.
- Impuestos, tarifarios, coberturas, descuentos comerciales y reglas de aprobación.
- Entregas externas por WhatsApp, correo, portal o PDF oficial.

## Revisión separada de las correcciones del audio

- **Bien implementado:** cambio de tipo de documento con limpieza; signos vitales individuales; número de Junta de enfermería; reporte de horas; Kárdex; centro de ayuda con canal seguro configurable.
- **Parcial:** menú lateral agrupado; búsqueda normalizada porque no existe en todas las pantallas; modales porque varios flujos del video siguen ausentes.
- **No demostrado como cerrado:** retirar todos los literales “quitar/eliminar”; un inventario de textos no equivale a haberlos corregido.

## Regla de aceptación recomendada

`frame/evento → requisito canónico → control React → contrato/dominio/provider → Playwright → Selenium por acción → persistencia/reload → permiso/negativo → matriz actualizada`

## Fuentes

- `docs/MASTER_VIDEO_REQUIREMENTS.json` y `.md`
- `docs/VIDEO_VS_PLATFORM_GAP_MATRIX.csv`
- `docs/qa/REACT_ROUTE_PARITY.json`
- `docs/qa/UI_ACTION_INVENTORY.json`
- `docs/FUNCTIONAL_INVENTORY.md`
- Código React, contratos, dominio y providers
- Evidencias de `references/video-audit`

## Nota de alcance

Este documento audita el último SHA remoto confirmado. Seguros estaba siendo modificado localmente durante el corte; debe compararse como delta cuando se publique. Ningún resultado no versionado se trató como hecho.