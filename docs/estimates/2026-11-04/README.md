# Estimación del alcance ya implementado

Solicitud: comparar `analizaencasaflujonuevo_.pdf` con lo ya realizado, no implementar sus pendientes y preparar un HTML para explicar el esfuerzo manual equivalente al conversar el cobro.

- **Informe:** `analiza-informe-esfuerzo.html`, autónomo, con tipografía y licencia incorporadas, sin CDN ni solicitudes externas al abrir. Los enlaces de evidencia llevan a GitHub y pueden requerir acceso al repositorio.
- **Datos:** `alcance-y-estimacion.json`, con 18 partidas, páginas, extractos, límites, archivos y commits. La tarifa no está definida.
- **CSV:** `analiza-estimacion-manual.csv`; el HTML también permite descargarlo con la jornada seleccionada.
- **Resultado:** 210–346 horas estimadas; centro aritmético 278 horas = 34,75 jornadas de 8 horas, aproximadamente 35 jornadas. No son horas reales registradas ni una factura.

Fuente: PDF de 26 páginas, SHA-256 `c987c5dc49456de9854126714e179d9b636f14364525394705c0c97c521b4e1f`. Se extrajo su texto y se abrieron nueve hojas de contacto con las 26 páginas, incluidos anexos. El archivo original se conserva fuera de Git.

Corte del código y documentos consultados: `cecebf411ec786e0bbaa1604dd6dc43613aab42f`. Publicación previamente documentada: `cfc7ceb1fcc53f0e2b9cd7ac260f12f51e2bb967`. Las fechas de los hitos se verificaron con el historial de Git; no se infirieron horas a partir del intervalo entre commits.

Se contrastaron las partes 1 y clínica con las implementaciones del 26 y 29 de octubre, la reestructuración clínica del 3 de noviembre, las observaciones clínicas y la revisión de facturación del 4 de noviembre. Las solicitudes nuevas de dependientes, precotización, pedidos recibidos, circuito de compras, reorganización de inventario y reportes quedan fuera de la suma. Las bases existentes y requisitos repetidos no se cobran otra vez. Las diferencias de aprobación, número de reserva, factura aprobada y versiones inmutables conservan las aclaraciones posteriores del cliente y se explican en cada partida.

La estimación supone una persona experimentada que adapta el sistema existente manualmente. Cada partida incluye comprensión, adaptación y comprobación local. La última añade sólo integración, regresión y publicación compartidas. No incluye construir la plataforma original, migración del VPS, este informe ni el rediseño visual en curso. No se afirma aceptación formal, validación clínica profesional ni cumplimiento fiscal.

Verificación del artefacto: navegador Chromium a 1440, 1024, 768, 390 y 320 px, sin desbordamiento de página ni errores JavaScript; fuente cargada localmente; cero solicitudes HTTP al abrir; filtros, búsqueda, desplegables, conversión de jornadas y exportación CSV comprobados; totales contrastados con las 18 partidas. Se generó una impresión A4 de 10 páginas y se inspeccionó su composición. Las animaciones respetan movimiento reducido. El PDF impreso es una comprobación local, no un entregable adicional.

Este lote documental no modifica funciones de la aplicación ni implementa los pendientes del PDF. Los cambios visuales autorizados antes se mantienen como lote independiente.
