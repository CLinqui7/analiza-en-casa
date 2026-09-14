# Revisión de requisitos de video

La evidencia instalada está en `references/video-audit/`: 17 capítulos con
manifiestos, transcripciones, imágenes y clips. Esa carpeta es inmutable.
Los resultados de revisión se guardan en `video-audit-reviews/`.

## Procedimiento

1. Leer [el protocolo](../tools/video-audit/VIDEO_AUDIT_PROTOCOL.md).
2. Abrir el README, cobertura, manifiesto y transcripción del capítulo.
3. Revisar hojas de contacto, imágenes de eventos, hojas de seguridad y recortes.
4. Consultar el clip exacto cuando exista una duda de secuencia o contenido.
5. Registrar una observación por evento y referencias verificables por requisito.
6. Ejecutar la verificación y corregir referencias faltantes antes de cerrar el capítulo.
7. Consolidar la matriz funcional y contrastarla con código y pruebas.

```powershell
npm run audit:status
npm run audit:verify
npm run qa:video-parity
```

El protocolo incluye un verificador por capítulo en
`tools/video-audit/scripts/verify_chapter_review.py`.
Un resultado estructural correcto no demuestra por sí solo paridad visual o funcional.
No modificar etiquetas de certificación sin la prueba correspondiente.
Los nombres originales del material fuente se conservan para mantener sus referencias.
