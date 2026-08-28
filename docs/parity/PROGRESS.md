# Progreso de paridad exacta

- Checkpoint: CH01–CH17 cerrados secuencialmente en `codex/client-audio-selenium-hardening`.
- Matriz exacta: 372 requisitos; 157 `IMPLEMENTED_EXACT`, 125 `IMPLEMENTED_PARTIAL`, 21 `NOT_TESTABLE`, 69 `NEEDS_CLIENT_CONFIRMATION`, 0 `MISSING` y 0 `CONFLICTS_WITH_VIDEO`.
- CH17: listado de reportes, búsqueda, rango, información principal, seguros seleccionables, configuración de impresión, subpestañas de evaluación, antecedentes, signos por origen y notas de enfermería con búsqueda/paginación/selección de impresión están cubiertos por pruebas focalizadas y navegador.
- Documentos clínicos: la firma es metadata de aplicación, no firma electrónica legal. Los documentos firmados conservan versión; correcciones, addenda, enmiendas y anulaciones requieren autorización, motivo y auditoría.
- Bloqueos CH17: formato y validez oficial de impresión, catálogo/política de alergias, IA clínica, WhatsApp y matriz definitiva de roles permanecen en `docs/OPEN_QUESTIONS.md`.
- Evidencia global: 17/17 auditorías fuente completas y 1,359/1,359 eventos observados; la matriz sólo reutiliza evidencia CH17 ya revisada.
- Gate pre-React pendiente: resolver `BASE-P1-018`, ejecutar `npm run check`, `npm run audit:verify` y `npm run codex:preflight`.
- Supabase: no hay proyecto configurado ni daemon Docker activo; la validación de migraciones/RLS en runtime permanece pendiente y no usa fallback a seed.
- Legacy sigue siendo la aplicación principal hasta completar la migración React/Next.js.
