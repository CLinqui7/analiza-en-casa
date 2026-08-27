# Preguntas abiertas y bloqueadores

## CH01 · decisiones pendientes trazadas

- `CH01-Q001`: confirmar si el enlace histórico `/pacientes.php` debe conservar una ruta de retorno después del login. El SPA aplica guardia de sesión; no se inventó una regla de redirección heredada.
- `CH01-Q002`: definir fórmula, período, fuente y permisos de los seis contadores del dashboard. Los valores sin regla aprobada muestran `—`; los cálculos demo están rotulados como tales.
- `CH01-Q003`: aprobar y versionar umbrales clínicos para “valores fuera de rango” y “Normales”. Hasta entonces la tabla muestra datos sin clasificación y el filtro Normales permanece deshabilitado.
- `CH01-Q004`: confirmar la semántica final de carga, vacío, fallo y reintento en persistencia real. La UI actual mantiene carga, vacío y error mutuamente excluyentes.
- `CH01-Q005`: confirmar permisos definitivos de módulos, exportación, creación de pacientes y consentimiento/canal Botmaker. La política provisional niega toda mutación al rol AUDITOR y restringe alta/carga de pacientes a `patients:write`.

## CH02 · decisiones pendientes trazadas

- `CH02-Q001`: definir normalización, formato, unicidad y validación de Cédula/Pasaporte, incluido el comportamiento anti-enumeración. Evidencia: CH02-E0012, 00:02:23.400, `references/video-audit/chapters/CH02_alta_y_edicion_de_pacientes/detail_crops/CH02-E0012_00h02m23s400ms_DETAIL.jpg`.
- `CH02-Q002`: definir reglas organizacionales de teléfono, correo, fecha de nacimiento, edad, sexo y catálogos demográficos, incluido el país/prefijo telefónico inicial. Evidencia: CH02-E0011, 00:02:17.800, `references/video-audit/chapters/CH02_alta_y_edicion_de_pacientes/event_frames/CH02-E0011_00h02m17s800ms_abrupt_change.jpg`.
- `CH02-Q003`: aprobar base de consentimiento, valor inicial, historial y revocación de Botmaker/WhatsApp. El placeholder seguro queda desmarcado y nunca envía contenido clínico. Evidencia: CH02-E0022, 00:02:57.200, `references/video-audit/chapters/CH02_alta_y_edicion_de_pacientes/detail_crops/CH02-E0022_00h02m57s200ms_DETAIL.jpg`.
- `CH02-Q004`: identificar las fuentes maestras y alcances de Empresa y Seguro, además de resolver entradas dudosas del catálogo observado. Evidencia: CH02-E0058, 00:03:46.600, `references/video-audit/chapters/CH02_alta_y_edicion_de_pacientes/detail_crops/CH02-E0058_00h03m46s600ms_DETAIL.jpg`.
- `CH02-Q005`: definir la rama de titular No, autocopia/edición posterior, número de coberturas, semántica de Agregar y reglas de póliza, certificado y vigencia. Evidencia: CH02-E0062, 00:03:49.800, y CH02-E0066, 00:04:10.000.
- `CH02-Q006`: definir multiplicidad, obligatoriedad, catálogos y protección de contactos. Evidencia: CH02-E0068, 00:04:11.000, `references/video-audit/chapters/CH02_alta_y_edicion_de_pacientes/event_frames/CH02-E0068_00h04m11s000ms_stable_change.jpg`.
- `CH02-Q007`: seleccionar proveedor/licencia de mapa, formatos de enlace, precedencia de dirección/coordenadas/marcador, permisos de ubicación y finalidad/retención de cámara. Evidencia: CH02-E0071, 00:04:19.600, y CH02-E0076, 00:04:35.800.
- `CH02-Q008`: confirmar roles definitivos de alta/edición, comportamiento de Atrás, errores, idempotencia, auditoría y mensaje exacto de Guardar. El video termina sin ejecutar las acciones. Evidencia: CH02-E0082, 00:04:39.000, `references/video-audit/chapters/CH02_alta_y_edicion_de_pacientes/detail_crops/CH02-E0082_00h04m39s000ms_DETAIL.jpg`.

## CH03 · decisiones pendientes trazadas

- `CH03-Q001`: confirmar si Preadmisión es feature flag, permiso, ruta incompleta o residuo de pintura. El clip exacto confirma que sólo aparece brevemente durante la carga. Evidencia: CH03-E0007, 00:04:52.200, y CH03-E0037, 00:05:37.400.
- `CH03-Q002`: definir creación/cierre de Hospitalización Activa y su relación formal con Paciente Activo/Inactivo, incluidas autorización y auditoría. Evidencia: CH03-E0017, 00:05:06.400.
- `CH03-Q003`: definir fórmula, alcance organizacional y frecuencia de refresco de los badges 8 y 67. Hasta entonces se muestra `—`. Evidencia: CH03-E0040, 00:05:39.200.
- `CH03-Q004`: definir catálogos, operadores y combinación de Estado Administrativo, Fecha de inicio y Tipo de cuenta. Evidencia: CH03-E0009, 00:04:53.200.
- `CH03-Q005`: aprobar la máquina de estados de cotización, preautorización, respuesta del seguro y reclamo, incluidos permisos, reintentos, idempotencia y auditoría. La UI no infiere estados y muestra `Regla pendiente`. Evidencia: CH03-E0042, 00:05:55.800.
- `CH03-Q006`: definir moneda, precios, descuentos, impuestos, cobertura y redondeo. Ningún valor del video se adopta como regla productiva. Evidencia: CH03-E0043, 00:05:59.000.
- `CH03-Q007`: definir catálogos y validaciones de Paciente, Fecha, Grupo de descuento, Referido por, Giftcard y Comentarios, además del significado del botón `+`. Evidencia: CH03-E0046, 00:06:09.600.
- `CH03-Q008`: definir acciones de elipsis por estado/rol y la auditoría exigida. No se inventan operaciones no demostradas. Evidencia: CH03-E0010, 00:04:57.600, y CH03-E0042, 00:05:55.800.

## CH04 · decisiones pendientes trazadas

- `CH04-Q001`: definir si las entradas rotuladas Cotización representan un paciente genérico/cotización abierta y qué controles organizacionales y anti-enumeración aplican. No se replica la identificación cero. Evidencia: CH04-E0003, 00:06:18.800.
- `CH04-Q002`: definir si DUI/NIT, Teléfono y Correo son referencias vivas o snapshot histórico de la cotización, y quién puede editarlos. Evidencia: CH04-E0005, 00:06:21.800.
- `CH04-Q003`: definir zona horaria, fecha inicial y rangos pasados/futuros permitidos. Evidencia: CH04-E0007, 00:06:30.600.
- `CH04-Q004`: aprobar catálogo, elegibilidad, precedencia, autorización y fórmula de Grupo de descuento. Regular es sólo el valor inicial observado. Evidencia: CH04-E0008, 00:06:33.000.
- `CH04-Q005`: definir tipos, alcance, máximo, deduplicación y significado de `VACIO` en Referido por. Evidencia: CH04-E0014, 00:06:42.000, y CH04-E0032, 00:06:59.600.
- `CH04-Q006`: definir la entidad real que crea `+`, permisos y gobierno del maestro. El flujo actual es provisional y no crea un catálogo productivo. Evidencia: CH04-E0009, 00:06:34.800.
- `CH04-Q007`: definir validación, saldo, expiración, unicidad, idempotencia y auditoría de Giftcard. No se aplica financieramente. Evidencia: CH04-E0034, 00:07:01.000.
- `CH04-Q008`: definir finalidad, visibilidad y límites de contenido de Comentarios; no debe contener datos clínicos destinados a notificaciones inseguras. Evidencia: CH04-E0034, 00:07:01.000.
- `CH04-Q009`: definir resultado exacto de Guardar, estado inicial, errores y relación paciente↔factura↔ítems. CH04 no ejecuta la acción. Evidencia: CH04-E0035, 00:07:01.600.

## CH05 · decisiones pendientes trazadas

- `CH05-Q001`: definir qué Socio de negocios/lista de precios puede elegir cada organización, además de vigencia, prioridad y moneda. Producción exige una lista activa explícita y permanece bloqueada hasta configurar esa correspondencia. Evidencia: CH05-E0003, 00:07:49.400.
- `CH05-Q002`: confirmar la taxonomía entre Servicios y Equipos; el video incluye un atril con bomba dentro de Servicios. Evidencia: CH05-E0065, 00:09:50.400.
- `CH05-Q003`: definir unidad, precisión, límites y relación de Cantidad con horas, días, alquileres y medicamentos. Sólo se exige un valor mayor que cero. Evidencia: CH05-E0052, 00:09:30.400.
- `CH05-Q004`: aprobar moneda, tasa, base, exenciones, redondeo y precedencia entre descuentos e impuesto. El impuesto permanece en cero y deshabilitado; no se infirió una tasa del ejemplo. Evidencia: CH05-E0067, 00:09:56.400.
- `CH05-Q005`: definir el conteo entre paréntesis de Medicamentos y su relación con disponibilidad, reservas, lotes, bodegas y concurrencia. `Solo disponibles en inventario` permanece bloqueado. Evidencia: CH05-E0075, 00:10:46.800.
- `CH05-Q006`: definir controles clínicos y autorizaciones de medicamento, presentación y cantidad. Ningún ejemplo del ASR se convirtió en regla de dosificación. Evidencia: CH05-E0080, 00:11:04.400.
- `CH05-Q007`: confirmar si añadir Invanz inserta una línea; el frame y el clip exacto muestran procesamiento y reset, pero la fila queda fuera del encuadre. Evidencia: CH05-E0080 y CH05-E0082.
- `CH05-Q008`: confirmar resultado, mensaje, versionado e idempotencia exactos de Guardar; el capítulo nunca ejecuta la acción. La plataforma aplica versionado y RPC transaccionales como hardening, sin atribuirlos al video. Evidencia: CH05-E0067, 00:09:56.400.
- `CH05-Q009`: definir permisos y auditoría fina para eliminar líneas, editar cantidades o controlar impuestos. Actualmente se exige `quotes:write`, se recalcula y se protegen versiones enviadas. Evidencia: CH05-E0054, 00:09:31.400.

## CH06 · decisiones pendientes trazadas

- `CH06-Q001`: definir la fuente autoritativa de socios y listas de precios, vigencia, prioridad, moneda y qué socio es obligatorio u opcional por categoría. Evidencia: CH06-E0007, 00:11:34.600; CH06-E0045, 00:12:20.800; CH06-E0075, 00:13:03.200.
- `CH06-Q002`: aprobar tasa, base, categorías gravadas o exentas, autorización para marcar/desmarcar, precedencia con descuentos y política de redondeo del impuesto. El video muestra un ejemplo de 13% sobre neto agregado y una diferencia de un centavo frente a sumar líneas redondeadas; la aplicación mantiene impuesto en cero. Evidencia: CH06-E0004, 00:11:30.000, y CH06-E0114, 00:14:23.200.
- `CH06-Q003`: definir qué atributo del paciente, caso o aseguradora asigna automáticamente el grupo de descuento y el referido, además de elegibilidad, aprobación y precedencia. La matriz configurable existe, pero no se copió el ejemplo de 15%. Evidencia: CH06-E0107, 00:14:12.600, y CH06-E0108, 00:14:13.200.
- `CH06-Q004`: definir qué significa existencia/disponibilidad: stock físico, menos comprometido, lotes vigentes, almacén elegido, reservas y concurrencia. Hasta entonces no se muestran conteos ni se habilita `Solo disponibles en inventario`. Evidencia: CH06-E0013, 00:11:39.600; CH06-E0029, 00:12:01.600.
- `CH06-Q005`: confirmar si al cambiar de paciente se conserva el ledger previo, se limpia o se exige confirmación; también debe validarse nuevamente la elegibilidad de precios y descuentos. Evidencia: CH06-E0107–CH06-E0114.
- `CH06-Q006`: confirmar si Socio de negocios es opcional para Honorarios y cómo determina catálogo/precio. El video no muestra asterisco en esa categoría. Evidencia: CH06-E0072–CH06-E0076.
- `CH06-Q007`: definir si Equipos y Extras usan socio, inventario, impuestos y precios igual que Insumos. CH06 sólo muestra sus pestañas y no ejerce los flujos. Evidencia: CH06-E0071, 00:12:59.200.
- `CH06-Q008`: definir el resultado exacto de Guardar —permanecer, navegar al detalle o volver al listado— y los mensajes de éxito/error. El clip termina con el cursor sobre Guardar sin resultado observable. Evidencia: CH06-E0115, 00:14:24.200.
- `CH06-Q009`: confirmar si Atrás advierte por cambios sin guardar y qué ruta exacta debe recuperar. Evidencia: CH06-E0096, 00:14:01.800.
- `CH06-Q010`: aprobar permisos y auditoría fina para cambios de cantidad, retiro de línea, selección de impuesto, asignación de descuento y cambio de paciente dentro de un borrador.

## CH07 · decisiones pendientes trazadas

- `CH07-Q001`: aprobar la máquina de estados oficial y la relación entre Estado, Envío preautorización, Respuesta seguro y Envío de reclamo. Hasta entonces las columnas sin fuente muestran `Regla pendiente`. Evidencia: CH07-E0007, 00:14:33.000.
- `CH07-Q002`: definir la semántica, precondiciones y equivalencias internas de `Pre aprobación`, `Poner en ejecución`, `Rechazar` y `No aplica`; el clip abre el selector pero no ejecuta ninguna transición. Evidencia: CH07-E0018, 00:16:08.200.
- `CH07-Q003`: confirmar qué evento activa una cotización “guardada pero no activada” y cuál debe ser la ruta posterior a Guardar. El clip confirma Atrás, no el resultado de Guardar. Evidencia: CH07-E0001–CH07-E0002.
- `CH07-Q004`: definir por rol los permisos para editar, duplicar, versionar, imprimir, enviar al paciente, enviar al seguro, cambiar estado, rechazar y eliminar. Duplicar y Eliminar permanecen visibles pero bloqueados. Evidencia: CH07-E0009, 00:14:48.800.
- `CH07-Q005`: definir documentos exigidos por aseguradora, destinatario autorizado, formato, canal, vigencia y evidencia de recepción. Evidencia: CH07-E0009 y CH07-E0014.
- `CH07-Q006`: definir formato, obligatoriedad, unicidad, alcance e idempotencia del número de reclamo/autorización. El placeholder actual sólo limita longitud y lo conserva auditablemente. Evidencia verbal asociada a CH07-E0018.
- `CH07-Q007`: aprobar el tratamiento de aprobación parcial, monto aprobado y responsabilidad del paciente sin reescribir la versión enviada. La plataforma conserva el monto en `insurance_requests`. Evidencia: CH07-E0018.
- `CH07-Q008`: definir contenido, numeración, validez fiscal/legal y permisos de Excel, Detalle de servicio, Factura y variantes internacionales. Sólo Cotización está habilitada provisionalmente. Evidencia: CH07-E0010 y CH07-E0015.
- `CH07-Q009`: seleccionar proveedor, consentimiento, reintentos, SLA y confirmaciones de entrega para E-mail y WhatsApp. Ningún dato del video se adopta como contrato productivo. Evidencia: CH07-E0014, 00:16:02.600.
- `CH07-Q010`: confirmar que mensajería debe enviar siempre una plantilla genérica y enlace seguro, no adjuntar el PDF con servicios, medicamentos o estudios. La solicitud verbal literal entra en conflicto con la regla de privacidad del proyecto. Evidencia: audio 00:15:23–00:15:45 y CH07-E0012.
- `CH07-Q011`: definir fórmula, alcance y frecuencia del badge `67` de PIC Ejecución. Se conserva `—` para no inventar el indicador. Evidencia: CH07-E0005–CH07-E0006.
- `CH07-Q012`: identificar la columna final cuyo encabezado sólo deja ver `Co...` en el material y definir su fuente. Evidencia: CH07-E0007.
- `CH07-Q013`: confirmar si Preadmisión sigue vigente, depende de permiso/feature flag o es un estado transitorio de la interfaz anterior. Evidencia: CH07-E0002–CH07-E0003.

## CH08 · decisiones pendientes trazadas

- `CH08-Q001`: definir cómo registrar y aplicar un excedente de pago: crédito del paciente, anticipo, reasignación, devolución u otra figura aprobada. El ejemplo muestra pendiente negativo, pero la plataforma conserva la prohibición de sobrepago y no inventa un saldo a favor. Evidencia: CH08-E0087, 00:19:52.000.
- `CH08-Q002`: definir reglas, fuentes y permisos para distribuir responsabilidad entre Particular, Mixto, Aseguradora y Empresa. El generador habilita Paciente y mantiene Aseguradora/Empresa bloqueados. Evidencia: CH08-E0067–CH08-E0075.
- `CH08-Q003`: confirmar si `Guardar cambios` crea un snapshot histórico inmutable, conserva una selección o modifica asignaciones, además de su autorización e idempotencia. Evidencia: CH08-E0087.
- `CH08-Q004`: definir periodicidad, evento de corte, saldo anterior y retención de los históricos de estados Particular/Mixto. La superficie muestra un vacío explícito y no fabrica periodos. Evidencia: CH08-E0046–CH08-E0048.
- `CH08-Q005`: definir efectos, reversibilidad, permisos y auditoría de `Archivar` y `Registro XPO`; ambos permanecen visibles pero bloqueados. Evidencia: CH08-E0043–CH08-E0045.
- `CH08-Q006`: confirmar que `Editar pago` debe resolverse como reversión más un pago nuevo o como una corrección versionada. La plataforma sólo habilita reversión append-only con motivo y conserva el comprobante original. Evidencia: CH08-E0060–CH08-E0061.
- `CH08-Q007`: entregar catálogos autorizados, obligatoriedad y dependencias para Revenue, Tipo, Solicitud, Categoría, Subcategoría, Tipo de paciente, Módulo y Adicionales. Los campos son configurables y no copian ejemplos del video. Evidencia: CH08-E0003–CH08-E0020.
- `CH08-Q008`: definir formato, secuencia, alcance organizacional y unicidad del código PI. Supabase genera UUID interno y la UI no afirma una numeración oficial. Evidencia: CH08-E0002.
- `CH08-Q009`: especificar formato, columnas, alcance, permisos y protección de los tres controles de exportación. La implementación entrega CSV sintético utilizable, sin afirmar que sea el Excel oficial. Evidencia: CH08-E0032–CH08-E0036.
- `CH08-Q010`: confirmar si existe una automatización de recordatorio/cobro, su evento, canal seguro, consentimiento, destinatario, reintentos y SLA; el audio no es concluyente y no se implementó una regla. Evidencia verbal alrededor de CH08-E0061–CH08-E0064.

## CH09 · decisiones pendientes trazadas

- `CH09-Q001`: confirmar terminología diagnóstica oficial (CIE-10, CIE-11 u otra), edición, localización, fuente autoritativa, frecuencia de actualización y política de códigos retirados. El producto no copia el catálogo parcial observado. Evidencia: CH09-E0027–CH09-E0038.
- `CH09-Q002`: definir roles autorizados para crear, activar, finalizar, anular y corregir perfiles, además de si puede coexistir más de un perfil activo por hospitalización. La implementación crea sólo borradores append-only. Evidencia: CH09-E0017–CH09-E0021 y CH09-E0067.
- `CH09-Q003`: aprobar la máquina de estados clínicos y de triage, motivos obligatorios, umbrales, doble aprobación y relación con el estado administrativo. Ninguna transición clínica se infiere. Evidencia: CH09-E0012–CH09-E0016 y CH09-E0065–CH09-E0069.
- `CH09-Q004`: entregar catálogos y dependencias oficiales para grupo diagnóstico, grupo/subgrupo de perfil, tipo de paciente, servicio, atención, frecuencias, dispositivos y grupos operativos. Los campos actuales son configurables. Evidencia: CH09-E0023–CH09-E0064.
- `CH09-Q005`: definir límites válidos del rango del reporte respecto de la hospitalización, tratamiento de periodos sin datos, zona horaria y comportamiento de carga/error en producción. Evidencia: CH09-E0081–CH09-E0113.
- `CH09-Q006`: definir semántica, fuente, permisos y auditoría de Claims, Visitas, Notas de servicio, Auditorías, Registro XPO, Relevos, Reingresos, Reinfecciones, Ulceraciones y Near miss. Permanecen visibles y bloqueados cuando no existe contrato seguro. Evidencia: CH09-E0016 y CH09-E0076.
- `CH09-Q007`: confirmar secciones iniciales, obligatorias y opcionales del reporte, orden permitido, branding y si la configuración se conserva por usuario, organización o documento. Evidencia: CH09-E0115–CH09-E0126.
- `CH09-Q008`: definir tipos, tamaños, cantidad, malware scanning, acceso, cifrado, retención y eliminación autorizada de adjuntos, además de cuáles pueden incluirse al imprimir. Adjuntar e incluir documentos permanece bloqueado. Evidencia: CH09-E0022 y CH09-E0116.
- `CH09-Q009`: aprobar plantilla oficial de PDF, numeración, encabezado, firmas, sello, tamaño de papel y validez legal de la firma. El video no demuestra un PDF final. Evidencia: CH09-E0127–CH09-E0130.
- `CH09-Q010`: definir versionado y corrección para perfiles en borrador, activos, finalizados y documentos firmados, incluidas autorización, motivo y preservación. La base actual conserva perfiles append-only y mantiene intacto el flujo de correcciones de documentos firmados. Evidencia: CH09-E0065–CH09-E0067.

## CH10 · decisiones pendientes trazadas

- `CH10-Q001`: definir roles para crear, modificar, finalizar, anular e imprimir órdenes y tarjetas. Evidencia: CH10-E0112.
- `CH10-Q002`: definir PMC, responsables y transiciones Revisar/Listo respecto de firma/finalización. La UI muestra `Regla PMC pendiente`. Evidencia: CH10-E0102, CH10-E0105 y CH10-E0113.
- `CH10-Q003`: aprobar catálogos oficiales y relaciones de vía, frecuencia, duración, horarios y PRN. Los valores observados se tratan sólo como captura configurable, no como regla terapéutica. Evidencia: CH10-E0028, CH10-E0031 y CH10-E0042.
- `CH10-Q004`: confirmar aritmética inclusiva/exclusiva inicio–duración–fin, zona horaria y comportamiento crónico. La UI ofrece una sugerencia editable que reproduce el único ejemplo, sin imponerla como regla clínica. Evidencia: CH10-E0035 y CH10-E0038.
- `CH10-Q005`: definir fuente maestra, deduplicación y permisos de alta inline para medicamentos y prescriptores. Evidencia: CH10-E0021–CH10-E0026.
- `CH10-Q006`: definir el efecto de Crónico y si Mostrar diluciones sólo captura texto o ejecuta una regla. No se calcula ninguna dilución. Evidencia: CH10-E0039 y CH10-E0050.
- `CH10-Q007`: entregar catálogo oficial de etiquetas y permisos para crear, quitar y reordenar. La implementación conserva secciones observadas configurables. Evidencia: CH10-E0075–CH10-E0086.
- `CH10-Q008`: definir sanitización, obligatoriedad, firma y política de secciones clínicas vacías. Evidencia: CH10-E0088–CH10-E0093.
- `CH10-Q009`: aprobar contenido, encabezados, firmas, papel y validez de tarjeta completa, simple y conteo presencial. Conteo se marca expresamente provisional. Evidencia: CH10-E0109.
- `CH10-Q010`: definir canal seguro, destinatarios, expiración, revocación, auditoría y retención para acceso de enfermería domiciliaria. Nunca se enviará contenido clínico en una vista previa de WhatsApp/SMS/email. Evidencia verbal: CH10-E0109–CH10-E0110.
- `CH10-Q011`: definir qué constituye Actualización, Tratamiento con cambios e Historial y la unidad de versionado. Evidencia: CH10-E0008, CH10-E0018 y CH10-E0101.
- `CH10-Q012`: definir contrato, permisos y auditoría de Registro XPO; permanece sin mutación. Evidencia: CH10-E0065 y CH10-E0099.
- `CH10-Q013`: definir campos mínimos, estados, responsable, omisión/motivo, idempotencia y correcciones para administración real. El antiguo toast de éxito simulado fue sustituido por un bloqueo explícito. Evidencia verbal: CH10-E0109–CH10-E0110.

## Datos

- Base real de pacientes y formato de importación.
- Catálogo de aseguradoras y planes.
- Catálogo de servicios.
- Catálogo de medicamentos.
- Catálogo de insumos.
- Catálogo de equipos.
- Honorarios y reglas de liquidación médica.
- Inventario inicial, bodegas, lotes y vencimientos.

## Reglas financieras

- Moneda y tratamiento de impuestos.
- Fórmula de cobertura por seguro y plan.
- Aprobación parcial.
- Descuentos autorizados y combinaciones.
- Adelantos, devoluciones, créditos y ajustes.
- Momento exacto en que una cotización se convierte en cuenta por cobrar.

## Documentos

- Cotización impresa oficial.
- Reporte de salud.
- Orden médica.
- Tarjeta de medicamentos.
- Plan de cuidados.
- Solicitud de laboratorio.
- Estado de cuenta médico.
- Encabezados, firmas, numeración y tamaño de papel.

## Integraciones

- Proveedor y credenciales de WhatsApp.
- Proveedor y credenciales de SMS.
- Correo transaccional.
- Integración con aseguradoras, si existe.
- Pasarela o conciliación de pagos, si existe.

## Seguridad y cumplimiento

- Roles definitivos.
- Política de retención.
- Consentimiento para mensajería.
- Requisitos legales locales para expediente clínico y firma.
- Responsable de aprobar plantillas clínicas.

## Operación

- Usuario que acepta formalmente el MVP.
- Horario de soporte durante producción controlada.
- Cantidad estimada de usuarios concurrentes.
- Navegadores y dispositivos utilizados.
- Definición de respaldo y recuperación requerida.
