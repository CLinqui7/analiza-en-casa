# Progreso de paridad exacta

- Checkpoint: CH01–CH15 cerrados secuencialmente en `codex/exact-video-parity-production`.
- Capítulo actual: CH15 cerrado; la ejecución debe detenerse después del push.
- CH16 y CH17 no fueron iniciados; tampoco React ni Next.js.
- Matriz exacta: 347 requisitos; 143 `IMPLEMENTED_EXACT`, 119 `IMPLEMENTED_PARTIAL`, 21 `NOT_TESTABLE`, 64 `NEEDS_CLIENT_CONFIRMATION`, 0 `MISSING` y 0 `CONFLICTS_WITH_VIDEO`.
- CH15: 18 requisitos; 5 exactos (`CH15-R007`, `CH15-R008`, `CH15-R011`, `CH15-H001`, `CH15-H002`), 8 parciales y 5 bloqueados directamente por cliente.
- Requisitos CH15 exactos: descarte seguro de cambios; CRUD/inactivación de catálogos; confirmación antes de éxito; integridad tenant-safe e historial; importación CSV validada y atómica.
- Bloqueos CH15: `CH15-Q001`–`CH15-Q009`, documentados en `docs/OPEN_QUESTIONS.md`; no se inventaron reglas de acuse, stock, bodega, cierre, autorización, tarifa o descuento.
- Primer requisito pendiente: `CH16-R001`. No fue derivado ni implementado durante este checkpoint.
- Evidencia global: 17/17 auditorías fuente completas y 1,359/1,359 eventos observados.
- Supabase: migración `20260827140639_ch15_catalogs.sql` y adaptador implementados; ejecución runtime pendiente por falta de proyecto configurado.
- Legacy: aplicación y standalone preservados como respaldo temporal; la arquitectura React objetivo queda para la continuación Terra.
- Defecto QA abierto preexistente: `BASE-P1-018`; validación runtime Supabase pendiente: `CH15-P1-003`.
