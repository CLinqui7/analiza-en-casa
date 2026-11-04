# Revisión visual integral · 4 de noviembre de 2026

Solicitud fuente: `../qa/sources/CLIENT_VISUAL_REFRESH_2026-11-04.txt`.

## Cambios

- Tipografía Inter variable alojada en la aplicación, con licencia OFL y sin solicitudes de fuentes a terceros. Jerarquía consistente para títulos, etiquetas, texto y cifras.
- Marcos, fondos, sombras y radios comunes en cabeceras, paneles, tablas y diálogos. Se conserva la identidad azul/verde con acentos rojos.
- Botones con estados visibles, texto legible y tamaños estables. Ver devoluciones, Revisar cotización y otros accesos operativos se muestran como botones; conservan destinos y semántica de enlace.
- Formularios con campos alineados, grupos delimitados, pie de acciones y botones compactos al añadir registros. Ajustes específicos para Compras, Hospitalización, Encuestas y Cotizaciones.
- Menús de acciones con flechas, Inicio/Fin, Escape, cierre fuera del menú, recuperación del foco y apertura hacia arriba cuando falta espacio. Los selectores con búsqueda mantienen visible la opción activa y admiten opciones personalizadas con teclado.
- Selección de una sola opción activa en la barra lateral, menús de cuenta coherentes y acceso público con acción principal clara.
- Transiciones breves; se respeta la preferencia de movimiento reducido. La impresión conserva paginación y elimina las animaciones.

## Método y alcance

Se recorrieron todas las rutas estáticas del espacio de trabajo y los tres tipos de detalle con datos sintéticos. La primera pasada de 59 rutas capturó 57; Analítica y Visitas/metas requerían permisos o una respuesta del servidor. La revisión complementaria utiliza respuestas API sintéticas interceptadas, sin conexión a una base real. No se confunde esta inspección de UI con una prueba de persistencia PostgreSQL.

Se abrieron formularios, grupos de navegación, menús de cuenta y acciones, selectores, pestañas de inventario y las entradas médicas/de enfermería. Se inspeccionaron capturas en escritorio y móvil, y se midieron desbordamiento y recorte de botones. Las tablas extensas conservan desplazamiento local intencional; no se ocultan columnas para aparentar que caben.

La revisión complementaria terminó con 22 pantallas/estados a 1440, 768 y 390 px, sin desbordamiento de página ni del contenedor principal/diálogo, sin botones recortados y sin errores JavaScript. Incluye Analítica, Visitas/metas, perfil, altas de inventario, pagos, administración con tarjeta, QR y encuesta pública. Se corrigieron dos desbordamientos detectados: filtro comercial en tablet y bloque QR en móvil. Se pulieron también las preguntas y opciones de la encuesta pública; sus opciones se comprobaron en los tres tamaños.

El inventario local conserva las capturas de 57 rutas de la primera pasada y los 41 estados de formularios/pestañas revisados, más las pasadas complementarias de menús y datos conectados simulados. Se abrieron las hojas de contacto de escritorio y móvil y los detalles relevantes. Las primeras fallas de selectores o ausencia de datos sintéticos se cubrieron después con pacientes, lotes y tarjetas de prueba adecuados; no se cambiaron las restricciones del producto para habilitarlos. Las pantallas de catálogos históricos con acciones pendientes de definición conservan sus restricciones. Esta solicitud visual no habilita reglas de negocio ni integraciones ausentes.

## Regresión y revisión

- Base inicial y posterior: 332/332 pruebas React. TypeScript, ESLint y formato aprobados.
- `npm run check`: 144 pruebas base, 76 controles QA y compilación standalone aprobados.
- Seguridad y límites React aprobados. No se modifican API, contratos de datos, SQL, permisos ni secretos.
- Compilación Next de producción aprobada. Cierre enfocado de navegador: 25/25 (CH01, CH02, CH03 y controles visuales). La revisión complementaria se ejecutó sobre la compilación de producción con respuestas API sintéticas; la última comprobación de encuesta pública aplica la hoja de estilos final sobre esa compilación. No hubo escrituras de producción en estas revisiones.
- Navegador: suite completa de 244 escenarios, 240 aprobados, tres fallos resueltos y uno conectado omitido por configuración. Reejecución de los tres archivos afectados: 17/17 aprobados, incluidos los tres escenarios corregidos. En total, los 243 escenarios ejecutables del modo demo quedaron aprobados entre ambas ejecuciones. La suite completa de navegador detectó dos expectativas antiguas que contradecían `obserclini1_.pdf`: Registrar atención y el filtro redundante de hospitalizaciones. Se actualizan según la fuente aprobada, conservando pruebas del destino Órdenes médicas y del aislamiento de la hospitalización por paciente. También se corrigió un selector de la nueva prueba que omitía el asterisco de campo obligatorio.
- Revisión incremental desde `cecebf4` y de los archivos afectados contra `origin/main`: permisos y persistencia conservados; controles de teclado y foco cubiertos. No se declara una nueva certificación EXACT ni una revisión completa nueva de los 17 vídeos. La revisión de controles se limita a los eventos indicados debajo; los gates existentes se vuelven a ejecutar.

## Evidencia de vídeo conservada

Revisión independiente de controles: CH07-E0010 (00:14:49.600), CH07-E0018 (00:16:08.200), CH08-E0049 (00:17:51.800), CH08-E0056 (00:18:06.200), CH08-E0087 (00:19:52.000), CH10-E0009 (00:27:42.200), CH10-E0109 (00:30:13.200), CH17-E0005 (00:51:14.200) y CH17-E0048 (00:52:14.800). Las imágenes originales permanecen en `references/video-audit/chapters/`; no se modificaron. Se mantienen impresión, historial, corrección y acciones de cada módulo según permisos vigentes.

## Criterios de diseño

Se usaron como referencias la distinción entre acciones principales y secundarias de [GOV.UK](https://design-system.service.gov.uk/components/button/), los principios de [reflujo y operabilidad WCAG](https://www.w3.org/TR/WCAG22/) y la [preferencia de movimiento reducido](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html). Estas referencias no equivalen a una certificación WCAG integral. Fuente: [Inter](https://fonts.google.com/specimen/Inter), licencia incluida en `apps/web/public/fonts/`.

