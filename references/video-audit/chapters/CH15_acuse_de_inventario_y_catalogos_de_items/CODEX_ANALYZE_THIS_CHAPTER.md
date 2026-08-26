# Tarea Codex: auditoría funcional de CH15

## Capítulo

**Acuse de inventario y catálogos de ítems**  
Rango principal: **2728s a 2983s**  
Entrega/acuse e ítems maestros de medicamentos, insumos, estudios, honorarios y servicios.

## Regla de trabajo

Analiza únicamente este capítulo y **no modifiques el producto todavía**. La auditoría debe completarse antes de programar.

1. Lee `README.md`, `coverage.json`, `event_manifest.csv` y `transcript_raw.txt`.
2. Revisa `CODEX_IMAGE_BATCHES.md` para alimentar las imágenes en lotes manejables.
3. Revisa todas las hojas de `contact_sheets_events/` en orden.
4. Abre individualmente **cada imagen** de `event_frames/`; cuando exista, abre también su archivo en `detail_crops/`.
5. Revisa todas las hojas de `contact_sheets_safety/`. Estas capturas fijas protegen contra cambios que el detector no seleccionó.
6. Cruza lo visible con la transcripción. La transcripción automática puede contener errores.
7. Usa `chapter_video_exact_reference.mp4` como fuente final para resolver dudas de secuencia, audio o cambios demasiado breves. No asumas que el video se interpreta como modalidad directa.
8. Clasifica cada hallazgo como `VISIBLE`, `VERBAL`, `INFERRED` o `UNCERTAIN`.

## Entregables obligatorios

- `chapter_feature_inventory.json`
- `chapter_feature_inventory.md`
- `chapter_open_questions.md`
- `chapter_review_receipt.json`

Cada función, campo, botón, pestaña, estado, tabla, columna, impresión, validación o flujo debe incluir: `chapter_event_id`, timestamp, ruta de imagen y observación exacta.

El JSON debe separar: pantallas, navegación, formularios/campos, tablas/columnas, acciones, estados/transiciones, reglas explícitas, reglas inferidas, documentos/impresiones, entidades de datos, permisos aparentes, integraciones, errores y preguntas abiertas.

## Gate de cobertura

Copia la estructura de `../../core_toolkit/templates/chapter_review_receipt.template.json`. El recibo debe listar todos los eventos, hojas y recortes revisados. Luego ejecuta:

```bash
python ../../core_toolkit/scripts/verify_chapter_review.py .
```

No declares terminado el capítulo hasta obtener `"passed": true`.
