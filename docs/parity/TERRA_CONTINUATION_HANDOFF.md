# Continuación Terra después del checkpoint CH15

## 1. Rama actual

`codex/exact-video-parity-production`.

## 2. Último commit antes del checkpoint

`90a228c chore: checkpoint exact parity through CH14`.

## 3. Estado CH01-CH15

CH01–CH15 están cerrados secuencialmente y trazados en la matriz. La evidencia fuente permanece 17/17 completa; este checkpoint no reabrió CH01–CH14 ni inició CH16/CH17.

## 4. Requisitos CH15 terminados

- `CH15-R007`: protección visible ante descarte de cambios no guardados.
- `CH15-R008`: alta, edición e inactivación real de catálogos con validación, proveedor, vigencia, búsqueda, filtros, paginación, permisos y auditoría.
- `CH15-R011`: estado visible de procesamiento y confirmación de persistencia antes del éxito.
- `CH15-H001`: SKU único por organización, persistencia tenant-safe, historial append-only de precios/cambios y prohibición de borrado.
- `CH15-H002`: importación CSV con preview, errores, duplicados, atomicidad y auditoría de lote.
- La unidad atómica de catálogos quedó cubierta por pruebas unitarias y de navegador; `CH15-R006`, `R010`, `R012` y `R013` conservan la parte operativa segura y permanecen parciales sólo donde dependen de reglas del cliente.

## 5. Requisitos CH15 bloqueados

- `CH15-R001` y la parte persistente de `CH15-R003`: `CH15-Q001`.
- `CH15-R002` y la parte de bodegas/permisos de `CH15-R003`: `CH15-Q002`.
- `CH15-R004` y `CH15-R005`: `CH15-Q003`.
- Semántica de banderas de `CH15-R006`: `CH15-Q004`.
- `CH15-R015`: `CH15-Q005`.
- `CH15-R016` y relación financiera de `CH15-R010`: `CH15-Q006`.
- Vistas financieras sensibles de `CH15-R012`: `CH15-Q007`.
- Taxonomías maestras de `CH15-R013`: `CH15-Q008`.
- Integración/reglas de descuentos de `CH15-R014`: `CH15-Q009`.
- `CH15-R009` queda parcial porque el checkpoint autorizado cerró importación, no inició una nueva unidad de exportación.

## 6. Primer requisito exacto pendiente de CH16

`CH16-R001`. Debe derivarse de la evidencia ya auditada al iniciar Terra; este checkpoint no abrió ni implementó CH16.

## 7. Defectos QA todavía abiertos

- `BASE-P1-018`: la pantalla QA legacy todavía consume seed embebido en vez de la matriz canónica.
- `CH14-P0-003` y `CH15-P1-003`: migraciones/RLS tienen verificación estática, pero falta ejecución contra un proyecto Supabase configurado.
- `CH15-P1-002`: reglas de acuse bloqueadas por decisiones del cliente.

## 8. Archivos modificados

- `app/main.js`, `app/store.js`, `app/supabase-adapter.js`, `app/views.js`.
- `scripts/generate-exact-parity-matrices.mjs`, `package.json`.
- `tests/ch15-catalogs.test.mjs`, `tests/e2e/ch15.spec.mjs`.
- `supabase/migrations/20260827140639_ch15_catalogs.sql`.
- `docs/OPEN_QUESTIONS.md`, `docs/parity/BASELINE_DEFECTS.csv`, `docs/parity/PROGRESS.md`, este handoff y las tres salidas `EXACT_VIDEO_PARITY_MATRIX`.
- Inventarios derivados: `ACTION_BEHAVIOR_MATRIX.csv`, `PAGE_CONTROL_INVENTORY.csv`, `PLATFORM_HARDENING.csv`.
- Evidencia QA generada: `docs/QA_AUTOMATED_RESULTS.*`, `docs/overnight/CODEX_PREFLIGHT_REPORT.*`, `VIDEO_AUDIT_STATUS.json`, `VIDEO_AUDIT_VERIFY.json`, screenshots CH15 y el standalone regenerado.

## 9. Migraciones agregadas

`supabase/migrations/20260827140639_ch15_catalogs.sql`: metadatos de catálogo, vigencia, unicidad SKU tenant-safe, historial de precios, RLS/grants, trigger de autorización/auditoría y prohibición de borrado.

## 10. Pruebas ejecutadas

- `node --test tests/ch15-catalogs.test.mjs`.
- `npm run test:browser:ch15`.
- `node --test tests/ch15-catalogs.test.mjs tests/p0-security.test.mjs` después de corregir el límite tenant-safe.
- `npm run check`.
- `npm run audit:verify`.
- `npm run codex:preflight`.

## 11. Resultados de pruebas

- Focal unitario CH15: 6/6 PASS.
- Navegador CH15: 2/2 PASS, incluidos rol AUDITOR y ancho móvil 390×844 sin overflow.
- Primera corrida de `npm run check`: 87/88; detectó que el adaptador CH15 enviaba `organization_id` desde el navegador. Se corrigió dentro de CH15 sustituyendo DML directo por RPC tenant-safe con organización derivada en servidor; no se relajó la prueba P0.
- Reejecución de `npm run check`: 88/88 unitarias PASS, QA 75/75 PASS y standalone generado (732,418 bytes).
- `npm run audit:verify`: 17/17 capítulos PASS, 0 pendientes y 0 fallos.
- `npm run codex:preflight`: PASS, 1,359 eventos y 0 errores/advertencias.

## 12. Estado de Supabase

Adaptador y migración CH15 están implementados y cubiertos por validación estática. No hay proyecto/runtime Supabase configurado para aplicar la migración o ejecutar pruebas RLS reales; no se desactivó RLS ni se expuso una service-role key.

## 13. Estado del legacy

El legacy y el standalone conservan el comportamiento existente y reciben la implementación CH15. No se inició React/Next.js en este checkpoint.

## 14. Estado de la matriz

347 requisitos: 143 `IMPLEMENTED_EXACT`, 119 `IMPLEMENTED_PARTIAL`, 21 `NOT_TESTABLE`, 64 `NEEDS_CLIENT_CONFIRMATION`, 0 `MISSING` y 0 `CONFLICTS_WITH_VIDEO`. CH15 aporta 18 requisitos: 5 exactos, 8 parciales y 5 bloqueados directamente.

## 15. Decisiones del cliente pendientes

`CH15-Q001`–`CH15-Q009`, con pregunta exacta, eventos, timestamps y evidencia en `docs/OPEN_QUESTIONS.md`: ciclo de acuses/faltantes; bodegas/permisos/idempotencia; estados de cotización; semántica de banderas; lotes para uso interno; honorarios/recursos; acceso financiero; taxonomías; descuentos.

## 16. Instrucción para la siguiente ejecución

La siguiente ejecución NO debe repetir, reabrir ni reauditar CH01–CH15. Debe comenzar exactamente en `CH16-R001` y respetar los bloqueos ya documentados.

## 17. Arquitectura final objetivo

```text
apps/web
packages/domain
packages/contracts
packages/ui
packages/testing
legacy-demo
supabase
```

## 18. Stack final

```text
Next.js App Router
React
TypeScript strict
Zod
React Hook Form
TanStack Query
Supabase
Vitest
Playwright
axe
```

## 19. React como aplicación principal final

React debe ser la aplicación principal final.

## 20. Legacy como respaldo temporal

Legacy debe quedar únicamente como respaldo temporal.
