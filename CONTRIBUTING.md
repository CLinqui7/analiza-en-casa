# Guía de contribución

La aplicación actual está en `apps/web/`. Antes de un cambio, revisar
[la arquitectura](docs/ARCHITECTURE.md), [el alcance de la entrega](RELEASE_NOTES.md)
y [el índice de documentación](docs/README.md).

## Preparación y revisión

Usar Node.js 24 y la versión de npm indicada en `package.json`.
Instalar con `npm ci` y ejecutar `npm run repo:preflight`.
Consultar `docs/qa/CLIENT_CHANGE_REQUESTS.json` y
`docs/qa/VIDEO_TO_REACT_TRACEABILITY.json` antes de modificar un módulo certificado.
Conservar texto fuente, contratos y referencias de cada requisito; actualizar código,
pruebas y resultados juntos. Una pantalla existente no demuestra una integración.

Realizar cambios pequeños en una rama de trabajo y abrir un pull request con el
problema, comportamiento resultante y pruebas ejecutadas. Mantener `main` sin
modificaciones directas. No hacer force-push ni reescribir commits anteriores.
Los artefactos publicados se identifican por su SHA de fuente y checksum; un cambio
posterior requiere una nueva verificación antes de sustituir una entrega.

## Datos, autenticación y permisos

- Usar exclusivamente datos sintéticos en pruebas. No inventar reglas clínicas,
  dosis, precios, coberturas, impuestos ni requisitos legales. Registrar decisiones
  pendientes en `docs/OPEN_QUESTIONS.md` y conservar estados de integración bloqueada.
- Validar entradas, sesión, organización y permiso en servidor. Ocultar una acción
  en la interfaz no autoriza ni protege una operación. Mantener RLS y respuestas
  genéricas donde una respuesta pudiera revelar identidades o registros.
- Mantener secretos fuera de Git, imágenes, logs y `NEXT_PUBLIC_*`. Las claves
  privilegiadas de los adaptadores históricos también son exclusivamente privadas.
- No sustituir errores de persistencia por datos locales ni comunicar success antes
  de confirmar la transacción. Preservar conflictos de versión y auditoría.
- No añadir DELETE sin requisito explícito. No deshabilitar permisos, RLS ni pruebas.

## Integridad clínica y financiera

Las cotizaciones enviadas son inmutables: un cambio crea una versión nueva.
Pagos, mensajes y trabajos externos requieren idempotencia. Las transiciones
financieras, de seguros, inventario y registros clínicos requieren auditoría.
Un documento firmado conserva su versión; corregirlo exige permiso, motivo y nueva
evidencia. No enviar diagnósticos, tratamientos ni medicación en vistas previas de
WhatsApp, SMS o correo. El portal conserva token hasheado, vencimiento, verificación
secundaria y protección contra enumeración; DUI por sí solo no concede acceso.

## Interfaz y backend

Preservar navegación, estados de carga/error/vacío, confirmaciones, uso con teclado,
foco y adaptación móvil. Evitar doble envío. Mostrar mensajes comprensibles al
usuario y mantener detalles clínicos fuera de vistas públicas.
Los endpoints modificados requieren pruebas deterministas de autorización, validación
y errores. Para cambios de Next.js, consultar la documentación de la versión instalada
en `apps/web/node_modules/next/dist/docs/` o la ruta resuelta del paquete `next`.

## Persistencia y migraciones

Crear migraciones ordenadas y repetibles; no alterar una migración aplicada para
ocultar un cambio. Documentar tablas, campos, índices, políticas y permisos.
Indexar claves y filtros que lo necesiten. Separar la identidad de migración del
usuario de runtime. El seed sintético no es una migración de datos productivos.
Los archivos privados van al almacenamiento de objetos; PostgreSQL conserva metadatos.

Las mismas reglas de organización, RLS, auditoría y secretos se aplican al código
histórico de Supabase y MongoDB cuando se mantenga o pruebe explícitamente.

## Evidencia y pruebas

`references/video-audit/` es evidencia fuente inmutable. No editar, mover ni
regenerar sus archivos. Las observaciones se guardan en `video-audit-reviews/`.
Una revisión completa de un capítulo comprende README, cobertura, manifiesto,
transcripción, hojas de contacto, fotogramas, recortes y clip exacto si hay dudas.
Cada evento necesita una observación y cada requisito su capítulo, evento, tiempo
y ruta de evidencia. No declarar una imagen revisada sin haberla abierto.

Conservar los estados `IMPLEMENTED_EXACT`, `IMPLEMENTED_PARTIAL`, `MISSING`,
`CONFLICTS_WITH_VIDEO`, `NOT_TESTABLE` y `NEEDS_CLIENT_CONFIRMATION`. No promover
certificaciones sin pruebas de paridad. Mantener los controles CH01–CH03 y registrar
el SHA de verificación. Revisar los 17 capítulos antes de afirmar paridad completa.

```powershell
npm run repo:preflight
npm test
npm run test:react
npm run typecheck
npm run lint
npm run qa:client-changes
npm run qa:video-parity
npm run qa:traceability-mirror
npm run audit:verify
```

Ejecutar además las pruebas de navegador y persistencia correspondientes al cambio.
La entrega Docker requiere `npm run test:postgresql` contra las imágenes finales.
`npm run qa:local` agrupa la regresión local amplia; las pruebas heredadas tienen
un alcance distinto de la prueba PostgreSQL del contenedor.
Documentar fallos pendientes sin rebajar umbrales ni eliminar casos.

El PR debe separar resultados actuales de informes históricos, explicar los límites
y resolver los hallazgos críticos dentro del alcance. No activar GitHub Actions,
desplegar ni modificar producción como efecto de una tarea de mantenimiento.
