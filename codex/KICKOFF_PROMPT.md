# Prompt corto para iniciar la tarea nocturna

Lee primero `AGENTS.md` y después ejecuta **completo** `codex/PROMPT_OVERNIGHT_MASTER.md`.

No te detengas al entregar un plan. Crea la rama `codex/overnight-audit-hardening`, ejecuta el baseline, delega la auditoría de los 17 capítulos a subagentes de solo lectura, completa los ledgers y receipts verificables, crea la matriz video vs. plataforma, implementa los gaps P0 no bloqueados, ejecuta QA y pruebas de navegador, vuelve a auditar todos los capítulos después de los cambios, corrige regresiones, mejora UX/accesibilidad/rendimiento/seguridad, realiza una revisión final contra `main`, haz commits y abre un pull request. No hagas merge automático.

Usa únicamente datos sintéticos. No inventes precios, cobertura, honorarios, reglas clínicas, impuestos o requisitos legales. No desactives RLS ni expongas secretos. Cuando falte una decisión del cliente, regístrala, deja una configuración segura o función deshabilitada y continúa con todo lo demás.

Mantén `docs/overnight/PROGRESS.md` actualizado durante la ejecución. No declares finalizado hasta que las pruebas aplicables estén verdes, `npm run codex:preflight` pase, la auditoría completada pase `npm run audit:verify`, la segunda comparación contra el video esté actualizada y `docs/overnight/FINAL_REPORT.md` describa con honestidad lo realizado y lo pendiente.
