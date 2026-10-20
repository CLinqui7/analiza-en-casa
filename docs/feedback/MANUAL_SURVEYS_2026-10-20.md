# Seguimiento de encuestas por enlace o QR · 20 de octubre de 2026

## Solicitud y decisión

El cliente aclaró los reportes `704ad5ee` (médicos) y `0f06af75` (pacientes): el equipo crea el formulario en una pantalla separada sin acceso desde el menú público, comparte **manualmente** un enlace o un QR según prefiera, y usa una invitación de **una sola respuesta por persona**. El formulario de médicos pide el nombre de quien responde. No se solicita envío automático.

La pantalla interna `/surveys` crea la invitación con vencimiento elegido por el operador y permite copiar el enlace o mostrar/descargar un QR generado en el navegador, sin servicio externo. La ruta `/survey` sólo abre un formulario con token válido, no se anuncia en el menú y declara `noindex,nofollow`. El token aleatorio de 256 bits se guarda sólo como hash; después de una respuesta el enlace no vuelve a mostrar el formulario. Elegir un destinatario del directorio es opcional, por lo que también se puede compartir manualmente con alguien aún no registrado. No se envía ningún mensaje desde la aplicación.

El médico escribe su nombre antes de enviar. El nombre declarado se guarda con la respuesta y aparece únicamente para `ADMIN`, `MANAGER` o `WEBMASTER` en el resumen interno. No se presenta como identidad verificada. Las respuestas de pacientes siguen agregadas sin mostrar identificadores en el tablero.

La migración aditiva `036_manual_survey_sharing.sql` permite que `target_id` y la antigua atestación de consentimiento queden vacíos para invitaciones manuales, y añade `respondent_name` con límite de longitud. Conserva RLS forzado y la política por organización de `survey_invitations`.

## Verificación local

- `npm run check`: 143 pruebas Node, 76 controles QA y build standalone, aprobado.
- `npm run test:react`: 272/272, incluidos el esquema de invitación sin registro previo y la validación del nombre del médico.
- Prueba Playwright del formulario público: nombre solicitado, envío de respuesta y borrado del token de la barra de direcciones, aprobada.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run qa:client-changes` (32/32), `npm run qa:video-parity` (210/210) y `npm run audit:verify` (17/17), aprobados.

## Publicación y estado del feedback

Pendiente de registrar el SHA subido a GitHub, la migración y prueba conectada en el VPS, y la actualización de los dos reportes en la aplicación. El código debe estar en GitHub antes de desplegar. No fusionar el PR automáticamente.
