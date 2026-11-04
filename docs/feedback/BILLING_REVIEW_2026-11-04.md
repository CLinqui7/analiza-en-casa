# Revisión de facturación y capturas del 4 de noviembre

Fuente conservada en `../qa/sources/CLIENT_BILLING_REVIEW_2026-11-04.txt`.

## Correcciones

- Seguros: tarjetas legibles en una, dos, tres o seis columnas según el espacio disponible; nombres, identificadores y botones permanecen dentro de su tarjeta. Código corto de cotización con identificador completo disponible al consultar.
- Médicos: eliminado el aviso técnico amarillo sobre Mongo y almacenamiento de adjuntos. Antes aparecía a los usuarios con acceso a esa pantalla. Se conserva el aviso del entorno de demostración.
- Cierre de sesión: un solo texto, «Cerrar sesión».
- Cuenta de cotización: detalle, lista y Cuentas por cobrar usan la última versión enviada y los pagos de toda su cadena. Ejemplo sintético: v1=100, abono=40, v2=120; saldo actual=80 en todas las pantallas. El documento histórico conserva su total=100 y explica la diferencia entre versión y cuenta.
- Reintento de pago: conserva ID, fecha y clave de idempotencia cuando se pierde la respuesta, incluso al cerrar y reabrir el diálogo. Cambiar un pago ya aplicado con la misma clave sigue rechazándose.
- Importes nuevos: máximo dos decimales, mínimo 0.01 y referencia de reserva obligatoria para cheque. Los registros históricos siguen siendo legibles; el cálculo agrega cada pago en centavos, como el libro PostgreSQL.
- Versiones: no se puede cambiar paciente, caso, número de versión, raíz, origen o fecha de creación al editar un borrador. Las revisiones continúan por su flujo específico y las enviadas permanecen inmutables.
- Seguro: se usa el pagador de la cotización; una cuenta particular/empresa no entra por tener el paciente una aseguradora. Las solicitudes existentes conservan su aseguradora registrada. La fecha inicial del formulario respeta la hora local.

## Evidencia en curso

Preflight aprobado; 331 pruebas unitarias en 67 archivos; seis grupos PostgreSQL con rol restringido, RLS y datos exclusivamente sintéticos aprobados. Incluyen concurrencia, reintentos, sobrepago, centavos, límites por rol/organización, revisiones, reversión auditada y aseguradora. Tablero poblado sin desbordamiento en 320, 390, 768, 1024, 1440 y 1600 px.

La regresión completa de navegador y la simulación HTTP de respuesta perdida se registrarán aquí antes de desplegar. Esta fase de código no constituye confirmación de publicación en producción.

## Evidencia histórica y límites

Revisión de lectura de evidencia financiera: CH08-E0087 (00:19:52.000, resumen y saldo), CH08-E0056 (00:18:06.200, acciones de pagos) y CH16-E0018 (00:50:18.200, descuento por categoría). Archivos bajo los capítulos CH08 y CH16 de `references/video-audit/`, intactos. No se declara una nueva revisión completa de los 17 capítulos ni se eleva ningún requisito a EXACT.

Los porcentajes y responsabilidades de aseguradora siguen capturados por el equipo. No se inventaron reglas de reembolso/crédito cuando una revisión queda por debajo de lo pagado, corte contable ni integración fiscal. Los PDF son comprobantes internos no fiscales. Se mantienen abiertos los límites previamente documentados CH08-Q001/Q003/Q004/Q006 y CH07-Q008/Q009.

## Reproducir las pruebas

`npm run test:react` y `npm run test:browser:react` verifican lógica y la compilación demo. Para PostgreSQL aislado: preparar una base temporal con `scripts/prepare-clinical-postgres-qa.mjs`, cargar sus variables privadas fuera de Git y ejecutar `npm run test:billing:postgres`. Guardar su resultado con `BILLING_QA_RESULT`. `npm run test:billing:browser` exige `ANALIZA_QA_MODE=1`, `PGDATABASE=analiza_qa`, `PGHOST=127.0.0.1` y el túnel exclusivo 55440 a la web de QA, nunca a la base activa.
