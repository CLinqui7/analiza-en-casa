# Inventario de funciones · CH04

El capítulo confirma los datos generales de Nueva cotización. El ASR es ruidoso y no autoriza convertir fechas, descuentos, precios o reglas de negocio en constantes.

| ID | Clasificación | Función | Evidencia principal | Límite |
|---|---|---|---|---|
| CH04-F001 | VISIBLE | Formulario por secciones Paciente, Factura e ítems | CH04-E0006 · 00:06:27.600 · `event_frames/CH04-E0006_00h06m27s600ms_abrupt_change.jpg` | No hay guardado o envío. |
| CH04-F002 | VISIBLE | Selector de paciente buscable por documento/etiqueta | CH04-E0002 · 00:06:18.200 · `detail_crops/CH04-E0002_00h06m18s200ms_DETAIL.jpg` | Alcance y anti-enumeración no probados. |
| CH04-F003 | UNCERTAIN | Resultados de Paciente rotulados como Cotización | CH04-E0003 · 00:06:18.800 · `detail_crops/CH04-E0003_00h06m18s800ms_DETAIL.jpg` | Posible cotización abierta o datos de prueba. |
| CH04-F004 | VISIBLE | Autocompletado de DUI/NIT, teléfono y correo | CH04-E0005 · 00:06:21.800 · `detail_crops/CH04-E0005_00h06m21s800ms_DETAIL.jpg` | Editabilidad y privacidad no demostradas. |
| CH04-F005 | VISIBLE | Fecha requerida con calendario | CH04-E0007 · 00:06:30.600 · `detail_crops/CH04-E0007_00h06m30s600ms_DETAIL.jpg` | El valor visible no es una regla. |
| CH04-F006 | VISIBLE | Grupo de descuento obligatorio con Regular visible | CH04-E0008 · 00:06:33.000 · `event_frames/CH04-E0008_00h06m33s000ms_settled.jpg` | Catálogo y cálculo no probados. |
| CH04-F007 | VISIBLE | Referido por buscable, multiselección y tags removibles | CH04-E0032 · 00:06:59.600 · `detail_crops/CH04-E0032_00h06m59s600ms_DETAIL.jpg` | Máximos y efectos desconocidos. |
| CH04-F008 | UNCERTAIN | Catálogo de referidos mezcla canales, estado, entidad y personas | CH04-E0014 · 00:06:42.000 · `detail_crops/CH04-E0014_00h06m42s000ms_DETAIL.jpg` | Modelo de datos sin confirmar. |
| CH04-F009 | VISIBLE | Botón + junto a Referido por | CH04-E0009 · 00:06:34.800 · `event_frames/CH04-E0009_00h06m34s800ms_abrupt_change.jpg` | No se pulsa. |
| CH04-F010 | VISIBLE | Giftcard opcional y Comentarios obligatorio | CH04-E0034 · 00:07:01.000 · `event_frames/CH04-E0034_00h07m01s000ms_abrupt_change.jpg` | No se validan ni guardan. |
| CH04-F011 | VISIBLE | Categorías Servicios, Estudios Dx, Medicamentos, Insumos, Equipos, Honorarios y Extras | CH04-E0035 · 00:07:01.600 · `event_frames/CH04-E0035_00h07m01s600ms_stable_change.jpg` | CH05 continúa la selección de ítems. |

La evidencia estructurada completa con `chapter_id`, evento, timestamp, ruta y transcripción está en `chapter_feature_inventory.json`.
