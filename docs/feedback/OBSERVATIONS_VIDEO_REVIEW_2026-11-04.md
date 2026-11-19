# Revisión acotada de regresión: observaciones clínicas del 4 de noviembre

Revisión de evidencia y código de partida, sin editar la aplicación ni las matrices. No certifica los capítulos completos, los 17 videos ni la implementación que se está preparando.

Fuente nueva: `obserclini1_.pdf`, tres páginas, SHA-256 `532bc8f79dd9de60f0a0fb11f36e8ac67dbe5c328ea1e852dfd4906fd785bc70`. Se abrieron visualmente las tres páginas renderizadas. No se copiaron sus capturas a Git, pues contienen datos identificables. La instrucción del usuario autoriza implementar las observaciones, que prevalecen sobre la disposición visual anterior.

## Hallazgos y límites para la implementación

1. **Navegación.** Los cinco enlaces solicitados son Cotizaciones, Ingresos clínicos, Agenda, Expediente clínico y Órdenes médicas, en ese orden. Retirar los enlaces duplicados del menú no debe eliminar los registros, las rutas antiguas, los permisos ni las entradas integradas en Órdenes médicas. Probar también navegación directa e historial del navegador.
2. **Mini tarjetas médicas.** El PDF pide Indicación, Evolución, Historia, Antecedentes y Signos vitales. El signo vital es un mismo registro consultable desde ambas agrupaciones; no duplicarlo en el expediente completo ni generar dos escrituras. Conservar las notas, evoluciones y signos anteriores a la nueva estructura.
3. **Visitas.** Separar las visitas registradas de los turnos programados: un turno no prueba que la visita ocurrió. `Visit` contiene `professionalUserId`, `profession` y `occurredAt` como fecha/hora ISO con offset; no contiene JVPE. Resolver el recurso mediante `userId`, nunca por coincidencia del nombre. Mostrar ausencia explícita del JVPE si no está registrado. Presentar fecha y hora con la misma zona horaria. Los turnos actuales no identifican hospitalización; no atribuirlos silenciosamente al caso seleccionado. Preservar las visitas médicas aunque el bloque solicitado priorice las enfermeras.
4. **Menús de acciones.** El defecto de partida es funcional: en `clinical-actions.tsx`, solo `MEDICATION_CARD` construía acciones de registros guardados; las otras categorías de enfermería abrían un contenedor sin opciones. Generalizar a registros del paciente y tipo seleccionado, sin tomar accidentalmente un registro de otra persona. Mostrar contexto de fecha/caso cuando hay varios. Si no existe un registro, indicar el estado vacío; no presentar Ver/Editar/Imprimir como acciones exitosas sin contenido. Los usuarios de solo lectura pueden consultar/imprimir, pero no corregir.
5. **Edición clínica.** El rótulo Editar no autoriza sobrescritura: conservar motivo, versión original, identidad paciente/caso, auditoría y rechazo de versiones obsoletas. Las administraciones estaban expresamente bloqueadas para corrección en la persistencia inicial; habilitarlas requiere una solución de datos además del botón. Una corrección no debe descontar de nuevo las mismas existencias, ni duplicar devoluciones o efectos financieros. Reintentos y dos correcciones concurrentes requieren pruebas transaccionales.
6. **Tarjeta simplificada.** La nueva fuente elimina el campo de instrucciones y la configuración de existencias de este formulario. Esto sustituye parcialmente CR-019 y CH10-F04: conservar el texto fuente anterior y registrar la exclusión/aprobación nueva, sin borrar instrucciones o asignaciones ya guardadas. Las versiones históricas y su impresión deben seguir mostrando su contenido original. Retirar campos de la tarjeta no debe dejar imposible el registro de una aplicación ni asumir unidades o dosis: mantener una vía explícita para los datos de inventario necesarios en el flujo que corresponda.
7. **Planes combinados.** El video ya permite Dieta y Cuidados simultáneos; el nuevo PDF define Dieta, Cuidado de enfermería y Laboratorio como selección múltiple. Validar al menos un tipo. Laboratorio debe imponerse también en servidor cuando la cotización de ese paciente/caso contenga estudios, evitando que una petición manual eluda la regla. Guardar el contenido de los estudios junto al registro para que cambios posteriores de la cotización no reescriban el historial. No agregar exámenes clínicos que no existan en la cotización.
8. **Administración.** El PDF coloca selección/aplicación/motivo por medicamento antes de Hora/Dosis/Presentación/Vía. Es una reordenación del formulario: debe conservar valores al alternar aplicado/no aplicado y al guardar/corregir. La dosis sigue siendo entrada humana, sin cálculos clínicos nuevos.
9. **Filtro redundante.** Retirar el campo “Filtrar hospitalizaciones por paciente, DUI o código” de los formularios indicados no elimina el selector de hospitalización ni su filtro estricto por paciente. Conservar la búsqueda por nombre/DUI del listado principal, que la fuente anterior pidió explícitamente.

## Evidencia histórica abierta

Además de README, coverage, transcript y filas pertinentes de event_manifest de CH10 y CH17, se abrieron estas imágenes. Los identificadores y tiempos se comprobaron en los manifiestos. Las observaciones describen elementos de interfaz; no reproducen contenido clínico ni identidades de las capturas.

| Requisito | Capítulo/evento/tiempo | Ruta de evidencia abierta | Observación |
| --- | --- | --- | --- |
| Tratamiento e instrucciones | CH10 / CH10-E0050 / 00:29:08.800 | `references/video-audit/chapters/CH10_orden_medica_tratamientos_y_tarjeta_de_medicamentos/detail_crops/CH10-E0050_00h29m08s800ms_DETAIL.jpg` | El editor previo tiene horarios, indicaciones y Mostrar diluciones. El nuevo PDF retira el campo de la tarjeta; registrar la sustitución de fuente sin destruir datos anteriores. |
| Plan combinado | CH10 / CH10-E0091 / 00:29:52.400 | `references/video-audit/chapters/CH10_orden_medica_tratamientos_y_tarjeta_de_medicamentos/event_frames/CH10-E0091_00h29m52s400ms_abrupt_change.jpg` | Dieta y Cuidados de Enfermería aparecen simultáneamente como secciones. |
| Consulta e impresión | CH10 / CH10-E0109 / 00:30:13.200 | `references/video-audit/chapters/CH10_orden_medica_tratamientos_y_tarjeta_de_medicamentos/detail_crops/CH10-E0109_00h30m13s200ms_DETAIL.jpg` | Hay tres variantes históricas de impresión de tarjeta. Un botón nuevo Imprimir no acredita por sí mismo paridad exacta con las tres variantes. |
| Tabla de notas | CH17 / CH17-E0043 / 00:52:08.400 | `references/video-audit/chapters/CH17_reporte_de_salud_detallado_e_impresion/detail_crops/CH17-E0043_00h52m08s400ms_DETAIL.jpg` | Se observan columnas Imprimir, Acciones, Fecha nota, Información y Nota. |
| Corrección de nota | CH17 / CH17-E0048 / 00:52:14.800 | `references/video-audit/chapters/CH17_reporte_de_salud_detallado_e_impresion/detail_crops/CH17-E0048_00h52m14s800ms_DETAIL.jpg` | Hay una nota editable y control de guardado; la captura no acredita versionado ni permisos del servidor. |

Contactos visuales adicionales abiertos:

- CH10: `contact_sheets_events/events_011.jpg` y `contact_sheets_safety/safety_009.jpg`, dentro de su directorio de capítulo. La secuencia muestra selección y coexistencia de varias secciones del plan.
- CH17: `contact_sheets_events/events_006.jpg` y `contact_sheets_safety/safety_005.jpg`, dentro de su directorio de capítulo. La secuencia muestra Editar y luego guardado de nota; no demuestra una política segura de sobrescritura.

No se alteraron los ledgers históricos ni se marcaron eventos adicionales como revisados. No se abrió el clip completo: para estas observaciones visuales acotadas se usaron las imágenes y los textos indicados; no se afirma auditoría completa del capítulo.

## Regresión mínima a exigir

- Guardar, recargar, Ver, Editar con motivo e Imprimir en cada categoría solicitada; estados sin registros y con varios casos del mismo paciente.
- Plan de uno, dos y tres tipos; laboratorio forzado por cotización; envío HTTP que intenta omitirlo; lectura de planes antiguos de tipo único.
- Tarjetas nuevas sin los campos retirados y tarjetas antiguas que conservan su información en consulta/impresión.
- Aplicación y no aplicación, corrección en ambos sentidos, reintento con la misma clave, corrección obsoleta y dos correcciones concurrentes; existencias y devoluciones sin duplicados.
- Enfermería, médico y auditor; denegación de escritura sin permiso y aislamiento entre organizaciones.
- Tabla de visitas con datos faltantes, turno programado, visita médica y cambio de fecha al convertir zona horaria; paciente y caso correctos en impresión.
- Menús con teclado y a 390 px; texto sin recortes y formulario de administración en el orden nuevo.

Mantener los estados conservadores de CH10/CH17 y las exclusiones históricas. Los gates y pruebas de la implementación deben ejecutarse y registrarse por el agente principal antes de promover cualquier estado.
