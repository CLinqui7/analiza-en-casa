# Correcciones pendientes del 18 de noviembre

Fuente: [correcionespend_.docx, texto literal](sources/CLIENT_PENDING18_2026-11-18.txt). SHA256 `4ebe2f36e633a538466a0e7235cda380937be1ee265a0f20bde70f3c634d52d0`. Original sin imágenes, preservado. El cliente confirmó: «que salga 0 y ellas tienen que colocarle en las tablas de insumos» y después «En el catálogo general de insumos.»

Estado: implementación y verificación en curso; todavía no publicado.

| ID | Requisito | Tratamiento |
|---|---|---|
| PEND18-01 | Responsable administrativo bloqueado | La versión publicada ya era de sólo lectura y el servidor conserva el creador. Se añade deshabilitado visual y texto explicativo; se prueba creación, recuperación de borrador, edición y revisión sin reemplazarlo. |
| PEND18-02 | Orden exacto de Clínico | Cotizaciones, Ingresos clínicos, Agenda, Expediente clínico, Órdenes médicas, Precotización y Solicitudes de insumos. Permisos por rol conservados. |
| PEND18-03 | Retirar precio por solicitud y añadir insumos una vez | Se retira el input. Precio de catálogo automático; cuando falta, cero autorizado y auditoría de precio pendiente. Una sola acción Añadir a cotización, motivo conservado, versiones inmutables, misma cuenta y pagos. Acceso al catálogo filtrado para completar el precio reutilizable. |

## Diagnóstico comprobado

La aplicación pública servía `9f8307d99ec4647d1ded9f1656c4fb9e5fddb016`. Web y PostgreSQL saludables; salud HTTP 200, disco 21%, aproximadamente 9.8 GB disponibles. La inspección autenticada de sólo lectura encontró cinco solicitudes pendientes y las cinco sin precio de venta. El diálogo público no tenía Actualizar cotizaciones ni Guardar ampliación; sí tenía una acción Añadir a cotización y el input de precio manual. No se puede atribuir con certeza el reclamo de los dos botones a una sesión/captura concreta.

La anterior solución exigía completar un precio por solicitud. Esa decisión no satisface el nuevo documento y queda sustituida por la confirmación explícita de cero. No se asumen precios de costo ni conversiones de moneda. Un precio de catálogo modificado después no reescribe cotizaciones ya emitidas; aplica a incorporaciones posteriores. Las ampliaciones anteriores conservan su importe y auditoría.

## Verificación

Preflight limpio y 382 pruebas unitarias/servidor aprobadas antes del cambio. Pruebas de integración aisladas con datos sintéticos; no se alteran solicitudes, cotizaciones ni pagos reales. Se mantienen CH01–CH03 y los estados históricos de video. Este lote no certifica una nueva revisión completa de los 17 capítulos.

Pendiente registrar resultados finales, SHA de verificación y publicación, respaldo y comprobación pública.

Verificación previa a QA conectado: 382 pruebas unitarias/servidor, TypeScript, ESLint, formato y compilación mock aprobados; 13 grupos PostgreSQL y 58 escenarios mock distintos aprobados tras repeticiones. Las tres pruebas Doctor de CH14 esperaban el antiguo destino de login; se actualizaron para entrar por Clínica y navegar explícitamente a la ruta restringida. La primera repetición usó dos rutas de modal inexistentes; se corrigieron a /inventory y pasaron las tres. No se modificaron permisos para hacerlas pasar. CH01–CH03, gate de cambios 32/32, seguridad, auditoría, 144 tests legacy y 76 QA aprobados. Fingerprints CR-011/CR-012 actualizados después de la regresión sin cambiar sus estados históricos.

Consulta agregada adicional: los cinco artículos pendientes no tienen importaciones con moneda vacía/no USD. Por tanto no están sujetos al bloqueo de conciliación que se mantiene para otras fuentes importadas sin moneda confirmada.
