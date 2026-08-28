# Progreso de paridad exacta

- Checkpoint: CH01–CH16 cerrados secuencialmente en `codex/exact-video-parity-production`.
- Capítulo actual: CH16 cerrado; el siguiente requisito pendiente es `CH17-R001`.
- Matriz exacta: 359 requisitos; 150 `IMPLEMENTED_EXACT`, 121 `IMPLEMENTED_PARTIAL`, 21 `NOT_TESTABLE`, 67 `NEEDS_CLIENT_CONFIRMATION`, 0 `MISSING` y 0 `CONFLICTS_WITH_VIDEO`.
- CH16: 12 requisitos; 7 exactos (`CH16-R001`–`CH16-R006`, `CH16-H002`), 2 parciales (`CH16-R007`, `CH16-H001`) y 3 bloqueados por política o alcance clínico (`CH16-R008`, `CH16-R009`, `CH16-H003`).
- Descuentos: perfiles por las siete categorías, monto fijo, vigencia, estado, elegibilidad, motivo, aprobación nominativa, exclusiones, límite, combinabilidad, auditoría, búsqueda, paginación y exportación CSV sintética; las reglas aplican a cotizaciones y una aprobación queda ligada a regla, paciente, hospitalización y líneas/cantidades.
- Supabase: se añadió `202608280001_ch16_discount_rules_and_approvals.sql`, con RLS, escrituras RPC-only y RPCs transaccionales `*_v2` para cotizaciones. No hay proyecto Supabase configurado ni CLI disponible; Docker está instalado pero su daemon no está activo. La validación runtime y de migración sigue pendiente, sin fallback a seed.
- Bloqueos CH16: `CH16-Q001`–`CH16-Q007` están en `docs/OPEN_QUESTIONS.md`; no se infirieron precedencia, combinaciones, redondeo, semántica de jubilado, permisos definitivos ni reglas clínicas/legales.
- Evidencia global: 17/17 auditorías fuente completas y 1,359/1,359 eventos observados; `npm run audit:verify` pasó tras CH16.
- Prueba focalizada: `node --test tests/ch16-discounts.test.mjs` pasó (5/5).
- Defecto QA abierto preexistente: `BASE-P1-018`; se abordará después de CH17 en el gate pre-React.
- Legacy: aplicación y standalone permanecen como respaldo temporal; React/Next.js no se inició.
