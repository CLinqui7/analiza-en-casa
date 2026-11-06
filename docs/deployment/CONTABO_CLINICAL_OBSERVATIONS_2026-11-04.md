# Publicación de observaciones clínicas — 4 de noviembre de 2026

Fuente y alcance: `../feedback/CLINICAL_OBSERVATIONS_2026-11-04.md`.

- GitHub verificado antes de transferir/publicar: `cfc7ceb1fcc53f0e2b9cd7ac260f12f51e2bb967`, rama `codex/feedback-followup-20261014`, PR #20 sin fusionar.
- Código funcional probado: `ae30d5959197e25d77ab9c5d312224afdd8b6550`. El commit de release añade matrices, pruebas y capturas; no cambia ese código.
- Archivo de publicación local/remoto SHA-256: `5f4d69005d68de17256908323e618cec485d74a6adb2395e92561c31f5830b0e`.
- Imagen activa: `sha256:892a5130d51f7f0277ba9a263b018ea6626e7199275bf707b6093c71b18beeb6`.
- Imagen anterior conservada: `sha256:686ab3955a2e9aa01c04a518637bf0579311b0a6f13fa4ed3919bcfc4389c2e7` (release `a9df5c3a93eaabcdfe0effce45ad7142c09a1848`).
- Respaldo previo nuevo: `af5a6b94`, 2026-11-04 20:36:54 UTC. El despliegue exigió respaldo y manifiesto de la base activa antes de continuar. La copia externa de este snapshot no se ha comprobado en este lote.
- Sin DDL nuevo; migraciones idempotentes existentes aplicadas por el operador. Ubuntu y Docker no se actualizaron en este lote.
- Web y PostgreSQL saludables; ningún servicio systemd fallido. Disco 27/193 GB (14%); memoria disponible aproximadamente 10.8 GB.

## QA y comprobación pública

Los 13 grupos PostgreSQL se ejecutaron en una base efímera `analiza_qa`, con datos sintéticos y rol sin bypass RLS. Los siete escenarios HTTP/navegador cubren formularios, menús, correcciones, impresión, perfiles y permisos. Contenedores, red, túneles y archivos de credenciales de ese entorno se retiraron al terminar.

Las pruebas públicas usan exclusivamente la organización sintética autorizada y sus pacientes/casos identificados explícitamente. Ambas terminaron con código 0:

- `scripts/verify-clinical-release.mjs`: cinco grupos aprobados; salud, identidad, guardado/reintento, configuración, doce rutas autenticadas y recarga. Registro sintético `clinical-release-1793824656897`.
- `scripts/verify-clinical-observations-release.mjs`: tres grupos aprobados; plan combinado, reintento idempotente, original conservado y corrección versión 2, Ver/Editar/Imprimir, formulario simplificado, cinco tarjetas médicas y Visitas sin desbordamiento a 390 px. Registros sintéticos `observations-release-1793824671298` y `observations-release-1793824671298-v2`.
- Salud pública HTTP 200 al terminar. Estas comprobaciones no alteraron pagos ni existencias.

El verificador adicional quedó subido a GitHub en `a738719` antes de ejecutarse. Los commits posteriores al release contienen verificadores y documentación; el código de aplicación activo corresponde a `cfc7ceb1fcc53f0e2b9cd7ac260f12f51e2bb967`.

## Reversión

Conservar el archivo privado `releases/before-cfc7ceb1fcc53f0e2b9cd7ac260f12f51e2bb967.env` y la imagen anterior. Restaurar la imagen web anterior con el procedimiento existente del operador si fuese necesario; no restaurar la base encima de datos nuevos sin evaluación. Los planes nuevos usan `plans` y las correcciones de administración generan versiones: una interfaz antigua no interpreta todo ese comportamiento, por lo que la reversión requiere revisar ese alcance.

No se incluyen credenciales ni datos reales en este documento.
