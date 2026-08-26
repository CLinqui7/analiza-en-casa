# Test log

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
