# Certificación de acciones visibles como botones

Fecha de verificación: 2026-10-05 (America/El_Salvador)

## Solicitud conservada

Revisar todas las pantallas para que acciones como `Consultar` no aparezcan como palabras
subrayadas o enlaces ambiguos, sino como botones visibles que funcionen al presionarlos.

## Criterio aplicado

- Las acciones de tarea (`Consultar`, `Abrir`, `Ver`, `Gestionar`, `Editar`, `Descargar`,
  `Administrar`, `Volver` e `Ir al`) usan un tratamiento compartido de botón.
- La navegación semántica que ya tiene otro patrón reconocible —menú lateral, pestañas, accesos
  rápidos, menús contextuales y enlaces de correo— conserva su función y apariencia específica.
- El patrón compartido tiene borde, radio de 9–10 px, alto mínimo de 32–36 px, foco visible,
  estado hover, contraste con la paleta Analiza y `text-decoration: none`.
- El movimiento es ligero y se desactiva con `prefers-reduced-motion`.
- No se añadieron iconos, fuentes, imágenes, paquetes ni solicitudes externas.

## Alcance implementado

- Cotizaciones: `Consultar` en el listado y el historial de versiones, y retorno al listado.
- Dashboard: acciones de encabezados, casos, inventario, agenda, auditoría y mediciones.
- Pacientes: nombre factual separado de la acción; `Consultar` es un control explícito. `Editar
  paciente` dejó de anidar un botón dentro de un enlace.
- Hospitalizaciones: `Gestionar`, `Consultar`, accesos a cotizaciones, pacientes inactivos,
  clínica, seguros y descargas privadas.
- Seguros: apertura y consulta de cotizaciones.
- Catálogos, compras, médicos, equipo de enfermería, onboarding, ayuda y tutorial: accesos y
  descargas con el patrón de botón.
- Reporte clínico: `Abrir caso` usa un control bordeado sin alterar el menú clínico ni su estado de
  paridad.
- Sidebar: el grupo activo se deriva durante renderizado en lugar de ejecutar una actualización de
  estado síncrona dentro de un efecto; se preserva el colapso manual.

## Evidencia local

- Commit funcional: `caba8464ae769b8dcef331dea15b6c6d2ae42cf2`.
- Prueba estática del contrato visual y del control interactivo válido: 3/3.
- Playwright focalizado: 2/2. Recorre todas las rutas liberadas visibles en el sidebar y tres rutas
  dinámicas; no encontró acciones verbales visibles sin borde, radio, área táctil o sin eliminación
  de subrayado.
- La acción `Consultar` abre el detalle real de una cotización.
- Node/dominio: 133/133; React/Vitest: 180/180; QA estático: 76/76.
- TypeScript, ESLint y Prettier: aprobados.
- Build Next.js: aprobado, 49 páginas generadas; standalone aprobado.
- Seguridad: 995 archivos revisados, sin secretos ni patrones prohibidos.
- Paridad de video: 210/210; auditoría de capítulos: 17/17.

## Producción

Pendiente de completar después de desplegar el commit funcional y repetir el smoke autenticado en
`https://analiza-en-casa-demo.vercel.app`.
