# PROMPT MAESTRO · TRABAJO NOCTURNO DE AUDITORÍA, IMPLEMENTACIÓN Y QA

Trabaja como líder técnico, arquitecto, desarrollador full-stack, QA principal y coordinador de subagentes del proyecto **Analiza en Casa**.

Esta tarea debe ejecutarse de principio a fin. **No te detengas después de producir un plan.** Trabaja sobre una rama nueva, conserva checkpoints y continúa con las fases siguientes mientras exista trabajo no bloqueado.

## Resultado final esperado

Al finalizar debe existir un pull request desde `codex/overnight-audit-hardening` hacia `main` que:

1. preserve el baseline funcional;
2. demuestre revisión verificable de los 17 capítulos del video;
3. contenga una matriz funcional a nivel de característica entre video y plataforma;
4. implemente los gaps P0 que no dependan de reglas faltantes del cliente;
5. tenga pruebas automáticas y recorridos de navegador aprobados;
6. vuelva a auditar los 17 capítulos después de los cambios;
7. mejore usabilidad, accesibilidad, rendimiento, seguridad y mantenibilidad;
8. documente con honestidad todo bloqueo residual.

## Preparación obligatoria

Lee completamente, en este orden:

1. `AGENTS.md`
2. `CODEX_AND_GITHUB_START_HERE.md`
3. `README.md`
4. `docs/ARCHITECTURE.md`
5. `docs/SECURITY_AND_PRIVACY.md`
6. `docs/QA_PRE_CODEX.md`
7. `docs/OPEN_GAPS.md`
8. `docs/OPEN_QUESTIONS.md`
9. `docs/VIDEO_REQUIREMENTS.md`
10. `docs/VIDEO_COVERAGE_MATRIX.csv`
11. `references/video-audit/CHAPTERS.json`
12. `references/video-audit/MASTER_EVENT_MANIFEST.csv`
13. `references/video-audit/MASTER_TRANSCRIPT_RAW.txt`
14. `tools/video-audit/VIDEO_AUDIT_PROTOCOL.md`
15. migraciones, pruebas y código de aplicación.

Luego ejecuta:

```bash
npm ci
npm run codex:preflight
npm run check
npm run audit:status
```

Crea la rama:

```bash
git switch -c codex/overnight-audit-hardening
```

Crea y mantén durante toda la tarea:

- `docs/overnight/PROGRESS.md`
- `docs/overnight/BASELINE_REPORT.md`
- `docs/overnight/DECISIONS.md`
- `docs/overnight/TEST_LOG.md`
- `docs/overnight/FINAL_REPORT.md`

Actualiza `PROGRESS.md` al terminar cada capítulo y cada fase. Haz commits pequeños después de cada fase estable.

## Uso de subagentes

Delega explícitamente cuatro auditorías independientes y de solo lectura:

- Auditor A: CH01 a CH05.
- Auditor B: CH06 a CH09.
- Auditor C: CH10 a CH13.
- Auditor D: CH14 a CH17.

Los auditores pueden escribir únicamente bajo `video-audit-reviews/<chapter>/` y sus informes de capítulo. No deben modificar la aplicación.

Después de consolidar la matriz de gaps, delega trabajo independiente cuando no haya solapamiento de archivos:

- Backend/Supabase y seguridad de datos.
- Frontend/UX y paridad funcional.
- QA, pruebas y revisión de permisos.

El hilo principal integra, resuelve conflictos y es responsable del resultado final. No permitas ediciones concurrentes sobre los mismos archivos.

## FASE 1 · Baseline reproducible

1. Ejecuta todas las pruebas actuales.
2. Levanta la aplicación y recorre las 33 rutas documentadas o el conjunto equivalente vigente.
3. Prueba los seis roles demo y el portal del paciente.
4. Registra consola, errores de página, desbordamiento móvil y fallos visuales.
5. No cambies código hasta guardar `BASELINE_REPORT.md`.
6. Haz commit del reporte baseline.

## FASE 2 · Auditoría completa de los 17 capítulos

Para cada capítulo:

1. Lee `README.md`, `coverage.json`, `event_manifest.csv`, `transcript_raw.txt`, `CODEX_ANALYZE_THIS_CHAPTER.md` y `CODEX_IMAGE_BATCHES.md`.
2. Abre todas las hojas de eventos y seguridad en los lotes indicados.
3. Abre cada imagen individual indicada por `chapter_full_image`.
4. Abre cada `chapter_detail_crop` existente.
5. Reproduce el clip exacto cuando sea necesario para comprender secuencia, interacción, audio o estados fugaces.
6. Completa una observación útil y no vacía por cada evento en `video-audit-reviews/<chapter>/event_review_notes.csv`.
7. Genera:
   - `chapter_feature_inventory.json`
   - `chapter_feature_inventory.md`
   - `chapter_open_questions.md`
   - `chapter_review_receipt.json`
8. Cada función debe citar capítulo, evento, timestamp y ruta de evidencia.
9. Clasifica cada afirmación como `VISIBLE`, `VERBAL`, `INFERRED` o `UNCERTAIN`.
10. Ejecuta `npm run audit:verify` y no marques el capítulo completo hasta que pase.

No uses una hoja de contacto como sustituto de las imágenes individuales. No marques un evento como revisado sin abrirlo.

Al terminar los 17 capítulos, genera:

- `docs/MASTER_VIDEO_REQUIREMENTS.md`
- `docs/MASTER_VIDEO_REQUIREMENTS.json`
- `docs/MASTER_FEATURE_MATRIX.csv`
- `docs/MASTER_OPEN_QUESTIONS.md`
- `docs/VIDEO_VS_PLATFORM_GAP_MATRIX.csv`

La matriz de gaps debe tener al menos:

- requirement_id
- module
- feature
- detailed_behavior
- evidence_type
- chapter_id
- event_ids
- timestamps
- evidence_paths
- current_platform_evidence
- status
- severity
- patient_safety_impact
- financial_impact
- recommended_action
- blocked_by_client_information
- notes

Estados permitidos:

- `IMPLEMENTED_EXACT`
- `IMPLEMENTED_PARTIAL`
- `MISSING`
- `CONFLICTS_WITH_VIDEO`
- `NOT_TESTABLE`
- `NEEDS_CLIENT_CONFIRMATION`

Haz commit de toda la auditoría antes de implementar.

## FASE 3 · Priorización

Prioriza primero:

1. Seguridad y aislamiento de datos.
2. Integridad financiera y de seguros.
3. Inmutabilidad y corrección de documentos clínicos.
4. Flujo paciente → hospitalización → cotización → seguro → pago.
5. Inventario, lotes, compromisos, acuses y cierres.
6. Estados de cuenta médicos.
7. Documentos e impresión.
8. UX, accesibilidad y rendimiento.

Para cada gap usa prioridad P0, P1, P2 o P3. No inventes reglas faltantes. Cuando falte una definición del cliente:

- crea una pregunta concreta;
- implementa configuración segura o provider simulado si aporta valor;
- deja la función deshabilitada por defecto cuando activarla sería inseguro;
- continúa con otros gaps.

## FASE 4 · Implementación P0 y endurecimiento productivo

Preserva la demo existente como fallback y mejora la arquitectura sin destruir el comportamiento comprobado.

Como mínimo revisa y endurece:

- autenticación y autorización por rol;
- aislamiento por organización y RLS;
- pacientes, contactos, direcciones y seguro;
- hospitalizaciones y estados;
- cotizaciones, categorías, cálculos, descuentos, versiones e impresión;
- preautorización, reclamo y aprobación parcial;
- pagos, referencias únicas, reversión e idempotencia;
- portal del paciente con token seguro, expiración y verificación adicional;
- reporte de salud, orden médica, tarjeta de medicamentos, plan de cuidados, evoluciones, signos vitales y notas de enfermería;
- bloqueo y corrección auditada de documentos firmados;
- agenda y turnos;
- compras y recepción;
- inventario, lotes, series, movimientos, comprometidos, acuses, cierres, bodegas y kits;
- médicos, servicios y estados de cuenta;
- notificaciones sin contenido clínico sensible;
- auditoría append-only;
- manejo de vacío, carga, error, reintento y doble clic;
- compatibilidad Vercel y preparación Supabase.

Si migras a un framework o agregas dependencias:

- conserva el prototipo actual bajo `prototype/`;
- documenta la decisión;
- actualiza scripts, lockfile, CI y guías de despliegue;
- no dejes dos implementaciones ambiguas sin explicar cuál es la productiva;
- mantén una ruta local de demo con datos sintéticos.

## FASE 5 · QA profundo

Agrega o fortalece:

- pruebas unitarias de reglas de dominio;
- pruebas de integración para Supabase/RLS cuando sea posible sin secretos;
- pruebas E2E de flujos críticos;
- matriz de permisos por rol;
- casos de duplicidad e idempotencia;
- cálculos de cotización, cobertura, pago e inventario;
- documentos firmados y correcciones;
- tokens vencidos y anti-enumeración;
- estados vacíos y errores;
- responsive y accesibilidad de teclado;
- pruebas de rutas directas no autorizadas;
- verificación de que ninguna notificación contiene diagnóstico o medicación.

Ejecuta todos los comandos aplicables. Corrige fallos y repite hasta obtener resultados verdes o documentar un bloqueo externo real.

Guarda evidencia en `docs/overnight/TEST_LOG.md` y capturas bajo `docs/overnight/screenshots/`.

## FASE 6 · Segunda auditoría contra el video

Después de implementar:

1. Recorre nuevamente los 17 inventarios de capítulo.
2. Compara cada requirement_id con una ruta, componente, prueba o migración concreta.
3. Actualiza `VIDEO_VS_PLATFORM_GAP_MATRIX.csv`.
4. No conviertas `MISSING` en `IMPLEMENTED_EXACT` sin evidencia de aplicación y prueba.
5. Ejecuta una regresión completa.
6. Corrige cualquier regresión o gap P0 residual no bloqueado.

## FASE 7 · Mejora final

Solo después de lograr paridad P0:

- simplifica navegación y textos;
- mejora jerarquía visual, formularios y tablas;
- añade próximos pasos claros en estados;
- mejora accesibilidad, foco, teclado y contraste;
- reduce duplicación y deuda técnica;
- mejora rendimiento y carga de evidencia;
- fortalece observabilidad y mensajes de error;
- mejora documentación de desarrollo, Supabase y Vercel.

No elimines funciones requeridas para “limpiar” la interfaz.

## FASE 8 · Revisión y entrega

1. Ejecuta el conjunto completo de pruebas.
2. Ejecuta `npm run codex:preflight`, `npm run check` y `npm run audit:verify`.
3. Realiza revisión del diff contra `main` con foco en P0/P1.
4. Corrige los hallazgos aplicables.
5. Actualiza `docs/overnight/FINAL_REPORT.md` con:
   - alcance realizado;
   - capítulos verificados;
   - funcionalidades añadidas o corregidas;
   - archivos y migraciones principales;
   - resultados de pruebas;
   - gaps restantes;
   - preguntas del cliente;
   - riesgos para pacientes reales;
   - pasos exactos de Supabase y Vercel;
   - recomendación de siguiente sprint.
6. Haz commit final.
7. Push de la rama.
8. Abre un PR hacia `main` titulado:

```text
Codex overnight: auditoría total del video, gaps P0 y endurecimiento productivo
```

No hagas merge automático.

## Criterio de honestidad

No declares “producción lista” si faltan reglas del cliente, pruebas de penetración, UAT, documentos oficiales, credenciales o validación legal. El objetivo de esta noche es dejar un baseline verificable, mucho más completo y técnicamente endurecido, con todo lo pendiente claramente visible.
