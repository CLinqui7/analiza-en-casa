# Solicitud recibida el 17 de noviembre de 2026

Fuente: `docs/qa/sources/CLIENT_PART1_CHANGES_2026-11-17.txt` (transcripción de `parte1ana_.docx`, documento fechado 03/11/2026). SHA256 original: `4B86E52C72DFDC36A7F7C5707331EBE1D1FC66ACA65B36CEDEC3E83BFB1F512C`.

Estado: implementado, subido a GitHub, publicado en Contabo y comprobado en la URL pública.

Seguimiento de NOV17-04: el usuario confirmó posteriormente «Permitir ampliación auditada de una aprobada». La excepción y su validación se registran en [APPROVED_QUOTE_EXTENSION_2026-11-17.md](APPROVED_QUOTE_EXTENSION_2026-11-17.md); las cifras y SHA siguientes corresponden a la primera entrega del documento.

Código de aplicación verificado: `0d4990de09b77eba5de07de17c464a888019338b`.
Release publicado: `2629daaa362d665080de9c52f5ba666d2bd6e7bd` (añade guía, evidencia y ajustes menores de texto/conteo, también comprobados).
Guía operativa: `../feedback/GUIA_PARTE1_2026-11-17.md`.
Despliegue y límites operativos: `../deployment/CONTABO_PART1_2026-11-17.md`.

Primera fase local: 370 pruebas React/servidor, typecheck, lint, 144 pruebas legacy,
76 controles QA, build standalone y compilación Next pasaron. Gates CH01–CH03,
trazabilidad 210/210, contrato de cambios 32/32, auditoría de evidencia, fronteras
React y escaneo de secretos también pasaron. La validación PostgreSQL y de navegador
del lote estaba pendiente en esa primera fase; los resultados finales se detallan abajo.

La compilación detectó avisos nuevos de Next.js. Se actualizó 16.4.1 → 16.4.6
(también eslint-config-next) y fast-xml-parser 5.11.1 → 5.12.1, sin cambios mayores
forzados. `npm audit --omit=dev` devuelve cero vulnerabilidades tras la actualización.
Fuentes: [aviso oficial de caché](https://github.com/advisories/GHSA-mfr8-8qww-v76h),
[release 16.4.6](https://github.com/vercel/next.js/releases/tag/v16.4.6).

| ID | Solicitud conservada en fuente | Implementación | Verificación realizada |
|---|---|---|---|
| NOV17-01 | Dependientes Sí/No, varios hijos, nombres/apellidos/género/nacimiento y dos documentos | Dependientes administrativos y archivos privados vinculados al paciente e hijo | PASS: PostgreSQL, autorización por hijo/organización, carga/descarga de bytes, recarga y móvil |
| NOV17-02 | Responsable por defecto; Enviada; cuatro estados; editar Borrador/Enviada sin otra cotización visible | Usuario actual, estados derivados, una fila/código por raíz, edición enviada atómica con historial inmutable y saldo actualizado; terminales bloqueados en servidor | PASS: concurrencia, pagos/versiones, API y edición real por navegador; rechazo de borrador sin nuevo cargo |
| NOV17-03 | Tres modalidades de ingreso y filtro Todos | Modalidad en ingreso, creación al aprobar las tres, filtro y etiqueta | PASS: aprobación HTTP de las tres, reintento sin duplicar ingreso, modalidad persistida y filtros |
| NOV17-04 | Precotización: solicitudes enfermería, revisar/asignar y actualizar cotización/CxC | Asignación transaccional a cotización del paciente con precio del catálogo, historial y control de duplicados | PASS: rol runtime, RLS, falta/cambio de precio, paciente ajeno y concurrencia; UI conectada |
| NOV17-05 | Pedidos recibidos: medicamentos/insumos, visualizar y entregar a enfermera | Proyección de versión vigente, entrega auditada, acumulados y rechazo de sobreentrega | PASS: entregas simultáneas, enfermera no disponible, rol/organización, inventario sin cambios y persistencia por navegador |
| NOV17-06 | Proveedores sale de Catálogos y se crea desde Existencias | Directorio con alta/edición y contactos en Inventario → Existencias → Proveedores | PASS: crear/editar/recargar contactos, búsquedas, permisos y ruta anterior |

## Resultado de QA y revisión

- 370 pruebas unitarias/servidor en 72 archivos; TypeScript y ESLint aprobados.
- 144 pruebas legacy, 76 controles QA y build standalone aprobados.
- 28 grupos PostgreSQL aislados: 7 del lote, 15 clínicos y 6 financieros. Rol sin superusuario ni bypass de RLS; migraciones 040/041 repetidas correctamente.
- 47 escenarios de regresión mock: cotizaciones, CxC/pagos, ingresos clínicos, inventario, proveedores y ergonomía. Tras ajustar las expectativas del antiguo directorio de proveedores, los dos escenarios afectados y tres controles relacionados pasaron en repetición focalizada.
- 11 escenarios conectados de navegador aprobados entre la ejecución inicial y las repeticiones focalizadas: 8 clínicos anteriores y 3 del lote. Incluyen documentos privados, las tres modalidades, edición enviada, descuento por categoría, continuidad de la tarjeta de medicamentos, entregas y proveedores.
- Compilación de producción con Next.js 16.4.6 aprobada en contenedor aislado; cero avisos en la auditoría de dependencias de producción. No se afirma que las dependencias exclusivas de desarrollo tengan cero avisos.
- Gates CH01/CH02/CH03, trazabilidad 210/210, contrato 32/32, espejo JSON/CSV, auditoría de ledgers, fronteras React y escaneo de secretos aprobados.
- Capturas sintéticas revisadas en `../feedback/evidence/part1-nov17/`. Las tablas nuevas se convierten en tarjetas en móvil para mostrar las acciones sin desplazamiento horizontal interno.
- Producción: documentos privados de dos tipos guardados y descargados con bytes idénticos en la organización sintética; siete páginas afectadas verificadas en tres anchos. Sin cargos, pagos ni aprobaciones financieras de prueba en producción.
- Recorrido público de 62 rutas: 61 disponibles a 1440/768/390 px sin desbordamiento de página, una restringida por permisos y cero errores JavaScript. Menú por teclado y botón «Ver devoluciones» aprobados. Es una comprobación de renderizado y navegación; no implica ejecutar cada operación de cada módulo en producción.

La revisión contra la línea base no dejó P0/P1 confirmados pendientes dentro del alcance. Las pruebas descubrieron y corrigieron: bloqueo SQL incompatible con el rol runtime al asignar solicitudes; carrera entre pagos y versiones; edición mediante URL antigua después de Enviada; campos auxiliares de totales rechazados por la API; y generación indebida de un cargo al rechazar un borrador. Una línea asignada que se retire antes de entregar se identifica en ambas bandejas, conservando su evidencia. Las líneas entregadas no pueden borrarse o reducirse por debajo de lo recibido.

Las primeras ejecuciones de navegador también identificaron selectores de pruebas que aún usaban textos anteriores y una interacción automática antes de terminar la recuperación del formulario. Se actualizaron para esperar controles habilitados y verificar que el motivo de revisión permanezca escrito. Los reintentos excedieron el límite de acceso de la cuenta de QA; se reiniciaron sólo los contadores sintéticos de la base aislada, sin cambiar los límites ni la autenticación de producción.

## Confirmaciones del usuario

- 17/11: «Sí, crear ingreso en las tres modalidades». Sustituye la instrucción anterior que limitaba la creación automática a hospitalización. Aplica a nuevas aprobaciones; no se inventan ingresos históricos.
- 17/11: «Registrar la entrega a la enfermera, sin descontar existencias». No se crean movimientos de inventario ni conversiones de dosis.
- Enviada registra una comunicación manual. No envía WhatsApp ni correo al cliente.
- Se conserva una cotización lógica. Las versiones enviadas anteriores quedan inmutables como evidencia interna; una edición enviada reemplaza el saldo de la misma cuenta, conservando pagos.
- La primera entrega permitía Precotización en Borrador/Enviada. La confirmación posterior permite ampliar una Aprobada mediante un motivo y versión auditada; sigue cerrada para edición general y Rechazada no se puede ampliar. Un borrador no se convierte en cuenta por cobrar hasta marcarlo Enviada; no se inventa una entrega al cliente.
- Precio ausente: el usuario configura el catálogo. No se completa con cero por defecto.

## Línea base y alcance de evidencia

Preflight inicial correcto; 363 pruebas React/servidor iniciales pasaron. VPS respondió HTTP 200 y mantuvo el despliegue `eaa4fbc55a9a0389ff90e134b186c48f0c8a498b` al inicio. GitHub estaba en `b018f5b678d712b1ec160925b4707fd90b0220ad`, sin cambios remotos nuevos.

Revisión de video acotada: CH03/04/07 y CH14/15, con frames abiertos por agentes de auditoría de solo lectura. Se preservan los ledgers originales y los requisitos no cerrados. Este lote no afirma nueva paridad total ni promueve estados EXACT.

Se cumplió el orden: código y pruebas en GitHub, QA aislada con PostgreSQL y rol runtime, copia de seguridad, VPS y comprobación pública. Las migraciones 040/041 están aplicadas. Web y PostgreSQL saludables; HTTP 200. Se retiraron contenedores, red, imágenes, túneles y credenciales del entorno QA temporal. No se fusionó a main ni se ejecutó GitHub Actions.
