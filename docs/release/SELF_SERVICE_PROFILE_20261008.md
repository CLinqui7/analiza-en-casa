# Perfil personal · 8 de octubre de 2026

Fuente literal del pedido: «creales un modulo de perfil que puedan subir su foto y cambair nombre y cmabiar contyraseña porfa».

## Alcance entregado

- `/profile` está disponible para cualquier sesión autenticada, incluidos usuarios sin Dashboard y el rol `ANALYTICS`. Se abre desde «Mi cuenta»; no otorga permisos sobre otras cuentas.
- Nombre: 2–80 caracteres; el correo y el rol son solo lectura. Cada edición deja evidencia en la bitácora técnica.
- Foto: PNG, JPEG o WebP de hasta 1 MiB, validada por tamaño y firma; el servidor la decodifica, reduce a un máximo de 320 px y convierte a WebP sin metadatos. Se almacena en la cuenta privada, se sirve únicamente a su propia sesión con `no-store` y `nosniff`, y reemplazarla incrementa una versión para actualizar la vista.
- Contraseña: exige la contraseña actual; la nueva debe tener al menos 12 caracteres y ser distinta. Se limitan los intentos, el cambio se registra sin el secreto, se revocan todas las sesiones y se exige entrar de nuevo.
- Las operaciones de modificación exigen sesión y token CSRF. PostgreSQL y MongoDB aplican el usuario de la sesión, nunca un ID enviado por el navegador. En PostgreSQL la pertenencia activa a la organización forma parte del filtro de cada lectura y edición.
- El modo demo explica que no persiste perfiles; no simula cambios reales de contraseña.

## Decisiones de implementación

El límite de 1 MiB y los formatos sin contenido activo evitan archivos excesivos o SVG ejecutable. La contraseña conserva el mínimo de 12 caracteres del servicio de autenticación existente. El cambio de clave cierra todas las sesiones para que una sesión anterior no siga activa. No se inventaron reglas clínicas, fiscales, de retención ni nuevos privilegios.

## Verificación y despliegue

Migración aditiva `028_account_profiles.sql` aplicada en la base PostgreSQL de producción el 8 de octubre de 2026 mediante la identidad migradora; las 28 versiones y hashes coincidieron y se confirmó el rol restringido `analiza_runtime`. Ningún perfil existente se modificó durante la migración. Una verificación transaccional en esa base creó únicamente datos `.test`, comprobó que el filtro de organización impide editar una cuenta ajena y que nombre/foto se guardan, y ejecutó `ROLLBACK`: no quedaron cuentas de QA.

Pruebas enfocadas: `account-profile.test.ts` (validación), `account-avatar.test.ts` (decodificación real y rechazo de imagen corrupta), `postgres-account-profile.test.ts` y `mongo-account-profile.test.ts` (propiedad, auditoría y revocación), `route.test.ts` y `profile-routes.test.ts` (sesión, CSRF, identidad del servidor, foto y clave), `postgres-account-profile.test.mjs` (restricciones de esquema), `profile.spec.ts` (navegación de ADMIN, NURSE y ANALYTICS) y `profile-connected.spec.ts` (los tres formularios conectados y nueva sesión requerida). La regresión de navegador pasó 215/215; `npm run check` pasó 138/138 pruebas del repositorio, 76/76 QA y build standalone. La instalación limpia `npm ci` pasó y `npm audit --omit=dev` reportó 0 vulnerabilidades de producción. El gate de paridad de video permanece 210/210 y la auditoría de capítulos 17/17; este pedido nuevo no se clasifica artificialmente como paridad de video `EXACT` ni modifica `docs/qa/CLIENT_CHANGE_REQUESTS.json`, cuyo origen canónico es el Excel auditado de 32 filas.

El resultado de regresión completa, commit, despliegue y smoke se añadirá tras ejecutar la certificación final.
