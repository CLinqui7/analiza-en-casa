# Publicación visual — 4 de noviembre de 2026

Alcance: `../feedback/VISUAL_REFRESH_2026-11-04.md`. Se publica el rediseño autorizado anteriormente; no se implementan los requisitos pendientes del PDF consolidado usado para la estimación de esfuerzo.

- Código funcional: `dfeed6862ce49f1848abfe9ab002bdde0dcc3e05`.
- Release: `81823a6933b027cde0e8b21596612f54741c89b8`, verificado en GitHub antes de transferirlo al VPS. Rama `codex/feedback-followup-20261014`, PR #20 abierto sin fusionar.
- Archivo de release, SHA-256 local/remoto coincidente: `e0201aa7a4db0241cf197a7a7b701f1b5d3356feb868440187b1b938caa8a7e6`.
- Imagen activa: `sha256:0ed6469c336ace9e3edf8ac99caf3c406bb66473640b5bb44fa21dc02a64059f`.
- Imagen anterior conservada: `sha256:892a5130d51f7f0277ba9a263b018ea6626e7199275bf707b6093c71b18beeb6`, release `cfc7ceb1fcc53f0e2b9cd7ac260f12f51e2bb967`.
- Respaldo previo: `137bbf9a`, 2026-11-04 22:06:12 UTC. El operador comprobó un snapshot nuevo y los archivos/manifiesto de la base activa antes de continuar. La copia externa de este snapshot no se ha verificado en este lote.
- Compilación Linux y despliegue terminados con código 0. Migraciones existentes ejecutadas idempotentemente; sin DDL nuevo. No se actualizó ni reinició Ubuntu/Docker.
- Web y PostgreSQL saludables; ninguna unidad systemd fallida. Disco 27/193 GB (14%), 167 GB libres y aproximadamente 10 GiB de memoria disponible.

## Verificación pública

`scripts/verify-visual-release.mjs` se subió a GitHub antes de ejecutarlo. La sesión comprobó identidad y organización de la cuenta sintética autorizada; no se escribieron registros clínicos, financieros ni de inventario.

- 59 rutas revisadas, incluidos tres detalles. 58 disponibles y Analítica restringida correctamente por el permiso de la cuenta.
- Anchos 1440, 768 y 390 px sin desbordamiento horizontal de página; fuente local disponible; cero errores JavaScript.
- Menú de pacientes: flechas, Escape y recuperación del foco comprobados. Salud pública HTTP 200 al terminar.
- La organización sintética no tenía devoluciones; el enlace Ver devoluciones no se declaró probado con datos reales en esta pasada. Su aspecto y destino están comprobados en el recorrido con respuestas API sintéticas, sobre la compilación de producción. La tabla ancha conserva desplazamiento local intencional.
- Complemento: archivo de fuente y tipografía efectiva, menú de cuenta, grupos de navegación móvil y encuesta pública con preguntas sintéticas interceptadas, sin envío de respuestas. La primera comprobación adicional esperaba por error un radio de 10 px; se alineó con los 8 px definidos por el componente y se repitió. El resultado final queda registrado en el log indicado debajo.

Logs locales: `C:/Temp/analiza-visual-deploy.log`, `C:/Temp/analiza-visual-live.log`, `C:/Temp/analiza-visual-live-extra-final.log`. Capturas públicas limitadas a la organización sintética en `.local/visual-release-live/`. Inventario reproducible de la revisión local: `../feedback/VISUAL_COVERAGE_2026-11-04.json`.

## Reversión y documentos

Conservar la imagen anterior y el archivo privado `releases/before-81823a6933b027cde0e8b21596612f54741c89b8.env`. La reversión de este lote cambia sólo la imagen web; no restaurar una base encima de actividad posterior.

El informe de esfuerzo está en `../estimates/2026-11-04/analiza-informe-esfuerzo.html` y fue subido en `0b6b2ed`. Es un archivo autónomo para compartir, no una ruta pública de la aplicación. Las 278 horas centrales son estimadas; no son horas reales ni incluyen el rediseño de esta publicación.
