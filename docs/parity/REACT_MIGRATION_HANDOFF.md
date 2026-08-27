# Handoff · paridad exacta hasta CH14 y migración React futura

## Estado del checkpoint

CH01, CH02, CH03, CH04, CH05, CH06, CH07, CH08, CH09, CH10, CH11, CH12, CH13 y CH14 están cerrados secuencialmente en la matriz exacta, con decisiones del cliente registradas y sin filas `MISSING` o `CONFLICTS_WITH_VIDEO`. CH15, CH16 y CH17 no se han abierto para implementación exacta.

- Último `requirement_id` completado: `CH14-H005`.
- Primer `requirement_id` pendiente: `CH15-R001` — debe crearse sólo después de revisar toda la evidencia CH15.
- Matriz exacta actual: 329 filas — 138 exactas, 111 parciales, 21 no testables, 59 bloqueadas por cliente.
- CH14: 29 filas — 7 exactas, 14 parciales, 2 no testables y 6 bloqueadas por cliente.

## Defectos corregidos

- Autenticación demo/standalone ya no acepta credenciales arbitrarias.
- Portal standalone usa verificación sintética marcada y no intenta `/api` desde `file://`.
- Auditor y demás roles no reciben mutaciones fuera de permiso.
- Pacientes tiene pestañas, filtros, columnas, paginación y estados diferenciados.
- Acciones clínicas, financieras e inventario sin contrato no simulan éxito.
- Cotizaciones enviadas, correcciones clínicas, notificaciones, pagos, compras y movimientos usan límites remotos/auditables implementados en los checkpoints previos.
- CH14 confirma el movimiento Supabase antes del commit local, reconstruye todas las colecciones de inventario y cierra DML directo con RLS por padres.
- CH14 bloquea movimientos locales de items `requiresLot` antes de cualquier cambio, evitando divergencia lote–stock.

## Defectos pendientes

- `BASE-P1-018`: la pantalla legacy `#/qa-cobertura` todavía deriva datos del estado mock; las matrices canónicas sí se generan desde los scripts.
- Métricas y alertas clínicas de dashboard permanecen parciales hasta recibir umbrales/fórmulas del cliente.
- Filtros avanzados, Excel oficial y algunos resultados visuales siguen parciales donde el video no prueba el contrato completo.
- Supabase real aún debe validar RLS, RPC, triggers, concurrencia e idempotencia con dos organizaciones.
- En CH14, CRUD de acuses/cierres/proveedores/bodegas/lotes/kits y consumo de kits continúa bloqueado por `CH14-Q001`–`CH14-Q015`.

La lista canónica y estado exacto están en `docs/parity/BASELINE_DEFECTS.csv`, `docs/parity/EXACT_VIDEO_PARITY_MATRIX.json` y `docs/VIDEO_VS_PLATFORM_GAP_MATRIX.csv`.

## Archivos modificados en CH14

- Aplicación: `app/main.js`, `app/store.js`, `app/supabase-adapter.js`, `app/views.js`.
- Persistencia: `supabase/migrations/202608270010_ch14_inventory_boundaries.sql`.
- Pruebas: `tests/ch14-inventory-boundaries.test.mjs`, `tests/e2e/ch14.spec.mjs`, `package.json`.
- Generadores: `scripts/generate-exact-parity-matrices.mjs`, `scripts/generate-master-video-requirements.mjs`.
- Revisión: `video-audit-reviews/CH14_inventario_movimientos_acuses_cierres_bodegas_y_kits/chapter_feature_inventory.json`, `chapter_open_questions.md`.
- Matrices/documentación: salidas `docs/MASTER_*`, `docs/VIDEO_VS_PLATFORM_GAP_MATRIX.csv`, `docs/OPEN_QUESTIONS.md`, `docs/parity/*`, este handoff y el log/progreso overnight.
- Evidencia generada de aplicación: `docs/parity/screenshots/ch14-inventory-1440x900.png` y `ch14-acknowledgements-mobile-390x844.png`.
- Evidencia fuente: `references/video-audit/` permanece sin cambios.

## Pruebas ejecutadas

- Focal unitario CH14: `node --test tests/ch14-inventory-boundaries.test.mjs` — PASS 6/6.
- Focal navegador CH14: `npm run test:browser:ch14` — PASS 2/2, desktop y móvil sin overflow global.
- Generadores: `npm run parity:generate` — 329 requisitos, 0 missing/conflict; `npm run audit:master:bootstrap` — 210 features y 135 preguntas.
- `npm run check` se ejecutó una vez y expuso una prueba P0 obsoleta que intentaba mutar localmente un medicamento sin lote; tras alinearla con el guard CH14, sus componentes pasaron por separado: 82/82 unitarias, 75/75 QA y standalone de 711,425 bytes. El comando no se repitió.
- `npm run audit:verify`: PASS, 17/17; `npm run codex:preflight`: PASS, 0 errores y 0 advertencias. Detalle en `docs/overnight/TEST_LOG.md`.

## Decisiones bloqueadas por cliente

CH14 mantiene 15 decisiones explícitas: semántica de comprometido; estados/roles/idempotencia de acuses; formato de Excel/impresión; Plantilla/Vaciar; faltantes; recuperación y estados de cierres; identidad/ciclo de proveedores; bodegas/traslados; fecha inválida/FEFO; unicidad/ciclo de lotes/series; versionado y consumo atómico de kits; significado de “faltar una cotización”; y errores/reintentos. Ver `docs/OPEN_QUESTIONS.md` y el ledger de CH14.

## Estado de Supabase

- Migraciones ordenadas hasta `202608270010_ch14_inventory_boundaries.sql`.
- Movimiento autoritativo: `apply_inventory_movement_v2`, transaccional, tenant-safe, idempotente y con auditoría.
- CH14 revoca DML directo de `inventory_items`, `inventory_lots`, `inventory_movements`, `inventory_reservations`, cierres y kits; agrega lecturas por tenant/padre y RLS en `supply_kit_items`.
- Cierres y kits permanecen cerrados hasta aprobar reglas.
- Estado de runtime: NO EJECUTADO. No hay CLI/proyecto/base Supabase autorizada/configurada. No elevar RLS/RPC a `IMPLEMENTED_EXACT` de runtime hasta ejecutar matrices multi-organización, concurrencia y rollback.

## Estado del legacy

El legacy sigue siendo la aplicación activa: `index.html`, `app/`, `api/`, `supabase/`, `tests/` y el standalone generado. Debe permanecer funcional y servir como oráculo de comportamiento ya validado. No se movió a `legacy-demo/` porque la migración no ha iniciado. No eliminar, renombrar ni congelar manualmente el standalone; se regenera mediante `npm run build:standalone`.

## Arquitectura React prevista — no iniciada

La arquitectura aprobada es progresiva y no destructiva:

- Mantener el sistema actual bajo `legacy-demo/` o estructura equivalente cuando comience la migración.
- Crear `apps/web/` con Next.js App Router, React, TypeScript estricto, Supabase, Zod, React Hook Form, TanStack Query, Vitest, Playwright, ESLint, Prettier y Vercel.
- Reutilizar modelo funcional, reglas válidas, migraciones, pruebas, matrices, plantillas y datos sintéticos; no copiar placeholders ni reglas bloqueadas.
- Migrar en este orden: autenticación/shell; pacientes; hospitalizaciones; cotizaciones; seguros; pagos; clínica; agenda; compras; inventario; médicos; reportes; configuración; auditoría; portal.
- No retirar una pantalla legacy hasta que la React correspondiente tenga paridad, pruebas, persistencia, permisos y QA.

## Instrucciones exactas para continuar CH15

1. Confirmar que el checkpoint remoto está limpio: `git switch codex/exact-video-parity-production`, `git pull --ff-only origin codex/exact-video-parity-production`, `git status --short`.
2. No releer CH01–CH14. Abrir exclusivamente el README, coverage, manifests, transcript, 17 event contact sheets, 16 safety sheets, 148 event frames y 56 detail crops de `references/video-audit/chapters/CH15_*`; abrir el clip exacto sólo ante ambigüedad.
3. Verificar una observación no vacía por cada `CH15-E####` y contrastar las 16 features del inventario CH15 con el HEAD.
4. Crear desde evidencia `CH15-R001` en el generador exacto; conservar toda regla de cliente como `NEEDS_CLIENT_CONFIRMATION` y no dejar `MISSING`/`CONFLICTS_WITH_VIDEO` no bloqueados.
5. Implementar sólo CH15 con cambios pequeños, pruebas unitarias/E2E focalizadas y persistencia/permiso/auditoría reales cuando aplique.
6. Regenerar matrices y ejecutar los gates de CH15. No abrir CH16 hasta tener commit estable y push de CH15.

## Instrucciones exactas para iniciar después la migración React

1. Terminar CH15–CH17, reauditar los 17 capítulos, resolver todo P0/P1 no bloqueado y producir el cierre integral antes de tocar arquitectura.
2. Crear un checkpoint Git limpio y una rama `codex/react-migration` desde el commit aprobado; no reutilizar la rama de paridad sin autorización.
3. Preservar el legacy bajo `legacy-demo/` o estructura equivalente mediante movimientos revisables, nunca borrado; mantener el build standalone automatizado.
4. Crear `apps/web/` con el stack aprobado y checks estrictos. No agregar credenciales ni secretos.
5. Extraer primero contratos de dominio/tipos compartidos y datos sintéticos; conservar las migraciones Supabase como fuente autoritativa.
6. Migrar autenticación y shell primero, con RLS/roles y Playwright de paridad lado a lado; sólo después avanzar al siguiente módulo del orden aprobado.
7. Mantener cada ruta legacy hasta que la ruta React cumpla matriz, persistencia, permisos, errores, accesibilidad, unit/integration/E2E y evidencia de navegador.
