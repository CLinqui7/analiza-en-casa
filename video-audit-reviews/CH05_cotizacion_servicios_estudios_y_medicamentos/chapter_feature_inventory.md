# Inventario de funciones · CH05

El capítulo confirma la composición de líneas de Servicios y la búsqueda/selección de Medicamentos. Los importes, conteos y cantidades pertenecen a la grabación: no deben convertirse en precios, tasas, existencias o reglas clínicas fijas.

| ID | Clasificación | Función | Evidencia principal | Límite |
|---|---|---|---|---|
| CH05-F001 | VISIBLE | Siete categorías de conceptos | CH05-E0001 · 00:07:32.200 · `event_frames/CH05-E0001_00h07m32s200ms_abrupt_change.jpg` | Solo Servicios y Medicamentos se recorren. |
| CH05-F002 | VISIBLE | Socio de negocios y lista de precios | CH05-E0003 · 00:07:49.400 · `detail_crops/CH05-E0003_00h07m49s400ms_DETAIL.jpg` | Elegibilidad y vigencia no demostradas. |
| CH05-F003 | VISIBLE | Overlay `Procesando...` | CH05-E0021 · 00:08:14.600 · `event_frames/CH05-E0021_00h08m14s600ms_abrupt_change.jpg` | Error, reintento e idempotencia no probados. |
| CH05-F004 | VISIBLE | Búsqueda incremental de Servicios | CH05-E0025 · 00:08:27.200 · `detail_crops/CH05-E0025_00h08m27s200ms_DETAIL.jpg` | Ranking y alcance desconocidos. |
| CH05-F005 | VISIBLE | Servicio seleccionado autocompleta precio | CH05-E0050 · 00:09:16.200 · `detail_crops/CH05-E0050_00h09m16s200ms_DETAIL.jpg` | Precio visible no es constante. |
| CH05-F006 | VISIBLE | Cantidad requerida y Añadir | CH05-E0052 · 00:09:30.400 · `event_frames/CH05-E0052_00h09m30s400ms_abrupt_change.jpg` | Unidades y validaciones no probadas. |
| CH05-F007 | VISIBLE | Ledger agrupado por tipo con columnas financieras | CH05-E0054 · 00:09:31.400 · `event_frames/CH05-E0054_00h09m31s400ms_abrupt_change.jpg` | Eliminar, editar y persistir no se prueban. |
| CH05-F008 | VISIBLE | Resumen de subtotal, descuentos, impuesto y total | CH05-E0067 · 00:09:56.400 · `event_frames/CH05-E0067_00h09m56s400ms_abrupt_change.jpg` | No se infiere fórmula o tasa. |
| CH05-F009 | VISIBLE | Dos líneas de Servicios coexistentes | CH05-E0065 · 00:09:50.400 · `detail_crops/CH05-E0065_00h09m50s400ms_DETAIL.jpg` | Taxonomía Servicio/Equipo sin confirmar. |
| CH05-F010 | VISIBLE | Compositor específico de Medicamentos | CH05-E0071 · 00:10:42.400 · `detail_crops/CH05-E0071_00h10m42s400ms_DETAIL.jpg` | Persistencia del socio entre categorías desconocida. |
| CH05-F011 | VISIBLE | Medicamentos muestran conteos entre paréntesis | CH05-E0075 · 00:10:46.800 · `detail_crops/CH05-E0075_00h10m46s800ms_DETAIL.jpg` | Semántica y bodega del conteo desconocidas. |
| CH05-F012 | VISIBLE | Estado `No results found` recuperable | CH05-E0077 · 00:10:48.800 · `detail_crops/CH05-E0077_00h10m48s800ms_DETAIL.jpg` | No cubre error de red o catálogo vacío. |
| CH05-F013 | VISIBLE | Medicamento seleccionado autocompleta precio | CH05-E0079 · 00:10:54.800 · `detail_crops/CH05-E0079_00h10m54s800ms_DETAIL.jpg` | Valores de grabación, no tarifario. |
| CH05-F014 | UNCERTAIN | Añadir Invanz procesa y restablece compositor | CH05-E0080 · 00:11:04.400 · `detail_crops/CH05-E0080_00h11m04s400ms_DETAIL.jpg` | La fila de Medicamentos no entra en el encuadre. |
| CH05-F015 | VISIBLE | Checkbox de inventario y botones Atrás/Guardar | CH05-E0067 · 00:09:56.400 · `event_frames/CH05-E0067_00h09m56s400ms_abrupt_change.jpg` | Ninguna acción se ejecuta. |

La trazabilidad estructurada completa, incluida `chapter_id`, evento, timestamp, frame/crop y referencia a transcripción, está en `chapter_feature_inventory.json`.
