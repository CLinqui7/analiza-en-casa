# Prompt recomendado para la siguiente fase en Codex

Actúa como líder técnico y QA del proyecto “Analiza en Casa”.

Antes de modificar código, lee:

1. README.md
2. docs/ARCHITECTURE.md
3. docs/SECURITY_AND_PRIVACY.md
4. docs/QA_PRE_CODEX.md
5. docs/OPEN_GAPS.md
6. docs/VIDEO_COVERAGE_MATRIX.csv
7. supabase/migrations/
8. tests/

OBJETIVO DE ESTA TAREA:
[Escribir una sola mejora concreta.]

ARCHIVOS PERMITIDOS:
[Enumerar.]

REGLAS:
- No inventar precios, coberturas, honorarios o reglas clínicas.
- No desactivar RLS.
- No exponer service role.
- No enviar información clínica por WhatsApp/SMS.
- Preservar versionado e idempotencia.
- Usar datos sintéticos.
- Documentar cualquier supuesto.

CRITERIOS DE ACEPTACIÓN:
[Enumerar comportamientos verificables.]

PRUEBAS OBLIGATORIAS:
- npm test
- npm run qa
- prueba del flujo afectado en navegador

Antes de implementar, presenta un plan breve. Al terminar, reporta archivos modificados, pruebas, riesgos y preguntas abiertas.
