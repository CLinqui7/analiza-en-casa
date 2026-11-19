# Seguimiento de encuestas por enlace o QR · 20 de octubre de 2026

## Solicitud y decisión

El cliente aclaró los reportes `704ad5ee` (médicos) y `0f06af75` (pacientes): el equipo crea el formulario en una pantalla separada sin acceso desde el menú público, comparte **manualmente** un enlace o un QR según prefiera, y usa una invitación de **una sola respuesta por persona**. El formulario de médicos pide el nombre de quien responde. No se solicita envío automático.

La pantalla interna `/surveys` crea la invitación con vencimiento elegido por el operador y permite copiar el enlace o mostrar/descargar un QR generado en el navegador, sin servicio externo. La ruta `/survey` sólo abre un formulario con token válido, no se anuncia en el menú y declara `noindex,nofollow`. El token aleatorio de 256 bits se guarda sólo como hash; después de una respuesta el enlace no vuelve a mostrar el formulario. Elegir un destinatario del directorio es opcional, por lo que también se puede compartir manualmente con alguien aún no registrado. No se envía ningún mensaje desde la aplicación.

El médico escribe su nombre antes de enviar. El nombre declarado se guarda con la respuesta y aparece únicamente para `ADMIN`, `MANAGER` o `WEBMASTER` en el resumen interno. No se presenta como identidad verificada. Las respuestas de pacientes siguen agregadas sin mostrar identificadores en el tablero.

La migración aditiva `036_manual_survey_sharing.sql` permite que `target_id` y la antigua atestación de consentimiento queden vacíos para invitaciones manuales, y añade `respondent_name` con límite de longitud. Conserva RLS forzado y la política por organización de `survey_invitations`.

La primera prueba conectada descubrió que Next recibía la dirección interna `0.0.0.0:8080` detrás del proxy y la usaba al crear el enlace. La corrección exige `ANALIZA_PUBLIC_ORIGIN` en el entorno privado del servidor, valida que sea un origen HTTPS sin ruta ni credenciales y construye la invitación desde ese origen antes de guardarla. La invitación sintética creada durante el hallazgo no se compartió; su token no se conserva y vencerá según la fecha de prueba. No se cerrarán los reportes hasta comprobar un enlace externo nuevo.

## Verificación local

- `npm run check`: 143 pruebas Node, 76 controles QA y build standalone, aprobado.
- `npm run test:react`: 274/274, incluidos el esquema de invitación sin registro previo, la validación del nombre del médico y el origen HTTPS explícito.
- Prueba Playwright del formulario público: nombre solicitado, envío de respuesta y borrado del token de la barra de direcciones, aprobada.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run qa:client-changes` (32/32), `npm run qa:video-parity` (210/210) y `npm run audit:verify` (17/17), aprobados.

## Publicación y verificación conectada

- Los commits `128956e0b6ad7ea3a9da6578e288917ee1d76940` (formulario, QR y migración) y `b1db386ada0c3435827f2454bb004ad3dbdcdd2e` (origen público) se subieron a GitHub y se verificó cada SHA remoto **antes** de desplegarlo. La imagen activa de Contabo corresponde a `b1db386ada0c3435827f2454bb004ad3dbdcdd2e`.
- La migración `036_manual_survey_sharing.sql` se ensayó con `BEGIN`/`ROLLBACK` antes del primer despliegue y figura aplicada en `analiza_live_20261014`. `survey_invitations` conserva RLS habilitado y forzado. La configuración privada `ANALIZA_PUBLIC_ORIGIN` apunta al dominio público y la API devuelve enlaces desde ese origen; no se incluyó ningún secreto en Git.
- Con la organización sintética de QA se comprobó en el VPS: enlace público de médico, nombre obligatorio, envío desde navegador, borrado del token de la barra de direcciones, rechazo de reutilización y resumen interno con nombre declarado; enlace y respuesta de paciente, rechazo de reutilización y conteo agregado; generación visual de QR, descarga y cambio al enlace en la pantalla interna. El servidor no envió mensajes. Los intentos iniciales de QA que no llegaron a completarse quedaron sin compartir y vencerán según su fecha de prueba.
- La salud pública devolvió HTTP 200 y la imagen activa coincide con el SHA publicado. El despliegue tomó respaldo cifrado; el snapshot restic más reciente es `15ee253b`, con `analiza-contabo-backup.service` en `Result=success` y su timer activo. La próxima ejecución automática y la copia externa de Windows aún deben comprobarse.
- Los reportes `704ad5ee` y `0f06af75` se actualizaron a `RESOLVED` mediante la API autenticada de feedback con explicación y ruta `/surveys`. Estado de la organización principal: **0 `NEW`, 11 `REVIEWING`, 75 `RESOLVED`**. Los demás reportes en revisión conservan sus dependencias. El [PR #20](https://github.com/CLinqui7/analiza-en-casa/pull/20) sigue abierto y no se fusionó a `main`.
