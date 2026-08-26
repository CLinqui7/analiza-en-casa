# Configuración de la auditoría forense del video

## Objetivo

Antes de construir nuevas funciones, reconstruir el sistema del video completo y comparar cada requisito contra la plataforma actual.

## Instalación de la evidencia

1. Descargue los cuatro ZIP de evidencia.
2. Copie los cuatro ZIP, sin cambiarles el nombre, dentro de `evidence_downloads/`.
3. Ejecute `INSTALL_EVIDENCE.bat`.
4. Espere el mensaje `INSTALACION COMPLETA`.
5. Ejecute `references/video-audit/START_REVIEW.bat`.

El instalador extrae y fusiona automáticamente los 17 capítulos bajo `references/video-audit/chapters/`. No es necesario copiar cientos de archivos a mano.

## Orden obligatorio

1. Lea `tools/video-audit/VIDEO_AUDIT_PROTOCOL.md`.
2. Lea `tools/video-audit/PROMPT_CODEX_VIDEO_AUDIT_MASTER.md`.
3. Abra un hilo de Codex por capítulo.
4. No modifique el producto durante la auditoría.
5. Complete los 17 inventarios y recibos de revisión.
6. Ejecute el verificador de cada capítulo.
7. Consolide requisitos.
8. Genere la matriz `VIDEO_VS_PLATFORM_GAP_MATRIX.csv`.
9. Solo entonces apruebe el backlog de construcción.

## Regla de imagen

Codex recibe imágenes, pero no audio ni video como modalidades directas. Cada capítulo incluye `CODEX_IMAGE_BATCHES.md` para adjuntar sus hojas de contacto en lotes manejables. El clip exacto queda como fuente final para resolver secuencia y audio.
