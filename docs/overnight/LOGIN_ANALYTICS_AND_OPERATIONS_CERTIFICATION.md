# Certificación de bitácora y flujos operativos

Fecha de verificación: 2026-10-01 (America/El_Salvador)

## Alcance

Este lote implementa y prueba:

- una bitácora privada de inicios de sesión exitosos;
- una presentación visual renovada, adaptable y accesible para esa bitácora;
- el rol `WEBMASTER`, con las capacidades de administración más el acceso exclusivo adicional a
  la bitácora;
- destino de bodega obligatorio para compras nuevas;
- recepción trazada de compras por lote o serie;
- cotizaciones para pacientes sin hospitalización previa;
- códigos cortos de cotización sólo para presentación;
- búsqueda de la cotización de un pago por paciente o código;
- medios de pago explícitos y referencia condicional para transferencias y tarjetas; y
- corrección auditada de turnos programados en Agenda.

No se almacenan credenciales, direcciones IP, agentes de navegador ni contenido clínico en la
bitácora. Los identificadores internos de cotizaciones se conservan; el código `COT-XXXXXXXX` es
una representación visual y no sustituye la llave persistente.

## Reglas configuradas

### Bitácora de accesos

- Registra únicamente una autenticación exitosa, en la misma transacción que crea la sesión.
- El historial empieza al activar la migración; no se reconstruyen accesos históricos.
- Muestra total, últimos 7 días, últimos 30 días y días activos en 30 días.
- Excluye la cuenta de analítica de sus propios conteos.
- Los roles `ANALYTICS` y `WEBMASTER` tienen `login-analytics:read`.
- `ANALYTICS` permanece aislado de las funciones administrativas; `WEBMASTER` conserva todas las
  capacidades administrativas y añade la bitácora.
- La vista se actualiza cada 60 segundos y admite actualización manual.
- La interfaz usa tarjetas, tabla adaptable, jerarquía visual, animaciones discretas y respeta
  `prefers-reduced-motion`; no genera desbordamiento horizontal a 390 px.

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
- El formulario ofrece `Efectivo`, `Cheque`, `Transferencia` y `Tarjeta`.
- Transferencia y Tarjeta requieren número de referencia; Efectivo y Cheque no lo solicitan.
- La clave idempotente se genera y conserva internamente para evitar pagos duplicados; no se
  presenta como un campo técnico al usuario.

### Agenda

- Sólo se corrigen turnos mientras están en estado `SCHEDULED`.
- La edición permite corregir enfermera, paciente, fecha, horas, estado y notas.
- El servidor vuelve a validar organización, recursos, paciente, disponibilidad y colisiones.
- La operación es transaccional, idempotente y conserva auditoría `SHIFT_UPDATED`.

## Evidencia automatizada

- `npm test`: 130/130.
- `npm run test:react`: 179/179 en 40 archivos.
- Playwright completo: 190/190; además pasaron los flujos focalizados de bitácora, pagos y Agenda.
- `npm run qa`: 76/76.
- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado.
- `npm run build`: 49 páginas generadas; rutas de bitácora y API incluidas.
- `npm run security:scan`: aprobado.
- `npm audit`: 0 vulnerabilidades de producción o desarrollo después de actualizar Next.js y
  su configuración ESLint a 16.3.8.
- `npm run audit:verify`: 17/17 capítulos, 0 pendientes.
- Gate de paridad de video: 210/210.
- Contrato de cambios del cliente: 32/32.
- Auditoría automatizada de accesibilidad en producción: 0 violaciones; el contraste sobre
  gradientes queda registrado por axe como comprobación manual, no como incumplimiento.
- `npm run repo:preflight`: aprobado.

## Verificación productiva

- Commit de aplicación verificado: `5e55d18`.
- Despliegue Vercel: `dpl_4Jbt4bQUFC97w7ZsPsXR1x6JaHr3`, estado `READY`.
- URL productiva: <https://analiza-en-casa-demo.vercel.app>.
- Salud: `ready`, modo `postgresql`, base de datos `ready`.
- La cuenta `WEBMASTER` solicitada fue aprovisionada y verificada sin registrar su correo ni su
  contraseña en el repositorio. Abre `/analytics/logins` y conserva el menú administrativo
  completo; `ADMIN` sigue sin acceso a esa ruta privada.
- Los cuatro usuarios solicitados aparecen activos en la tabla. Un inicio de sesión productivo
  posterior a la activación quedó registrado con sus conteos de 7/30 días y días activos.
- Compras muestra proveedor y bodega de destino activa en el formulario nuevo; no se creó una
  compra de prueba en producción.
- Cuentas por cobrar muestra los cuatro medios de pago y solicita la referencia sólo al elegir
  Transferencia o Tarjeta; la comprobación no creó pagos en producción.
- Agenda muestra `Editar turno` en el detalle de un turno sintético programado y ofrece todos los
  campos autorizados; la comprobación no modificó el turno productivo.
- Feedback productivo: 51 reportes, 0 nuevos, 4 en revisión y 47 resueltos. Los dos reportes nuevos
  de este lote quedaron respondidos y enlazados a `/receivables` y `/agenda`; los cuatro en
  revisión conservan su estado por depender de definición o integración externa.
