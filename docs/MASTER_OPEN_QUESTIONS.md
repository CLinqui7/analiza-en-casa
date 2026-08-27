# Preguntas abiertas maestras

> Generado de forma determinista desde `docs/MASTER_VIDEO_REQUIREMENTS.json`. No editar este archivo directamente.

Preguntas abiertas: 86. No se infiere ninguna regla de negocio, clínica, financiera o legal ausente.

## CH01 · Contexto inicial, acceso, dashboard y listado de pacientes

- **CH01-Q001 · UNCERTAIN** — ¿La URL directa /pacientes.php exige sesión y redirige de forma segura al login, preservando o descartando la ruta de retorno? Evidencia: CH01-E0002, 00:00:05.600, detail_crops/CH01-E0002_00h00m05s600ms_DETAIL.jpg.
- **CH01-Q002 · UNCERTAIN** — ¿Qué criterios, períodos y permisos alimentan los seis contadores del Dashboard? Evidencia: CH01-E0018, 00:01:31.400, event_frames/CH01-E0018_00h01m31s400ms_abrupt_change.jpg.
- **CH01-Q003 · UNCERTAIN** — ¿Cuáles son los umbrales y reglas clínicas para “valores fuera de rango” y “Normales”? Evidencia: CH01-E0019, 00:01:32.000, event_frames/CH01-E0019_00h01m32s000ms_stable_change.jpg. No deben inventarse.
- **CH01-Q004 · UNCERTAIN** — ¿El estado No hay registros disponibles se oculta durante carga y cómo se presenta una respuesta realmente vacía o fallida? Evidencia: CH01-E0011, 00:01:24.600, event_frames/CH01-E0011_00h01m24s600ms_abrupt_change.jpg.
- **CH01-Q005 · UNCERTAIN** — ¿Qué roles pueden ver cada módulo, exportar Excel, crear pacientes o manejar notificaciones Botmaker? Evidencia: CH01-E0014, 00:01:28.800, event_frames/CH01-E0014_00h01m28s800ms_abrupt_change.jpg.

## CH02 · Alta y edición de pacientes

- **CH02-Q001 · UNCERTAIN** — ¿Qué normalización, formato, unicidad, anti-duplicación y validación aplica a Cédula/Pasaporte, y cómo se evita revelar si un paciente ya existe? Evidencia: CH02-E0012, 00:02:23.400, event_frames/CH02-E0012_00h02m23s400ms_motion_progress.jpg y su detail crop.
- **CH02-Q002 · UNCERTAIN** — ¿Qué reglas válidas de teléfono, correo, fecha de nacimiento, edad y campos demográficos deben aplicarse, y cuáles varían por organización? Evidencia: CH02-E0011, 00:02:17.800, event_frames/CH02-E0011_00h02m17s800ms_abrupt_change.jpg.
- **CH02-Q003 · UNCERTAIN** — ¿Cuál es la base de consentimiento, historial de cambios y mecanismo de revocación para Botmaker/WhatsApp? Los mensajes no deben incluir datos clínicos sensibles. Evidencia: CH02-E0022, 00:02:57.200, detail_crops/CH02-E0022_00h02m57s200ms_DETAIL.jpg.
- **CH02-Q004 · UNCERTAIN** — ¿Cuáles son las fuentes y alcances autoritativos de Empresa y Seguro, y por qué el filtro de seguro muestra entradas con apariencia de persona? Evidencia: CH02-E0058, 00:03:46.600, detail_crops/CH02-E0058_00h03m46s600ms_DETAIL.jpg.
- **CH02-Q005 · UNCERTAIN** — ¿Qué sucede al responder No en titularidad, cuántas coberturas se permiten, qué hace Agregar y qué validaciones tienen póliza, certificado y fecha efectiva? Evidencia: CH02-E0062, 00:03:49.800, event_frames/CH02-E0062_00h03m49s800ms_stable_change.jpg; CH02-E0066, 00:04:10.000, detail_crops/CH02-E0066_00h04m10s000ms_DETAIL.jpg.
- **CH02-Q006 · UNCERTAIN** — ¿Se permiten múltiples contactos, cuáles son los catálogos de parentesco/rol/país y qué controles protegen sus datos? Evidencia: CH02-E0068, 00:04:11.000, event_frames/CH02-E0068_00h04m11s000ms_stable_change.jpg.
- **CH02-Q007 · UNCERTAIN** — ¿Qué proveedores y formatos acepta Pegar enlace, cuál es la precedencia entre dirección, enlace y marcador, y qué finalidad/retención tiene el control de cámara? Evidencia: CH02-E0071, 00:04:19.600, event_frames/CH02-E0071_00h04m19s600ms_abrupt_change.jpg; CH02-E0076, 00:04:35.800, detail_crops/CH02-E0076_00h04m35s800ms_DETAIL.jpg.
- **CH02-Q008 · UNCERTAIN** — ¿Qué validaciones, errores, idempotencia y evidencia de auditoría produce Guardar, y qué comportamiento exacto tiene Atrás ante cambios? Evidencia: CH02-E0082, 00:04:39.000, detail_crops/CH02-E0082_00h04m39s000ms_DETAIL.jpg. El clip termina sin pulsar ninguno.

## CH03 · Hospitalización y navegación de preautorizaciones

- **CH03-Q001 · UNCERTAIN** — ¿Preadmisión es una función habilitable, depende del rol/organización o es un residuo de renderizado? Aparece en CH03-E0007, 00:04:52.200, event_frames/CH03-E0007_00h04m52s200ms_abrupt_change.jpg, desaparece en CH03-E0008 y repite el patrón en CH03-E0036–CH03-E0038.
- **CH03-Q002 · UNCERTAIN** — ¿Qué evento crea/cierra Hospitalización Activa y qué relación exacta tiene con Paciente Activo/Inactivo? Se requieren transiciones autorizadas y auditables. Evidencia: CH03-E0017, 00:05:06.400, event_frames/CH03-E0017_00h05m06s400ms_abrupt_change.jpg; CH03-E0030, 00:05:27.200, detail_crops/CH03-E0030_00h05m27s200ms_DETAIL.jpg.
- **CH03-Q003 · UNCERTAIN** — ¿Qué calculan los badges 8 de Relación de pacientes por empresa y 67 de PIC Ejecución, cuál es su alcance organizacional y cómo se actualizan? Evidencia: CH03-E0040, 00:05:39.200, detail_crops/CH03-E0040_00h05m39s200ms_DETAIL.jpg.
- **CH03-Q004 · UNCERTAIN** — ¿Cuáles son los valores y operadores de Estado Administrativo, Fecha de inicio y Tipo de cuenta, y cómo deben combinarse Aplicar/Limpiar? Evidencia: CH03-E0009, 00:04:53.200, event_frames/CH03-E0009_00h04m53s200ms_stable_change.jpg.
- **CH03-Q005 · UNCERTAIN** — ¿Cuál es la máquina de estados completa de cotización, envío de preautorización, respuesta de seguro y reclamo; qué permisos, reintentos, idempotencia y auditoría requiere cada transición? Evidencia: CH03-E0042, 00:05:55.800, detail_crops/CH03-E0042_00h05m55s800ms_DETAIL.jpg.
- **CH03-Q006 · UNCERTAIN** — ¿Cómo se calculan moneda, total, descuentos, impuestos y redondeo, y cuándo una cotización enviada pasa a ser una versión inmutable? La evidencia no autoriza precios. Evidencia: CH03-E0043, 00:05:59.000, event_frames/CH03-E0043_00h05m59s000ms_abrupt_change.jpg.
- **CH03-Q007 · UNCERTAIN** — ¿Qué validaciones y catálogos aplican a Paciente, Fecha, Grupo de descuento, Referido por, Giftcard y Comentarios, y qué significa el icono + de referido? Evidencia: CH03-E0046, 00:06:09.600, detail_crops/CH03-E0046_00h06m09s600ms_DETAIL.jpg.
- **CH03-Q008 · UNCERTAIN** — ¿Qué acciones ofrece la elipsis en hospitalizaciones, pacientes y cotizaciones y qué autorizaciones/auditoría protegen cada una? Evidencia: CH03-E0010, 00:04:57.600, detail_crops/CH03-E0010_00h04m57s600ms_DETAIL.jpg; CH03-E0042, 00:05:55.800, detail_crops/CH03-E0042_00h05m55s800ms_DETAIL.jpg.

## CH04 · Cotización: datos generales

- **CH04-Q001 · UNCERTAIN** — ¿Qué representa una entrada de Paciente rotulada Cotización, en especial la que usa una identificación compuesta solo por ceros? ¿Es el mecanismo de cotización abierta mencionado de forma ruidosa por la narración, y qué controles de anti-enumeración/organización aplica? Evidencia: CH04-E0003, 00:06:18.800, detail_crops/CH04-E0003_00h06m18s800ms_DETAIL.jpg.
- **CH04-Q002 · UNCERTAIN** — ¿La selección de Paciente fija DUI/NIT, teléfono y correo como snapshot de la cotización o como referencias vivas, y quién puede editarlos? Evidencia: CH04-E0005, 00:06:21.800, detail_crops/CH04-E0005_00h06m21s800ms_DETAIL.jpg.
- **CH04-Q003 · UNCERTAIN** — ¿Qué zona horaria, fecha predeterminada y rangos pasados/futuros admite Fecha? La fecha grabada no debe codificarse. Evidencia: CH04-E0007, 00:06:30.600, detail_crops/CH04-E0007_00h06m30s600ms_DETAIL.jpg.
- **CH04-Q004 · UNCERTAIN** — ¿Cuál es el catálogo, elegibilidad, precedencia, autorización y fórmula de Grupo de descuento? La evidencia solo muestra Regular y no autoriza porcentajes. Evidencia: CH04-E0008, 00:06:33.000, event_frames/CH04-E0008_00h06m33s000ms_settled.jpg.
- **CH04-Q005 · UNCERTAIN** — ¿Por qué Referido por mezcla canales, aseguradora, paciente recurrente y personas; cuál es el tipo de cada entidad, alcance organizacional, máximo de tags y efecto de VACIO? Evidencia: CH04-E0014, 00:06:42.000, detail_crops/CH04-E0014_00h06m42s000ms_DETAIL.jpg; CH04-E0032, 00:06:59.600, detail_crops/CH04-E0032_00h06m59s600ms_DETAIL.jpg.
- **CH04-Q006 · UNCERTAIN** — ¿Qué crea el botón + de Referido por, qué permisos requiere y cómo se evita duplicar o contaminar el catálogo? Evidencia: CH04-E0009, 00:06:34.800, event_frames/CH04-E0009_00h06m34s800ms_abrupt_change.jpg.
- **CH04-Q007 · UNCERTAIN** — ¿Cómo se valida y aplica Giftcard, y qué controles de unicidad, expiración, saldo, idempotencia y auditoría requiere? Evidencia: CH04-E0034, 00:07:01.000, event_frames/CH04-E0034_00h07m01s000ms_abrupt_change.jpg.
- **CH04-Q008 · UNCERTAIN** — ¿Qué contenido mínimo y finalidad tiene Comentarios, quién puede leerlo y cómo se evita introducir información clínica sensible en documentos o notificaciones no seguras? Evidencia: CH04-E0034, 00:07:01.000, event_frames/CH04-E0034_00h07m01s000ms_abrupt_change.jpg.
- **CH04-Q009 · UNCERTAIN** — ¿Cuándo se guarda una nueva cotización, qué hace que una versión enviada sea inmutable y qué validación relaciona paciente, factura e ítems? El capítulo no muestra ninguna acción final. Evidencia: CH04-E0035, 00:07:01.600, event_frames/CH04-E0035_00h07m01s600ms_stable_change.jpg.

## CH05 · Cotización: servicios, estudios y medicamentos

- **CH05-Q001 · UNCERTAIN** — ¿Qué determina qué Socio de negocios/lista de precios puede elegir cada organización, su vigencia, prioridad y moneda? Evidencia: CH05-E0003, 00:07:49.400, detail_crops/CH05-E0003_00h07m49s400ms_DETAIL.jpg.
- **CH05-Q002 · UNCERTAIN** — ¿Cuál es la taxonomía autorizada entre Servicios y Equipos? El catálogo de Servicios incluye alquileres y Atril metálico + Bomba de infusión aunque existe una pestaña Equipos. Evidencia: CH05-E0065, 00:09:50.400, detail_crops/CH05-E0065_00h09m50s400ms_DETAIL.jpg.
- **CH05-Q003 · UNCERTAIN** — ¿Qué unidad representa Cantidad para hospitalizaciones por horas/días, alquileres y medicamentos; admite decimales, límites o validación contra duración? Evidencia: CH05-E0052, 00:09:30.400, event_frames/CH05-E0052_00h09m30s400ms_abrupt_change.jpg.
- **CH05-Q004 · UNCERTAIN** — ¿Cuáles son moneda, tasa, base, exenciones, redondeo y precedencia de descuentos/impuesto? Los valores observados no autorizan inferir una tasa. Evidencia: CH05-E0067, 00:09:56.400, event_frames/CH05-E0067_00h09m56s400ms_abrupt_change.jpg.
- **CH05-Q005 · UNCERTAIN** — ¿Qué significa el conteo entre paréntesis en Medicamentos y cómo se relaciona con Solo disponibles en inventario, reservas, lotes, bodegas y concurrencia? Evidencia: CH05-E0075, 00:10:46.800, detail_crops/CH05-E0075_00h10m46s800ms_DETAIL.jpg.
- **CH05-Q006 · UNCERTAIN** — ¿Qué controles clínicos/autorizaciones determinan medicamento, presentación y cantidad? El ASR menciona ejemplos de administración, pero no debe transformarse en una regla de dosificación. Evidencia: CH05-E0080, 00:11:04.400, detail_crops/CH05-E0080_00h11m04s400ms_DETAIL.jpg.
- **CH05-Q007 · UNCERTAIN** — ¿El procesamiento de Invanz insertó una línea? El clip confirma clic, overlay y restablecimiento, pero la fila de Medicamentos queda fuera del encuadre y no se muestra un total posterior. Evidencia: CH05-E0080, 00:11:04.400, event_frames/CH05-E0080_00h11m04s400ms_abrupt_change.jpg; CH05-E0082, 00:11:05.600, detail_crops/CH05-E0082_00h11m05s600ms_DETAIL.jpg.
- **CH05-Q008 · UNCERTAIN** — ¿Qué validaciones, versionado inmutable de cotización enviada, auditoría e idempotencia aplica Guardar? El capítulo nunca pulsa Guardar. Evidencia: CH05-E0067, 00:09:56.400, event_frames/CH05-E0067_00h09m56s400ms_abrupt_change.jpg.
- **CH05-Q009 · UNCERTAIN** — ¿Quién puede eliminar líneas, editar cantidades o cambiar el checkbox de impuesto, y cómo se auditan/recalculan esos cambios? Evidencia: CH05-E0054, 00:09:31.400, event_frames/CH05-E0054_00h09m31s400ms_abrupt_change.jpg.

## CH06 · Cotización: insumos, equipos, honorarios, extras y totales

- **CH06-Q001 · UNCERTAIN** — ¿Qué reglas determinan qué socios y precios aparecen por categoría, paciente, aseguradora o fecha? La evidencia muestra catálogos diferentes, pero no su precedencia ni vigencia. Evidencia: CH06-E0007–E0060, 00:11:34.600–00:12:43.000.
- **CH06-Q002 · VISIBLE** — ¿Debe Solo disponibles en inventario ocultar existencias cero, bloquear Añadir o sólo filtrar? El control es visible, pero no se activa; se selecciona un artículo con cero existencia. Evidencia: CH06-E0024–E0030, 00:11:57.600–00:12:02.000.
- **CH06-Q003 · UNCERTAIN** — ¿Cuál es la política autorizada para editar cantidad, descuento e impuesto por renglón, y qué roles pueden hacerlo? El video muestra controles, no permisos ni validaciones. Evidencia: CH06-E0068–E0084, 00:12:57.400–00:13:16.400.
- **CH06-Q004 · VISIBLE** — ¿Qué ocurre al quitar un renglón y cómo se audita el cambio? La acción menos es visible, pero no se ejecuta. Evidencia: CH06-E0069, 00:12:57.800.
- **CH06-Q005 · UNCERTAIN** — ¿Qué campos y reglas corresponden a Equipos y Extras? Sus pestañas son visibles, pero no se abren en este capítulo. Evidencia: CH06-E0085, 00:13:50.600.
- **CH06-Q006 · UNCERTAIN** — ¿Guardar crea borrador, nueva versión o versión enviada? El narrador sólo confirma persistencia; no se ve identificador, mensaje de éxito ni versionado. Evidencia: CH06-E0113–E0115, 00:14:22.800–00:14:24.200; transcripción 00:14:20–00:14:30.

## CH07 · Preautorización, seguro y reclamo

- **CH07-Q001 · UNCERTAIN** — ¿Cuál es la máquina de estados autorizada entre Pendiente, Pre aprobación, Poner en ejecución, Rechazar y No aplica, y quién puede aplicar cada transición? El capítulo sólo abre el selector. Evidencia: CH07-E0015–E0018, 00:16:02.600–00:16:08.200.
- **CH07-Q002 · UNCERTAIN** — ¿Qué campos/documentos exige una preautorización y qué respuesta del seguro se registra? La tabla muestra estados, pero el formulario de envío no se abre. Evidencia: CH07-E0007, 00:14:33.000.
- **CH07-Q003 · UNCERTAIN** — ¿Qué variante impresa es la cotización que se envía al cliente y cómo se versiona después del envío? El menú enumera varios documentos, sin abrir el resultado. Evidencia: CH07-E0010, 00:14:49.600.
- **CH07-Q004 · UNCERTAIN** — ¿El envío por WhatsApp debe adjuntar PDF, enviar enlace seguro o ambos? La conversación propone PDF directo, pero no se demuestra. Cualquier diseño debe excluir contenido clínico sensible del mensaje. Evidencia: CH07-E0013, 00:15:48.600; transcripción 00:15:23–00:15:45.
- **CH07-Q005 · UNCERTAIN** — ¿Qué confirmación, idempotencia, historial, reintentos y estado de entrega requiere E-mail/Whatsapp/seguro? Sólo se ven menús de Enviar e Historial. Evidencia: CH07-E0012–E0014, 00:15:48.000–00:16:02.600.
- **CH07-Q006 · UNCERTAIN** — ¿Qué protege Duplicar, Versiones y Eliminar frente a una cotización ya enviada? Las acciones aparecen, pero no se ejecutan. Evidencia: CH07-E0010, 00:14:49.600.

## CH08 · Perfil administrativo, cuentas por cobrar y pagos

- **CH08-Q001 · UNCERTAIN** — ¿Qué catálogo y reglas autorizadas determinan health manager, tipo Revenue, forma de pago, aseguradora, categoría/subcategoría y hospital de origen? El video sólo muestra valores seleccionables. Evidencia: CH08-E0004–E0018, 00:16:18.400–00:16:43.400.
- **CH08-Q002 · UNCERTAIN** — ¿Qué significa exactamente Tipo de solicitud Reclamo en este perfil y cómo se conecta con la preautorización del capítulo anterior? Evidencia: CH08-E0010, 00:16:25.600.
- **CH08-Q003 · UNCERTAIN** — ¿Quién puede editar, eliminar o añadir pagos y qué razón, autorización, idempotencia y auditoría exige cada acción? El menú las expone sin ejecutarlas. Evidencia: CH08-E0049–E0056, 00:17:51.800–00:18:06.200.
- **CH08-Q004 · VISIBLE** — ¿Archivar una cuenta tiene requisitos previos, motivo y reversión? La acción sólo es visible. Evidencia: CH08-E0041, 00:17:33.600.
- **CH08-Q005 · UNCERTAIN** — ¿Qué representa Registro XPO? No se abre ni se explica. Evidencia: CH08-E0041, 00:17:33.600.
- **CH08-Q006 · UNCERTAIN** — ¿Cómo debe interpretarse y presentarse un Total Pendientes negativo: crédito, sobrepago o inconsistencia? No debe asumirse una regla financiera sin confirmación. Evidencia: CH08-E0084, 00:19:43.800.
- **CH08-Q007 · UNCERTAIN** — ¿Qué cambia realmente Guardar cambios en el resumen y cuál es la versión auditable del estado de cuenta? El botón no se activa. Evidencia: CH08-E0084, 00:19:43.800.
- **CH08-Q008 · VERBAL** — ¿La generación automática mencionada es un requisito aprobado, con qué periodicidad, destinatario y canal seguro? La idea es sólo verbal. Transcripción: 00:18:30–00:18:37.
- **CH08-Q009 · UNCERTAIN** — ¿Qué datos incluyen Excel con filtros, Reporte y Excel, y qué permisos evitan exportaciones entre organizaciones? Los archivos no se generan en el video. Evidencia: CH08-E0037, 00:17:08.800.

## CH09 · Hospitalización clínica y reporte de salud

- **CH09-Q001 · UNCERTAIN** — ¿Qué roles pueden activar una hospitalización clínica, crear/cerrar perfiles y corregir un perfil ya usado, y qué auditoría exige cada transición?
- **CH09-Q002 · UNCERTAIN** — ¿Qué estado administrativo origina el estado clínico Pendiente y cuál es la máquina de estados completa hasta Activo/finalización?
- **CH09-Q003 · UNCERTAIN** — ¿Cuál es el estándar y versión exactos del catálogo diagnóstico? La imagen muestra códigos A00–A02, pero el audio se transcribe con baja certeza como “SIE 10” y “MCE11”; no debe fijarse una versión sin confirmación.
- **CH09-Q004 · UNCERTAIN** — ¿Qué adjuntos admite el perfil, con qué límites, clasificación de sensibilidad, análisis antimalware, retención y permisos de lectura?
- **CH09-Q005 · UNCERTAIN** — ¿Quién administra grupos/subgrupos de paciente y qué reglas vinculan triage, tipo de atención, frecuencia de supervisión y frecuencia de reporte?
- **CH09-Q006 · UNCERTAIN** — ¿Qué validaciones y trazabilidad requieren dispositivos, calibre, fechas, frecuencia de cambio, motivo y observaciones?
- **CH09-Q007 · UNCERTAIN** — ¿Cómo se generan los turnos desde el rango/frecuencia y qué ocurre ante solapamientos, cambios o cancelaciones?
- **CH09-Q008 · UNCERTAIN** — ¿Qué significa Auditoría: Sin auditar, quién puede auditar, y el reporte queda inmutable o versionado después de auditarse?
- **CH09-Q009 · UNCERTAIN** — ¿Qué secciones y adjuntos del expediente puede incluir cada rol al imprimir, y cómo se evita exponer contenido clínico a usuarios no autorizados?
- **CH09-Q010 · UNCERTAIN** — ¿El botón Imprimir debe descargar, abrir vista previa o enviar a impresora? E0127 muestra una confirmación de salida y no un PDF; se requiere confirmar si es un defecto de la versión grabada.
- **CH09-Q011 · UNCERTAIN** — ¿Qué ocurrió entre 00:24:47.200 y 00:27:13.800? No debe inferirse una impresión exitosa ni un estado intermedio a partir del salto de eventos.
- **CH09-Q012 · UNCERTAIN** — ¿La superposición de videollamada forma parte del producto o es ajena a la aplicación grabada? La evidencia no permite atribuirla a Analiza en Casa.
- **CH09-Q013 · UNCERTAIN** — ¿Cuáles son exactamente los campos obligatorios y el orden del PDF/expediente final? El contenido detallado sólo se describe verbalmente y no se ve el documento generado.

## CH10 · Orden médica, tratamientos y tarjeta de medicamentos

- **CH10-Q001 · UNCERTAIN** — ¿Qué roles pueden crear, modificar, finalizar, anular e imprimir órdenes o tarjetas? Evidencia: CH10-E0112, 00:31:12.200.
- **CH10-Q002 · UNCERTAIN** — ¿Qué significa PMC, quién lo actualiza y qué transiciones conectan Revisar/Listo con firma o finalización? Evidencia: CH10-E0102, CH10-E0105 y CH10-E0113.
- **CH10-Q003 · UNCERTAIN** — ¿Cuáles son los catálogos oficiales de vía, frecuencia, duración y horarios, sus relaciones y las reglas de PRN? Evidencia: CH10-E0028, CH10-E0031 y CH10-E0042.
- **CH10-Q004 · UNCERTAIN** — INFERRED — ¿La fecha final se calcula inclusiva o exclusivamente desde inicio y duración, qué zona horaria aplica y cómo se comporta un tratamiento crónico? Sólo se observa un caso. Evidencia: CH10-E0035 y CH10-E0038.
- **CH10-Q005 · UNCERTAIN** — ¿Cuál es la fuente maestra, deduplicación y permiso de alta inline para medicamentos y prescriptores? Evidencia: CH10-E0021–CH10-E0026.
- **CH10-Q006 · UNCERTAIN** — ¿“Mostrar diluciones” sólo despliega captura documentada o aplica una regla clínica, y qué obligatoriedad tiene Crónico? Evidencia: CH10-E0039 y CH10-E0050.
- **CH10-Q007 · UNCERTAIN** — ¿Cuáles son las etiquetas oficiales, cuáles son configurables y quién puede crearlas, quitarlas y reordenarlas? Evidencia: CH10-E0075–CH10-E0086.
- **CH10-Q008 · UNCERTAIN** — ¿Qué sanitización, obligatoriedad, firma y reglas de borradores vacíos aplican a los editores por sección? Evidencia: CH10-E0088–CH10-E0093.
- **CH10-Q009 · UNCERTAIN** — ¿Qué contenido, encabezado, firma, papel y validez corresponden a tarjeta completa, tarjeta simple y conteo presencial? Evidencia: CH10-E0109.
- **CH10-Q010 · VERBAL** — ¿Cómo se entrega una tarjeta a enfermería domiciliaria mediante un enlace seguro, autenticado, revocable, auditable y con expiración, sin incluir contenido clínico en WhatsApp/SMS/email? Evidencia verbal: CH10-E0109–CH10-E0110.
- **CH10-Q011 · UNCERTAIN** — ¿Qué constituye una Actualización, un Tratamiento con cambios y una entrada del Historial, y cuál es la unidad de versionado? Evidencia: CH10-E0008, CH10-E0018 y CH10-E0101.
- **CH10-Q012 · UNCERTAIN** — ¿Qué contrato de datos, permisos y auditoría tiene Registro XPO? Evidencia: CH10-E0065 y CH10-E0099.
- **CH10-Q013 · VERBAL** — ¿Cuáles son los campos mínimos, estados, responsables, omisión/motivo, idempotencia y correcciones del registro real de administración? Hasta confirmarlo no se simula éxito. Evidencia verbal asociada a CH10-E0109–CH10-E0110.
