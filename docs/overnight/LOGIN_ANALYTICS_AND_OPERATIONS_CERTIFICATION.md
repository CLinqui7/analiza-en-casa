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
- Playwright focalizado: cotizaciones, pagos, compras/bodegas y bitácora.
- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado.
- `npm run build`: 49 páginas generadas; rutas de bitácora y API incluidas.
- `npm run security:scan`: aprobado.
- `npm run audit:verify`: 17/17 capítulos, 0 pendientes.
- `npm run repo:preflight`: aprobado.

La verificación productiva, SHA y URL de despliegue se registran al finalizar la promoción.
