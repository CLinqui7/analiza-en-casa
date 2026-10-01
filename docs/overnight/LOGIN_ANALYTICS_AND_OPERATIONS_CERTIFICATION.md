# Certificación de bitácora y flujos operativos

Fecha de verificación: 2026-10-01 (America/El_Salvador)

## Alcance

Este lote implementa y prueba:

- una bitácora privada de inicios de sesión exitosos;
- destino de bodega obligatorio para compras nuevas;
- recepción trazada de compras por lote o serie;
- cotizaciones para pacientes sin hospitalización previa;
- códigos cortos de cotización sólo para presentación;
- búsqueda de la cotización de un pago por paciente o código.

No se almacenan credenciales, direcciones IP, agentes de navegador ni contenido clínico en la
bitácora. Los identificadores internos de cotizaciones se conservan; el código `COT-XXXXXXXX` es
una representación visual y no sustituye la llave persistente.

## Reglas configuradas

### Bitácora de accesos

- Registra únicamente una autenticación exitosa, en la misma transacción que crea la sesión.
- El historial empieza al activar la migración; no se reconstruyen accesos históricos.
- Muestra total, últimos 7 días, últimos 30 días y días activos en 30 días.
- Excluye la cuenta de analítica de sus propios conteos.
- Sólo el rol dedicado `ANALYTICS` tiene `login-analytics:read`.
- La vista se actualiza cada 60 segundos y admite actualización manual.

### Compras, bodega y trazabilidad

- Toda compra nueva requiere proveedor activo, ítem permitido y bodega activa.
- Medicamentos e insumos requieren lote y vencimiento.
- Equipos requieren un número de serie y se reciben una unidad por registro.
- Recibir una compra es idempotente y atómico: crea la traza, crea su saldo por ubicación,
  registra el evento, cambia la compra a `RECEIVED` y conserva auditoría.
- Toda recepción empieza en `QUARANTINED`; no queda disponible hasta una liberación explícita.
- Una bodega sólo puede desactivarse cuando no conserva existencias.
- Los traslados bloquean y actualizan origen y destino dentro de una transacción.

### Cotizaciones y pagos

- El paciente es obligatorio; la hospitalización es opcional.
- Si se vincula una hospitalización, debe pertenecer al mismo paciente y organización.
- La identidad paciente/hospitalización no puede cambiar silenciosamente al editar un borrador.
- Los pagos sólo muestran cotizaciones enviadas con saldo y permiten buscar por paciente o código.

## Evidencia automatizada

- `npm test`: 128/128.
- `npm run test:react`: 177/177.
- Playwright focalizado: 35/35 en cotizaciones, compras/bodegas y bitácora; pagos se validó
  en su prueba focalizada del lote.
- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado.
- `npm run build`: 49 páginas generadas; rutas de bitácora y API incluidas.
- `npm run security:scan`: aprobado.
- `npm audit`: 0 vulnerabilidades de producción o desarrollo después de actualizar Next.js y
  su configuración ESLint a 16.3.8.
- `npm run audit:verify`: 17/17 capítulos, 0 pendientes.
- `npm run repo:preflight`: aprobado.

## Verificación productiva

- Commit de aplicación verificado: `d0b71a6`.
- Despliegue Vercel: `dpl_EejfdHbV993acPLb1v2rrsSvvfd7`, estado `READY`.
- URL productiva: <https://analiza-en-casa-demo.vercel.app>.
- Salud: `ready`, modo `postgresql`, base de datos `ready`.
- La cuenta dedicada de analítica abre `/analytics/logins`; una sesión `ADMIN` recibe acceso
  restringido en esa misma ruta.
- Los cuatro usuarios solicitados aparecen activos en la tabla. Un inicio de sesión productivo
  posterior a la activación quedó registrado con sus conteos de 7/30 días y días activos.
- Compras muestra proveedor y bodega de destino activa en el formulario nuevo; no se creó una
  compra de prueba en producción.
- Feedback productivo: 49 reportes, 0 nuevos, 4 en revisión y 45 resueltos. Los cuatro errores
  nuevos del lote quedaron respondidos y enlazados a sus pantallas corregidas; los cuatro en
  revisión ya existían y conservan su estado por depender de definición o integración externa.
