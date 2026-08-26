# Prompt maestro para Codex · Auditoría completa del video antes de programar

Actúa como analista funcional senior, arquitecto de software, QA lead y auditor de trazabilidad para el proyecto **Analiza en Casa**.

## Misión

Reconstruir con evidencia toda la funcionalidad del sistema mostrado en el video y compararla con la plataforma actual, sin omitir pantallas, campos, pestañas, acciones, estados, documentos, filtros, reglas o flujos alternos.

No programes durante la primera fase. Primero debes demostrar que revisaste todo el material.

## Fuente de evidencia

Lee primero:

1. `VIDEO_AUDIT_PROTOCOL.md`
2. `CHAPTERS.json`
3. El `README.md` y `CODEX_ANALYZE_THIS_CHAPTER.md` del capítulo asignado.
4. `coverage.json`
5. `event_manifest.csv`
6. Todas las imágenes del capítulo.
7. La transcripción del capítulo, cuando exista.

Codex admite imágenes como entrada, pero el modelo de Codex no admite audio ni video como modalidades directas. Por eso, usa los clips solo como archivo de referencia que puede ser procesado con herramientas; la inspección multimodal obligatoria se realiza sobre las capturas y los recortes.

## Método por capítulo

Para el capítulo asignado:

1. Revisa todas las imágenes de `contact_sheets_events/` en orden.
2. Abre individualmente **cada archivo** de `event_frames/`.
3. Cuando exista una imagen equivalente en `detail_crops/`, ábrela también.
4. Revisa todas las hojas de `contact_sheets_safety/` para detectar estados no seleccionados por el detector.
5. Cruza lo visible con `transcript_raw.*`.
6. No asumas que un comportamiento está implementado solo porque se menciona verbalmente.
7. Marca como `INCIERTO` toda regla no comprobable.

## Entregables obligatorios por capítulo

Crea:

- `chapter_feature_inventory.json`
- `chapter_feature_inventory.md`
- `chapter_open_questions.md`
- `chapter_review_receipt.json`

`chapter_review_receipt.json` debe listar:

- Todos los `chapter_event_id` revisados.
- Todas las hojas de `contact_sheets_events/` revisadas.
- Todas las hojas de `contact_sheets_safety/` revisadas.
- Todos los recortes de detalle revisados.
- Confirmación de lectura de README, cobertura, manifest y transcripción.
- Confirmación de consulta del clip exacto para resolver incertidumbres.
- Fecha y resumen de dudas.

## Regla de trazabilidad

Cada elemento funcional debe tener evidencia:

```json
{
  "name": "Nombre de la función",
  "classification": "VISIBLE | VERBAL | INFERRED | UNCERTAIN",
  "evidence": [
    {
      "chapter_id": "CH05",
      "chapter_event_id": "CH05-E0012",
      "timestamp": "00:08:15.400",
      "image": "event_frames/...jpg",
      "observation": "Qué se ve exactamente"
    }
  ]
}
```

No aceptes requisitos sin evidencia. No uses frases genéricas como “gestiona pacientes” cuando el video muestra campos, estados y acciones específicas.

## Categorías mínimas del inventario

- Pantallas y subpantallas.
- Navegación y menús.
- Pestañas.
- Formularios y campos.
- Campos obligatorios, opcionales y calculados.
- Selectores y opciones visibles.
- Tablas y columnas.
- Búsquedas y filtros.
- Botones y acciones.
- Modales y confirmaciones.
- Estados y transiciones.
- Validaciones y mensajes.
- Impresiones, PDFs y exportaciones.
- Integraciones aparentes.
- Entidades y relaciones de datos.
- Roles y permisos aparentes.
- Reglas explícitas.
- Reglas inferidas.
- Excepciones y dudas.

## Control de cobertura

Al terminar un capítulo ejecuta:

```bash
python tools/video-audit/scripts/verify_chapter_review.py \
  references/video-audit/chapters/<CAPITULO>
```

No declares terminado el capítulo mientras el verificador reporte imágenes o eventos sin revisar.

## Consolidación después de los 17 capítulos

Crea:

- `MASTER_VIDEO_REQUIREMENTS.json`
- `MASTER_VIDEO_REQUIREMENTS.md`
- `MASTER_FEATURE_MATRIX.csv`
- `MASTER_OPEN_QUESTIONS.md`

Deduplica requisitos repetidos, pero conserva todas las evidencias.

## Comparación contra la plataforma actual

Inspecciona el código, las rutas, componentes, API, base de datos, migraciones y pruebas. Genera `VIDEO_VS_PLATFORM_GAP_MATRIX.csv` con:

- Requirement ID.
- Módulo.
- Requisito.
- Evidencia del video.
- Evidencia de código.
- Estado de cobertura.
- Severidad.
- Dependencias.
- Criterios de aceptación.
- Prueba propuesta.

No modifiques el producto hasta que la matriz sea revisada y aprobada.

## Criterio de terminado

La auditoría solo termina cuando:

- Los 17 recibos pasan el verificador.
- Cada requisito tiene evidencia visual o verbal.
- Cada evento visual fue marcado como revisado.
- Todas las hojas de seguridad fueron revisadas.
- La matriz contra la plataforma no contiene filas sin clasificación.
- Las dudas reales están separadas de las inferencias.
