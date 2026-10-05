# Certificación de navegación y enteros en cotizaciones

Fecha de verificación: 2026-10-05 (America/El_Salvador)

## Solicitudes conservadas

- Solicitud UX: rediseñar el menú lateral, sustituir los iconos repetidos, añadir movimiento ligero
  y conservar todas las rutas y funciones.
- Feedback productivo de Cotizaciones, 2026-10-02 10:46: solicitar números enteros en la
  cantidad de días/línea y en el porcentaje para evitar decimales accidentales. La imagen adjunta
  muestra una cantidad `3.01` en el constructor de cotizaciones.

No se copiaron componentes, marcas ni recursos de las referencias de Pinterest. Se usaron como
referencia visual para jerarquía, navegación oscura, tarjetas activas e iconos contenidos.

## Decisiones implementadas

### Menú lateral

- Cada destino dispone de un icono SVG propio incluido en el código; no se añadió una biblioteca,
  fuente, imagen remota ni solicitud de red.
- El destino activo usa una tarjeta clara y un acento coral; los grupos conservan su jerarquía,
  acordeón, ruta estable, permisos y estados `aria-expanded` / `aria-current`.
- Se conservaron el colapso de escritorio, el scroll restaurado, el drawer móvil, la trampa de
  foco, la cuenta y el cierre de sesión.
- Las transiciones duran 150–180 ms y usan principalmente `transform` y `opacity`. La animación se
  elimina con `prefers-reduced-motion`.
- El rediseño vive en `apps/web/src/app/sidebar.css`, cargado al final de la capa visual para evitar
  cambios colaterales en las pantallas.

### Cotizaciones

- Una línea nueva o editada acepta únicamente una cantidad entera mayor que cero.
- El descuento porcentual general y los porcentajes por categoría aceptan únicamente enteros entre
  0 y 100.
- El descuento monetario fijo, los precios y otros importes conservan centavos. Un porcentaje y un
  importe monetario no comparten la misma regla de precisión.
- La validación existe en el dominio además de los atributos HTML, por lo que no depende sólo del
  navegador.
- El contrato de lectura histórico no se endureció: cotizaciones antiguas con datos decimales pueden
  seguir cargándose; la regla se aplica al volver a calcular, editar o guardar.

## Evidencia de regresión

- Antes del cambio: `playwright:workspace-sidebar-accordions` 1/1, Vitest de dominio 24/24 y
  Playwright de Cotizaciones 7/7 en modo mock aislado.
- Después del cambio: `npm run check` 130/130 + QA 76/76 + standalone aprobado.
- Vitest de dominio: 25/25.
- Playwright combinado de Cotizaciones y Workspace: 39 pruebas no afectadas pasaron; los dos nuevos
  asserts se corrigieron y se volvieron a ejecutar de forma focalizada.
- `playwright:workspace-sidebar-accordions`: aprobado con más de 20 iconos semánticos distintos.
- `playwright:quote-integer-inputs`: aprobado; rechaza `3.01` y `5.5`, y conserva `1.25` como monto
  fijo válido.
- Playwright completo de Cotizaciones: 8/8; incluye permisos de auditor, estados inmutables y móvil
  sin desbordamiento horizontal.
- Suite React/Vitest completa: 180/180 en 40 archivos.
- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado.
- `npm run format:check`: aprobado.
- Build Next.js: aprobado, 49 páginas estáticas y todas las rutas dinámicas incluidas.
- Rendimiento productivo local: navegación caliente a Dashboard 115 ms frente al presupuesto de
  500 ms; 0 tareas largas mayores de 500 ms. El menú no añade dependencias ni solicitudes remotas.
- Gate de paridad de video: 210/210; contrato de cambios del cliente: 32/32.
- Verificación visual local: escritorio 1440 × 1000 y móvil 390 × 844, sin desbordamiento no
  intencional; drawer, encabezado, navegación y pie permanecen utilizables.

La verificación productiva, el identificador de despliegue y el cierre del reporte se completan sólo
después de publicar y repetir el flujo contra el entorno productivo.

Commit de implementación verificado: `192f8cd3edc65d76d73ceac9a2e660fbb125b49c`.
