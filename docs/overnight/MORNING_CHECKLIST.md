# Checklist de revisión por la mañana

No fusionar el pull request hasta comprobar:

- [ ] CI de GitHub en verde.
- [ ] `docs/overnight/FINAL_REPORT.md` existe y no oculta bloqueos.
- [ ] Los 17 capítulos aparecen completos en `npm run audit:status`.
- [ ] `npm run audit:verify` pasa sin `--allow-pending`.
- [ ] `npm run codex:preflight` pasa.
- [ ] `npm run check` pasa.
- [ ] La matriz `docs/VIDEO_VS_PLATFORM_GAP_MATRIX.csv` está completa.
- [ ] No quedan gaps P0 no bloqueados.
- [ ] Las preguntas del cliente están documentadas.
- [ ] No se subieron `.env`, secretos ni datos reales de pacientes.
- [ ] El PR recibió `/review` o `@codex review`.
- [ ] Los hallazgos P0/P1 de la revisión fueron corregidos o justificados.
- [ ] Se revisaron manualmente el dashboard, portal del paciente y un flujo crítico.
