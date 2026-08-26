# CH09 · Hospitalización clínica y reporte de salud

**Rango principal:** 1260.00s a 1640.00s  
**Descripción:** Perfil clínico, diagnósticos, dispositivos, reportes y configuración del documento.

## Evidencia disponible

- `chapter_video_exact_reference.mp4`: video y audio del capítulo, con 1 segundo de solape como protección de borde.
- `event_frames/`: estados de interfaz detectados cuando cambia la pantalla.
- `detail_crops/`: ampliaciones de menús, modales, tablas o áreas que cambiaron.
- `safety_frames_1fps/`: una captura por segundo, independientemente de la detección.
- `contact_sheets_events/`: recorrido visual rápido de los eventos.
- `contact_sheets_safety/`: comprobación cronológica de cobertura.
- `event_manifest.csv`: IDs, timestamps y rutas de evidencia.

La fuente de verdad final sigue siendo el clip. Las capturas permiten que Codex, que admite imágenes pero no video o audio como modalidad directa, trabaje sin tragarse los 54 minutos de una sola vez.
