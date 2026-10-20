# Campos del médico · decisión del cliente del 20 de octubre de 2026

Fuente: instrucción directa del cliente en este chat: «implementa eso, hazles caso porfa, quita la orden de no dejarlas obligatorias», referida a la captura del reporte `6486d7b8` de «Médicos y recursos». Esta decisión sustituye la instrucción previa de conservar DUI y dirección obligatorios (`82aa73e0`). La captura permanece en el feedback de la aplicación; no se incorpora una imagen con datos de terceros al repositorio.

El reporte indica: «eliminar la obligatoriedad del DUI y la dirección» y retira la solicitud anterior de incorporar las bases de médicos de Laboratorios Analiza. Los campos pedidos son:

| Campo | Obligatorio al guardar | Estado |
| --- | --- | --- |
| Nombre completo | Sí | Formulario y API |
| Fecha de nacimiento | No | Formulario y persistencia |
| JVPM | No | Existente |
| CONADEM | No | Existente |
| DUI | No | Formulario, contrato y API |
| Especialidad | Sí | Existente |
| Clínica (nombre) | No | Formulario y persistencia |
| Dirección | No | Formulario, contrato y API |
| Teléfono celular | No | Campo `phone` existente |
| Teléfono fijo | Sí | Formulario y API; lectura compatible con registros históricos |
| Email | No | Existente |
| NIT | No | Formulario y persistencia |
| Horarios de consulta | No | Formulario y persistencia |
| Horario de visita médica | No | Formulario y persistencia |
| Zona | No | Formulario y persistencia |
| Nombre de la secretaria | No | Formulario y persistencia |
| Cumpleaños de la secretaria | No | Formulario y persistencia |

La relación nuevo/recurrente sigue siendo obligatoria por el reporte independiente `6c828e53`. Los médicos históricos sin teléfono fijo continúan visibles y deben completarlo cuando se editen. La aplicación no inventa datos para ellos. No se importa ninguna base antigua de médicos. Código verificado en el commit `b2ba1ef206e20eff729ff87552cf44e82b837696`.

Verificación local: `npm run repo:preflight`, `npm run typecheck`, `npm run test:react` (275/275), `npm run check` (143/143 pruebas Node, 76/76 QA), `npm run qa:client-changes` (32/32), `npm run qa:video-parity` (210/210), `npm run audit:verify` (17/17), `npm run build`, lint, formato, seguridad, límites React, Playwright B2 (7/7) + B4/feedback (9/9) y Selenium de médicos (6/6). La prueba inicial de Playwright cargó la configuración local de la base conectada y rechazó las cuentas demo; al ejecutar explícitamente el modo demo, las 16 pruebas pasaron. El primer intento de Selenium alcanzó el buscador del listado al buscar JVPM; se limitó el selector al diálogo y la suite pasó al repetirla.
