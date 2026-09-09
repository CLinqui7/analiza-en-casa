# Certificación local · Cotizaciones, preautorizaciones y portal seguro

Fecha: 2026-09-09

## Alcance implementado

- Cotizaciones Mongo: crear, editar borradores y enviar una versión inmutable con control optimista de versión.
- Cada escritura financiera y su evento de auditoría se ejecutan dentro de la misma transacción.
- Preautorizaciones: alta y actualización idempotente del estado, limitada a la organización y a una cotización/paciente válidos.
- Portal QR: token aleatorio de un solo canal, persistido únicamente como hash, con vencimiento automático de 24 horas.
- Segundo factor: código de ocho dígitos, hash, vencimiento de 10 minutos, consumo único y límite de intentos.
- WhatsApp: destino derivado del paciente con consentimiento explícito; el mensaje contiene sólo un enlace seguro y el OTP se entrega mediante plantilla privada.
- Semilla QA: inserción opcional, idempotente y exclusivamente sintética mediante `--seed-synthetic`.

## Verificación ejecutada

- `npm run typecheck --workspace=@analiza/web`: aprobado.
- `npm run test --workspace=@analiza/web -- --run`: 23 archivos, 88 pruebas aprobadas.
- `npm run lint --workspace=@analiza/web`: aprobado.
- `npm test`: 103 pruebas aprobadas.
- `npm run audit:verify`: 17 de 17 capítulos aprobados; permanecen 32 solicitudes del Excel y 210 requisitos de video.

## Límites de la certificación

La implementación está probada localmente a nivel de contratos, permisos y componentes, pero no se declara persistencia remota certificada. Esta sesión todavía no dispone de `MONGODB_URI`, usuario de aplicación con privilegio limitado a `analiza_en_casa`, allowlist protegida de Atlas ni credenciales privadas del proveedor WhatsApp. Por ello siguen pendientes el bootstrap remoto, la lectura desde una segunda sesión autorizada y la prueba de denegación para una organización distinta.

No se certifica generación o envío directo de PDF por WhatsApp: el alcance implementado envía un enlace seguro sin diagnóstico, tratamiento, medicamentos ni importes en el texto del mensaje.
