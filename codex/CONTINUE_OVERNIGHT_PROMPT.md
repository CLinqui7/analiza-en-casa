# Prompt de continuación si una ejecución se detiene

Lee primero `AGENTS.md`, `codex/PROMPT_OVERNIGHT_MASTER.md` y estos checkpoints:

- `docs/overnight/PROGRESS.md`
- `docs/overnight/TEST_LOG.md`
- `docs/overnight/DECISIONS.md`
- `docs/overnight/FINAL_REPORT.md`
- `git status`
- historial reciente de commits de la rama `codex/overnight-audit-hardening`

Continúa desde el **primer paso incompleto verificable**. No reinicies capítulos ya aprobados por `npm run audit:verify`, no sobrescribas observaciones válidas y no reviertas cambios correctos. Revisa el trabajo existente antes de editar.

Orden de reanudación:

1. terminar cualquier capítulo o ledger incompleto;
2. ejecutar `npm run audit:status` y `npm run audit:verify -- --allow-pending` para localizar faltantes;
3. completar la matriz video vs. plataforma;
4. implementar gaps P0 no bloqueados;
5. ejecutar QA, pruebas de navegador y revisión de permisos;
6. realizar la segunda auditoría de los 17 capítulos;
7. corregir regresiones y mejorar UX, accesibilidad, rendimiento y seguridad;
8. ejecutar la revisión final contra `main`;
9. actualizar `docs/overnight/FINAL_REPORT.md`;
10. hacer commits, push y actualizar o abrir el pull request, sin hacer merge.

Mantén `docs/overnight/PROGRESS.md` actualizado. Usa solo datos sintéticos. No inventes reglas de negocio ni agregues secretos. No declares terminado hasta que los verificadores y pruebas aplicables pasen o exista un bloqueo externo claramente documentado.
