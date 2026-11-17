# Solicitud recibida el 17 de noviembre de 2026

Fuente: `docs/qa/sources/CLIENT_PART1_CHANGES_2026-11-17.txt` (transcripción de `parte1ana_.docx`, documento fechado 03/11/2026). SHA256 original: `4B86E52C72DFDC36A7F7C5707331EBE1D1FC66ACA65B36CEDEC3E83BFB1F512C`.

Estado: implementación en verificación; todavía no desplegada ni certificada.

Primera fase local: 370 pruebas React/servidor, typecheck, lint, 144 pruebas legacy,
76 controles QA, build standalone y compilación Next pasaron. Gates CH01–CH03,
trazabilidad 210/210, contrato de cambios 32/32, auditoría de evidencia, fronteras
React y escaneo de secretos también pasaron. La validación PostgreSQL y de navegador
del lote sigue pendiente en esta fase.

La compilación detectó avisos nuevos de Next.js. Se actualizó 16.4.1 → 16.4.6
(también eslint-config-next) y fast-xml-parser 5.11.1 → 5.12.1, sin cambios mayores
forzados. `npm audit --omit=dev` devuelve cero vulnerabilidades tras la actualización.
Fuentes: [aviso oficial de caché](https://github.com/advisories/GHSA-mfr8-8qww-v76h),
[release 16.4.6](https://github.com/vercel/next.js/releases/tag/v16.4.6).

| ID | Solicitud conservada en fuente | Implementación | Verificación pendiente |
|---|---|---|---|
| NOV17-01 | Dependientes Sí/No, varios hijos, nombres/apellidos/género/nacimiento y dos documentos | Dependientes administrativos y archivos privados vinculados al paciente e hijo | PostgreSQL, autorización, carga/descarga, navegador móvil |
| NOV17-02 | Responsable por defecto; Enviada; cuatro estados; editar Borrador/Enviada sin otra cotización visible | Usuario actual, estados derivados, una fila/código por raíz, edición enviada atómica con historial inmutable y saldo actualizado; terminales bloqueados en servidor | Concurrencia, pagos y versiones, API, navegador |
| NOV17-03 | Tres modalidades de ingreso y filtro Todos | Modalidad en ingreso, creación al aprobar las tres, filtro y etiqueta | Aprobación real idempotente y filtros |
| NOV17-04 | Precotización: solicitudes enfermería, revisar/asignar y actualizar cotización/CxC | Asignación transaccional a cotización del paciente con precio del catálogo, historial y control de duplicados | Rol runtime, RLS, falta/cambio de precio, concurrencia |
| NOV17-05 | Pedidos recibidos: medicamentos/insumos, visualizar y entregar a enfermera | Proyección de versión vigente, entrega auditada, acumulados y rechazo de sobreentrega | Dos entregas simultáneas, enfermera ajena/inactiva, inventario sin cambios |
| NOV17-06 | Proveedores sale de Catálogos y se crea desde Existencias | Directorio con alta/edición y contactos en Inventario → Existencias → Proveedores | Persistencia y regresión de compras/catálogos |

## Confirmaciones del usuario

- 17/11: «Sí, crear ingreso en las tres modalidades». Sustituye la instrucción anterior que limitaba la creación automática a hospitalización. Aplica a nuevas aprobaciones; no se inventan ingresos históricos.
- 17/11: «Registrar la entrega a la enfermera, sin descontar existencias». No se crean movimientos de inventario ni conversiones de dosis.
- Enviada registra una comunicación manual. No envía WhatsApp ni correo al cliente.
- Se conserva una cotización lógica. Las versiones enviadas anteriores quedan inmutables como evidencia interna; una edición enviada reemplaza el saldo de la misma cuenta, conservando pagos.
- Precotización permite Borrador/Enviada. Aprobada/Rechazada permanecen cerradas conforme a la misma fuente. Un borrador no se convierte en cuenta por cobrar hasta marcarlo Enviada; no se inventa una entrega al cliente.
- Precio ausente: el usuario configura el catálogo. No se completa con cero por defecto.

## Línea base y alcance de evidencia

Preflight inicial correcto; 363 pruebas React/servidor iniciales pasaron. VPS respondió HTTP 200 y mantuvo el despliegue `eaa4fbc55a9a0389ff90e134b186c48f0c8a498b` al inicio. GitHub estaba en `b018f5b678d712b1ec160925b4707fd90b0220ad`, sin cambios remotos nuevos.

Revisión de video acotada: CH03/04/07 y CH14/15, con frames abiertos por agentes de auditoría de solo lectura. Se preservan los ledgers originales y los requisitos no cerrados. Este lote no afirma nueva paridad total ni promueve estados EXACT.

La publicación seguirá el orden: código y pruebas en GitHub, QA aislada con PostgreSQL y rol runtime, copia de seguridad, VPS, comprobación pública. No se fusiona a main ni se ejecuta GitHub Actions.
