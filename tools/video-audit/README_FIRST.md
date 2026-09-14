# Herramientas de revisión de video

Este directorio contiene el protocolo, plantillas y verificadores de evidencia.
La fuente instalada está en `references/video-audit/` y se mantiene inmutable.
Los recibos y observaciones se guardan en `video-audit-reviews/`.

Comenzar por [VIDEO_AUDIT_PROTOCOL](VIDEO_AUDIT_PROTOCOL.md) y
[la guía de revisión](../../docs/VIDEO_AUDIT_SETUP.md).
Cada requisito debe citar capítulo, evento, timestamp y archivo de evidencia.

```powershell
npm run audit:status
npm run audit:verify
```

El verificador por capítulo está en `scripts/verify_chapter_review.py`.
Los scripts de extracción conservan el procedimiento de generación original;
no deben ejecutarse sobre la evidencia instalada para sustituir sus archivos.
