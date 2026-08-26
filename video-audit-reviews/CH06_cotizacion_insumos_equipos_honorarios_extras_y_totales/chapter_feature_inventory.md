# Inventario funcional · CH06

Alcance: evidencia fuente revisada de forma visual y documental. El estado frente a la plataforma actual queda `NOT_TESTABLE` porque este subencargo no incluyó ejecutar una comparación funcional.

| ID | Función | Clasificación | Evidencia principal |
|---|---|---|---|
| CH06-F01 | Pestañas Servicios, Estudios Dx, Medicamentos, Insumos, Equipos, Honorarios y Extras; filtro de disponibilidad | VISIBLE | CH06-E0007 · 00:11:34.600 · `event_frames/CH06-E0007_00h11m34s600ms_abrupt_change.jpg` |
| CH06-F02 | Catálogo dependiente del socio de negocios y búsqueda textual | VISIBLE | CH06-E0053 · 00:12:34.800 · `detail_crops/CH06-E0053_00h12m34s800ms_DETAIL.jpg` |
| CH06-F03 | Insumos con código, fabricante, existencia, precio y cantidad | VISIBLE | CH06-E0025/E0030 · 00:11:58.200–00:12:02.000 |
| CH06-F04 | Estudios Dx buscables y añadibles | VISIBLE + VERBAL | CH06-E0060 · 00:12:43.000; transcripción 00:12:00–00:12:17.760 |
| CH06-F05 | Honorarios por profesional/servicio | VISIBLE | CH06-E0083 · 00:13:15.800 |
| CH06-F06 | Tabla agrupada con cantidades, descuentos, impuesto y total por renglón | VISIBLE | CH06-E0069 · 00:12:57.800 |
| CH06-F07 | Grupo de descuento y resumen recalculado | VISIBLE | CH06-E0109/E0115 · 00:14:14.200–00:14:24.200 |
| CH06-F08 | Autocompletado de datos al cambiar paciente | VISIBLE | CH06-E0103 · 00:14:06.400 |
| CH06-F09 | Guardar y volver | VERBAL | CH06-E0115 · 00:14:24.200; transcripción 00:14:20–00:14:30 |
| CH06-F10 | Contenido interno de Equipos y Extras | UNCERTAIN | Sólo se ven las pestañas; no se ejercitan |

Todas las rutas completas y los detalles se conservan en `chapter_feature_inventory.json` y en las 115 filas de `event_review_notes.csv`.
