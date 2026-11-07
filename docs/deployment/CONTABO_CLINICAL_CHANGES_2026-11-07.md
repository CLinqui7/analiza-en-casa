# Publicación clínica del 7 de noviembre de 2026

Release activo **`eaa4fbc55a9a0389ff90e134b186c48f0c8a498b`**, rama `codex/feedback-followup-20261014`, PR #20 abierto y sin fusionar. El SHA se comprobó en GitHub antes de crear y transferir el archivo de publicación.

Alcance y pruebas: `../feedback/CLINICAL_CHANGES_2026-11-07.md`. Guía del equipo: `../feedback/GUIA_CLINICA_2026-11-07.md`.

- Código de lógica verificado: `e1223d3f121d3718c9e08e1dfdd049f3dc4f4c34`. Release `0791fd7ac20621e415969768fccc6cbe8e3705e8` publicó esa implementación y su evidencia; el release final añade únicamente márgenes, contraste y agrupación de encabezados al imprimir.
- Archivo final de publicación, SHA-256 local/remoto: `cf82595adb956880ba516fd6051a09512c8fa12d7e3c2b85c17779ac58a2e443`.
- Imagen web activa: `sha256:85602f327fced62ac42c3a9a87ddc1ffe4a93d663aaa4da12da861cb1774fca4`.
- Imagen anterior conservada: `sha256:ace49bca408630d7374024c5a58c62f4c2ae9334544247df0eaae536d5987377` (`0791fd7`). También se conserva el release anterior al lote, `ac44496b0bd05561c51ea06db978e8ebd5e19a24`.
- Respaldo final previo: `6e59aa2807f02e5e838682e9a6c4198d46b8259265c31f351c2a20e82bb459fa`, 7 de noviembre, 18:05:01 UTC. El despliegue exige snapshot nuevo con volcado y manifiestos de la base activa. Primera publicación del lote: snapshot `44259daf602a158e305c21cfcfea5426908b6da101451233f4418640ef16d9cf`.
- No hay migraciones nuevas. El operador ejecutó la verificación idempotente de las migraciones existentes. No se cambiaron Ubuntu ni Docker en este lote.
- Salud pública HTTP 200, imagen comprobada por etiqueta SHA, web y PostgreSQL saludables, cero servicios systemd fallidos. Comprobación del host: disco 17% utilizado, 161 GiB disponibles y aproximadamente 10,4 GiB de memoria disponibles antes de retirar QA.

## Verificación pública

`scripts/verify-clinical-nov07-release.mjs`, publicado antes de ejecutarse, pasó los nueve grupos: persistencia, inventario, idempotencia, corrección, devoluciones, impresión selectiva, responsive, configuración y salud. Usa exclusivamente la organización sintética autorizada; no altera pacientes, existencias ni cotizaciones de organizaciones operativas.

Última comprobación: caso `case-synthetic-nov07-1794074818388`, tarjeta `card-nov07-1794074818388`. Regla sintética de dos unidades por aplicación, dos horarios, una aplicación y una omisión; reintento sin duplicar salida y corrección que compensa sólo la aplicación afectada. Originales conservados y dos devoluciones diferenciadas por horario. HTTP/API y navegador confirman los datos guardados.

Se revisaron diálogos a 1440/390 px, ausencia de desbordamiento horizontal, el retiro de la salida manual y la impresión selectiva en PDF. Cero errores JavaScript. Las capturas finales desactivan temporalmente las animaciones únicamente al tomar la imagen para evitar fotografiar el diálogo durante su entrada. La aplicación conserva sus animaciones accesibles. Capturas sintéticas en `../feedback/evidence/clinical-nov07/`.

El verificador final `0c48419e52e4f5af2e1d29d3fa59ed3dc41229d5` sólo ajusta las capturas, sin cambiar la aplicación desplegada. La primera ejecución pública del mismo lote también aprobó los nueve grupos.

## Entorno de pruebas y límites

QA se ejecutó en PostgreSQL efímero `analiza_qa`, con un rol restringido, migraciones repetidas y datos sintéticos. Pasaron 15 grupos de integración y ocho escenarios conectados. Al terminar se retiraron los dos contenedores QA, su red, etiquetas de imagen, túneles y credenciales temporales locales/remotas. Las imágenes de producción se conservaron.

El equipo debe configurar el origen y las unidades reales por medicamento. La aplicación no inventa dosis ni consumos. Se mantienen las asignaciones históricas, versiones y permisos. La copia externa y la restauración de los nuevos snapshots no se comprobaron en este lote; no se afirma una nueva auditoría visual completa de los 17 vídeos ni se promueven requisitos a EXACT.

Para revertir la web, usar el procedimiento del operador y el archivo privado `releases/before-eaa4fbc55a9a0389ff90e134b186c48f0c8a498b.env`. Volver a `0791fd7` conserva el contrato de horarios y sólo pierde el ajuste final de impresión. Una versión anterior a este lote no presenta todos los horarios nuevos: revisar el alcance antes de usarla. No restaurar una base sobre datos posteriores sin evaluar su impacto.

No hay contraseñas ni datos clínicos reales en este documento.
