# Alcance de las matrices de video

`docs/VIDEO_VS_PLATFORM_GAP_MATRIX.csv` es el inventario de brechas del baseline legado (`app/` y rutas `#/...`). Conserva el estado histórico de aquella implementación y sus seis estados de gap permitidos.

`docs/qa/VIDEO_TO_REACT_TRACEABILITY.json` es el registro activo de React (`apps/web/`). Sus valores `EXACT`, `PARTIAL`, `MISSING`, `BLOCKED_CLIENT`, `BLOCKED_INTEGRATION`, `NOT_TESTABLE` y `NOT_APPLICABLE` son estados de certificación de trazabilidad, no sustitutos de los estados de gap del baseline.

Los dos artefactos comparten `requirement_id`, evidencia y preguntas abiertas, pero no deben compararse como si describieran el mismo runtime. La certificación de release usa `npm run qa:video-parity`, `npm run qa:traceability-mirror` y los gates de aplicación React. El resultado `210/210` significa que las 210 filas canónicas están trazadas y pasan esas comprobaciones estructurales; no significa que 210 requisitos estén implementados de forma exacta.

Los requisitos pendientes o bloqueados permanecen explícitos en `docs/OPEN_QUESTIONS.md`, la trazabilidad React y el estado de reparación. No se convierten en funcionalidades clínicas, financieras o de integración sin evidencia y aprobación autorizadas.
