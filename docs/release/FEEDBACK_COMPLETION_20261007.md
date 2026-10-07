# Cierre comprobable de Feedback · 7 de octubre de 2026

Este documento continúa la [auditoría individual de los 60 reportes](FEEDBACK_AUDIT_20261006.md). No sustituye el texto fuente de cada reporte. Estado inicial de este lote: 49 resueltos, 11 en revisión. No se cambió información clínica, existencias, compras ni precios registrados para cerrar reportes.

Durante el humo de producción apareció un reporte n.º 61 (`c6362e80`, 7 de octubre, Cotizaciones). Se abrió su imagen adjunta y se comprobaron cuatro anotaciones: quitar la hora de envío, agregar condición de pago, agregar monto en letras y retirar del pie la frase resaltada «de cobertura ni de validez». El primer despliegue de este lote no incluye esa solicitud sobrevenida; el segundo la publicará antes de cerrar su estado.

## Revisión de los once abiertos

| N.º | Dictamen técnico de este lote | Evidencia y límite |
| --- | --- | --- |
| 17 | Permanece en revisión | Las visitas/cobros tienen indicadores; «facturación» fiscal requiere fórmula, emisor y semántica aprobados. |
| 19 | Permanece en revisión | Existe PDF autenticado; adjuntarlo o avisar por WhatsApp necesita proveedor, consentimiento y enlace seguro. |
| 22 | Permanece en revisión | Pagos idempotentes y comprobante no fiscal existen; factura fiscal no se inventa. |
| 28 | Resuelto | Importación CSV/XLSX de pacientes con plantilla, vista previa, validación por fila/duplicado y campos administrativos, seguro, dirección y contactos. En modo conectado usa `addPatient` y declara las filas efectivamente persistidas; si hay fallo parcial no se reimportan las ya guardadas. |
| 29 | Resuelto | Los formularios de alta de pacientes y creación de cotización se recuperan al volver desde otra pantalla de la misma pestaña/cuenta. Borrador temporal en `sessionStorage`, con descarte explícito y limpieza al guardar o cerrar sesión; no es una firma ni un guardado en servidor. |
| 30 | Parcial; permanece en revisión | Nueva bandeja interna de solicitudes de medicamentos, insumos y equipos para enfermería; paciente, ítem del catálogo, cantidad, prioridad, nota logística, permisos, idempotencia y auditoría. No genera compra, salida de inventario ni WhatsApp/correo. Sólo la notificación externa queda pendiente. |
| 31 | Permanece en revisión | Cotización se guarda; conversión a factura fiscal sigue pendiente de definición tributaria. |
| 41 | Resuelto | Precio de venta visible y de sólo lectura en cotización. Honorarios usan el valor de la ficha médica. PostgreSQL y MongoDB rechazan líneas nuevas con precio distinto del catálogo activo; las líneas históricas conservan su precio al editar cantidad. |
| 45 | Permanece en revisión | Guardar y editar cotización funcionan; envío WhatsApp directo queda pendiente de integración segura. |
| 46 | Resuelto | Catálogo productivo consultado: 13 entradas activas de laboratorio, 3 de fisioterapia y 3 de imágenes, con precios registrados. Las categorías y selectores de cotización corresponden a esos registros. No se fabricaron servicios/precios; una comparación de completitud contra otra lista comercial exigiría recibirla. |
| 48 | Resuelto | Se inventariaron y filtraron los selectores de paciente, médico o DUI en alta, agenda, hospitalización, cotización, reportes, documentos clínicos y balance, conservando el elemento seleccionado. |

El reporte n.º 7 del documento anterior describe una lista manual de honorarios de 0 o 15–300. La solicitud posterior n.º 41 y la instrucción más reciente del cliente exigen usar el precio registrado en catálogo; por eso se eliminó la edición/selección manual en la cotización. No se modificó un honorario registrado fuera de ese rango ni una cotización enviada; cambiar precios existentes sin fuente autorizada sería inventarlos.

## Controles realizados

- Migración PostgreSQL `023_supply_requests.sql` aplicada tras comprobar que era la única pendiente, con RLS habilitado y forzado, permiso mínimo para el rol de aplicación y cero filas iniciales. No se desactivó RLS. Se eliminó el archivo temporal de conexión usado durante la migración.
- Preflight del repositorio sin advertencias; `npm run check` aprobó 133 pruebas Node, 76 controles QA y compilación standalone.
- `npm run qa:video-parity`: 210/210; `npm run qa:client-changes`: 32/32; `npm run audit:verify`: 17/17 capítulos. Los fingerprints funcionales afectados de `CR-001`, `CR-011`, `CR-012` y `CR-017` se actualizaron con el código y certificación.
- TypeScript, ESLint, Prettier, escaneo de secretos, límites React y compilación Next aprobaron. Vitest aprobó 188/188 pruebas en 42 archivos, incluidas las tres pruebas nuevas de precio.
- Playwright React aprobó la regresión final completa de 206/206 casos (8,6 minutos), incluidos los seis roles demo, portal, importación Excel, autoguardado, cotizaciones, navegación, filtros clínicos y solicitudes internas.
- El nuevo PDF usa sólo fecha en zona `America/El_Salvador`, condición de pago opcional escrita por el usuario, total USD en palabras y pie abreviado. El campo no calcula plazo, interés ni vencimiento, y las versiones enviadas no se editan. El render sintético de la página carta se inspeccionó visualmente sin cortes, texto superpuesto ni caracteres perdidos ([captura de QA](screenshots/quote-format-20261007-1.png)). Vitest aprobó 198/198 pruebas y la segunda regresión completa del navegador aprobó 206/206 tras estos cambios.
- `npm audit --omit=dev` sigue identificando dos avisos altos preexistentes en dependencias transitivas (`sharp` y `source-map-js`). La actualización requiere un lote de dependencias con regresión propia; no se mezcló con la corrección urgente de Feedback.

## Publicación y estado productivo

Los commits `d089d57` y `c8dc2b5` se subieron a `codex/feedback-regression-20260928` y al [PR 11](https://github.com/CLinqui7/analiza-en-casa/pull/11); no se fusionaron con `main`. El primer despliegue productivo fue `dpl_Dj14o2FTdMELxby3AbU86kT5GqGQ`. La corrección del nuevo formato PDF se publicó después como `dpl_8wdMp1F731BJVZ6wpENXG3XmfVhc`, estado `READY`, alias `https://analiza-en-casa-demo.vercel.app`.

El humo final con sesión WEBMASTER comprobó `/api/health` 200, importación visible en Pacientes, campo de condición de pago visible en Cotizaciones y bandeja de solicitudes visible. `/api/supply-requests` respondió 200 con 373 opciones de medicamento/insumo/equipo y cero pedidos; una solicitud de prueba con paciente inexistente devolvió 400 sin agregar filas. Una cotización sintética con precio alterado devolvió 400 con error de catálogo y el número de cotizaciones quedó igual. No se creó ningún pedido operativo ni cotización de prueba en producción.

Tras leer los 61 reportes vigentes, se resolvieron los números 28, 29, 41, 46, 48 y el nuevo 61 con respuesta específica y enlace al módulo. Se actualizó la respuesta del 7 para explicar que la lista manual de honorarios quedó sustituida por el precio registrado y la del 30 para distinguir la bandeja interna entregada del aviso externo pendiente. `/api/feedback` confirmó **55 `RESOLVED`, 6 `REVIEWING`, 0 `NEW`**. Los únicos abiertos son 17, 19, 22, 30, 31 y 45: definición fiscal o mensajería externa. No se alteró el texto fuente de los reportes ni se declararon resueltos estos seis.
