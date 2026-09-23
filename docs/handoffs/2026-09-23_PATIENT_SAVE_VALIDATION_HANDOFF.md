# Traspaso Codex — guardado y validación de pacientes

- Fecha: 2026-09-23
- Repositorio: `CLinqui7/analiza-en-casa`
- Rama de trabajo: `codex/patient-required-fields`
- Base usada: `origin/codex/ui-polish-complete` (`4966dd210bcee34e9d8006b7d6df412336ae0290`)
- Pull request: https://github.com/CLinqui7/analiza-en-casa/pull/10

Estado: implementación, pruebas enfocadas, certificación, commits y push completados; PR abierto y no fusionado.

## Solicitud atendida

Se pidió revisar los cambios recientes del repositorio y corregir únicamente el problema reportado al crear o editar pacientes: el usuario percibía que **Guardar** no funcionaba. Además, si faltaba información obligatoria, se solicitó mostrar junto al botón cuál campo debía completarse.

Se respetó la instrucción de no alterar otras funciones cuando el problema no estuviera demostrado.

## Diagnóstico

- El flujo de persistencia de pacientes sí respondía. Durante la investigación se verificaron altas y ediciones con respuestas exitosas (`POST 201` y `PUT 200`) y conservación de los datos.
- El formulario ya generaba errores individuales mediante React Hook Form y Zod, pero estos quedaban dentro del cuerpo desplazable del diálogo.
- El pie del diálogo y el botón **Guardar** permanecían visibles. Por eso, si el campo inválido estaba arriba o fuera del área visible, parecía que el botón no hacía nada.
- No se encontraron nuevos reportes registrados en la pantalla de feedback durante la revisión (contador observado: 0).
- La causa corregida fue de retroalimentación y enfoque del formulario, no de API ni de base de datos.

## Solución implementada

Archivo principal: `apps/web/src/app/(workspace)/patients/page.tsx`

- Se agregó `patientValidationEntries(errors)` para traducir los errores técnicos del formulario a etiquetas comprensibles.
- Se cubren campos generales, seguro, titular, contactos y dirección.
- Al intentar guardar un formulario inválido, `onInvalid`:
  - muestra un resumen junto a **Guardar**;
  - enumera los campos incompletos o incorrectos;
  - enfoca el primer campo inválido;
  - desplaza suavemente ese campo al centro de la vista.
- El resumen se actualiza mientras el usuario corrige los campos.
- Los errores manuales de formato o duplicidad del documento también activan el resumen y enfocan `Número de documento`.
- El estado del resumen se limpia al abrir, cerrar o guardar correctamente el diálogo.
- El formulario ahora usa `form.handleSubmit(onSubmit, onInvalid)`.
- No se cambiaron endpoints, contratos, esquemas de persistencia ni lógica de autorización.

Archivo de estilos: `apps/web/src/app/studio.css`

- Se agregó `.dialog-validation-summary` para que el mensaje sea legible y se adapte al ancho disponible en el pie del diálogo.

Prueba de navegador: `apps/web/e2e/ch02.spec.ts`

- Nuevo identificador: `playwright:ch02-required-field-summary`.
- La prueba abre el alta vacía, pulsa **Guardar**, comprueba la lista de ocho campos obligatorios iniciales, valida el foco en `Número de documento` y confirma que el resumen se actualiza al corregirlo.
- Se actualizaron dos selectores heredados de `Aseguradora demo` a la etiqueta actual `Aseguradora`; sólo se modificó la prueba, no la aplicación.

Trazabilidad actualizada:

- `docs/qa/VIDEO_REQUIREMENT_CERTIFICATIONS.json`
- `docs/qa/VIDEO_TO_REACT_TRACEABILITY.json`
- `docs/qa/VIDEO_TO_REACT_TRACEABILITY.csv`

El requisito afectado es `CH02-F016`. Se registraron la prueba nueva, el comportamiento del resumen, el fingerprint funcional y el SHA de implementación.

## Commits creados

1. `a483f37b613ef44c208b8f547ebb3cd4767ce8b7` — `fix(patients): show missing fields beside save`
2. `ad6aa51d7ca1b878106d6f44b0cc63e2981c070b` — `docs(qa): certify patient validation feedback`

El segundo commit contiene la certificación que apunta al SHA completo del primer commit como implementación verificada.

## Verificación completada

Ejecutar las pruebas de navegador con modo mock explícito es importante porque `apps/web/.env.local`, ignorado por Git, puede seleccionar Mongo en esta estación.

```powershell
$env:NEXT_PUBLIC_DATA_MODE='mock'
$env:ANALIZA_DATA_MODE='mock'
Remove-Item Env:NEXT_PUBLIC_RELEASE_PROFILE -ErrorAction SilentlyContinue
npm exec playwright test --workspace @analiza/web -- e2e/ch02.spec.ts
```

Resultado: **7/7 pruebas de CH02 aprobadas**, incluyendo alta, guardado, recarga, edición, contactos, dirección, mapa y móvil.

Otros resultados aprobados:

- `npm run test:react`: **166/166** pruebas.
- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado.
- `npm run build`: compilación de producción aprobada con Next.js 16.3.4.
- `npm run audit:verify`: **17/17 capítulos** aprobados.
- `npm run qa:video-parity -- --chapter CH02`: **16/16 requisitos** aprobados.
- `npm run qa:traceability-mirror`: aprobado.
- Prettier enfocado en los tres archivos de aplicación/prueba modificados: aprobado.
- `git diff --check`: aprobado.

## Alertas heredadas que no se modificaron

Se dejaron intactas por estar fuera de la solicitud.

### Preflight

`npm run repo:preflight` falla porque la rama base ya versiona:

```text
deploy/ubuntu/.env.example
```

El verificador clasifica cualquier archivo con ese nombre como archivo de entorno. No fue creado ni modificado en este trabajo.

### Formato global

`npm run format:check` reporta seis archivos preexistentes:

- `apps/web/e2e/quotes.spec.ts`
- `apps/web/src/app/(workspace)/purchases/page.tsx`
- `apps/web/src/app/api/feedback/[id]/route.ts`
- `apps/web/src/components/common/searchable-select.tsx`
- `apps/web/src/components/feedback-form.tsx`
- `apps/web/src/server/persistence/postgres-feedback.ts`

Los archivos tocados para este arreglo sí pasan Prettier.

### Regresión global de navegador

Se inició `npm run test:browser:react` en modo mock. El conjunto contiene 181 pruebas, pero se detuvo después de confirmar varios fallos heredados fuera de pacientes. Hasta ese punto, **CH02 volvió a pasar completo**. Fallos observados y no modificados:

- `b3.spec.ts`: `getByLabel('Paciente')` coincide con dos controles.
- `b4.spec.ts`: no encuentra el control antiguo `Referido por`.
- `ch03.spec.ts`: espera el control antiguo `Referido por`.
- `ch08.spec.ts`: selector ambiguo de paciente y diálogos de perfil administrativo no encontrados.
- `ch09.spec.ts`: columnas/acciones esperadas ya no coinciden con la interfaz actual.

No deben atribuirse al resumen de validación de pacientes.

## Decisiones y límites

- Se mantuvo el cambio completamente en el componente cliente existente (`'use client'`); no se amplió la frontera de datos de Next.js.
- No se tocaron APIs, Mongo, Supabase, RLS ni migraciones.
- No se añadieron datos reales ni sensibles.
- No se modificaron reglas clínicas, financieras ni de seguros.
- No se intentó corregir los módulos ajenos que fallaron en la regresión global.
- No se desplegó ni fusionó el PR.

## Advertencias para el siguiente Codex

- Leer primero `AGENTS.md`, `docs/qa/CLIENT_CHANGE_REQUESTS.json` y `docs/qa/VIDEO_TO_REACT_TRACEABILITY.json`.
- Trabajar sobre `codex/patient-required-fields` si se continúa este arreglo, o revisar el PR 10 antes de crear otra rama.
- Conservar como sólo lectura `references/video-audit/`.
- Definir el modo mock explícitamente al ejecutar Playwright localmente.
- `scripts/generate-video-react-traceability.mjs` no implementa una opción informativa `--help`: al pasarla, regenera artefactos. No usarla para consultar ayuda.
- La certificación de `CH02-F016` apunta a `a483f37b613ef44c208b8f547ebb3cd4767ce8b7`; no reemplazarla sin ejecutar nuevamente las pruebas enfocadas y los gates.
- Si se atienden los fallos heredados de la regresión global, hacerlo en un lote separado para no mezclar el alcance de este arreglo.

## Estado de Git al terminar la implementación

- Rama remota publicada: `origin/codex/patient-required-fields`.
- PR abierto: https://github.com/CLinqui7/analiza-en-casa/pull/10
- Base del PR: `codex/ui-polish-complete`.
- La rama estaba limpia antes de crear este documento de traspaso.
- Este archivo debe confirmarse y subirse en un commit adicional a la misma rama.
