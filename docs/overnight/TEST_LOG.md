# Test log

## 2026-08-26 · CH06 forensic audit

- Python and npm verifiers: PASS after correcting seven initially invalid inventory evidence paths.
- Coverage: 115/115 events, 75/75 crops, 13/13 event sheets and 12/12 safety sheets.
- Independent visual sample: CH06-E0025, E0069, E0103 and E0109 matched their ledger/inventory observations.
- Structured inventory: 10 features, 12 valid evidence references, zero missing evidence paths after correction.

## 2026-08-26 · CH01 forensic audit

- `python tools/video-audit/scripts/verify_chapter_review.py <CH01 source>`: PASS (24/24 events, 11/11 crops, all contact sheets, complete ledger).
- `npm run audit:status`: CH01 fully receipted and fully noted; remaining chapters pending.
- Independent visual sample: CH01-E0009, E0011, E0018 and E0023 matched their ledger observations.
- Structured inventory: 14 features, 14 valid evidence references, zero missing evidence paths.

## 2026-08-25 · Baseline antes de cambios

| Prueba | Resultado | Detalle |
|---|---|---|
| `npm ci` | PASS | Sin vulnerabilidades reportadas. |
| `npm run codex:preflight` | PASS | 17 capítulos y 1,359 eventos presentes; evidencia íntegra. |
| `npm run check` | PASS | 9/9 dominio, 75/75 QA, build standalone correcto. |
| `npm run audit:status` | EXPECTED INCOMPLETE | 0 eventos con observación y 0 capítulos verificados. |
| Navegación escritorio | PASS | 33/33 rutas; 0 errores de consola/página; 0 overflow. |
| Navegación móvil 390 px | PASS | 33/33 rutas; 0 overflow del documento. |
| Perfiles demo | PASS | 6/6 casos de acceso directo. |
| Portal demo | PASS WITH SAFETY GAP | Render correcto; el mock no solicita segunda verificación. |
| API local | PASS | Root/manifest/health/runtime, notificación segura y errores genéricos. |
| Accesibilidad básica | PASS WITH NOTES | Foco y botones correctos; dos filtros sin etiqueta accesible. |
| Supabase/RLS real | NOT RUN | CLI no disponible y no se proporcionaron credenciales ni base local. |

Capturas del baseline en `docs/overnight/screenshots/`.
