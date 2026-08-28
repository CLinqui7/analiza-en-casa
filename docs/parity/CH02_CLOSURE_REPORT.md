# Cierre secuencial de CH02

Fecha: 2026-08-27 (America/El_Salvador)

## Resultado

CH02 queda cerrado para poder iniciar CH03: sus 22 requisitos tienen **0 `MISSING`** y **0 `CONFLICTS_WITH_VIDEO`** no bloqueados. Se distribuyen en 5 `IMPLEMENTED_EXACT`, 9 `IMPLEMENTED_PARTIAL`, 5 `NEEDS_CLIENT_CONFIRMATION` y 3 `NOT_TESTABLE`.

La clasificación completa, timestamps y rutas de evidencia están en `EXACT_VIDEO_PARITY_MATRIX.json`. Los tres requisitos no testables corresponden al resultado exacto de Guardar, edición y documento imprimible: el video no ejecuta esos flujos. La aplicación sí prueba su comportamiento propio de alta y edición, sin atribuirlo al video.

## Evidencia revisada

- Se abrieron los 82 event frames, los 48 detail crops, los 10 contact sheets de eventos y los 11 contact sheets de seguridad de CH02.
- También se revisaron README, cobertura, manifiesto y transcripción del capítulo.
- `video-audit-reviews/CH02_alta_y_edicion_de_pacientes/event_review_notes.csv` conserva una observación no vacía para CH02-E0001–CH02-E0082.
- El clip exacto no fue necesario: frames, crops, contact sheets y transcript resolvieron la secuencia. El video termina sin pulsar Atrás ni Guardar y no demuestra edición.

## Cambios cerrados

- Alta y edición de paciente como página completa, con Datos del paciente, Seguro, Contactos y Dirección.
- Campos obligatorios observados con validación real del navegador antes de persistir.
- Paciente regular como estado inicial; aseguradora revela titularidad y campos de cobertura.
- Elegir titular Sí copia documento, nombre y nacimiento del paciente sin convertirlos en datos inmutables.
- Persistencia sintética, recarga, edición, duplicados por organización, permisos y auditoría probados.
- Consentimiento Botmaker desmarcado por defecto y sin contenido clínico, hasta contar con una política aprobada.
- Mapa y cámara como placeholders inequívocos: no geocodifican, capturan ni simulan éxito.
- Corrección del envío del formulario cuando un control `name="id"` oculta la propiedad DOM `form.id`.

## Bloqueos del cliente

`CH02-Q001`–`CH02-Q008` registran máscaras y reglas demográficas, país telefónico, consentimiento, catálogos maestros, múltiples coberturas, contactos, mapa/cámara, roles y semántica exacta de Guardar/Atrás. Cada función bloqueada utiliza un placeholder configurable o permanece deshabilitada.

## Verificación

- `npm test`: 36/36 después de implementar CH02.
- `npm run test:browser:ch02`: 3/3 en Chrome headless.
- Desktop 1440×900 y móvil 390×844: formulario completo utilizable y sin desbordamiento horizontal global.
- La verificación integral `check`, ambos capítulos de navegador y `audit:verify` se ejecuta al final del cierre antes de abrir CH03.

## Límite explícito

No se copiaron aseguradoras, empresas ni personas observadas como datos productivos. Los datos de pruebas son sintéticos. La persistencia remota y RLS continúan sin marcarse exactas hasta probarse contra un proyecto Supabase de ensayo conectado.
