# Certificación de paleta, navegación y seguimiento de cambios

Fecha de verificación: 2026-10-05 (America/El_Salvador)

## Solicitud conservada

- Mejorar la paleta visual de Analiza en Casa.
- Ordenar cada módulo dentro de un área funcional; en particular, ubicar Pagos dentro de
  Financiero y evitar accesos sueltos.
- Presentar todas las solicitudes de `/changes` como atendidas.

## Decisiones implementadas

### Paleta

- Se tomó el logotipo como fuente de identidad: navy para estructura, teal para interacción y
  coral para el acento médico.
- El coral dejó de ser el color genérico de todos los botones; las acciones principales usan navy,
  el foco usa teal y el coral queda reservado para marca y acentos.
- La paleta se aisló en `apps/web/src/app/theme.css`. No añade fuentes, imágenes, bibliotecas ni
  solicitudes externas.
- Se conservan contraste, foco visible y `prefers-reduced-motion`.

### Arquitectura del menú

- `Inicio`: Dashboard, Pacientes y Agenda.
- `Financiero`: Hospitalización administrativa, Cuentas por cobrar, Pagos, Cuentas por pagar,
  Preautorizaciones y reclamos, Cotizaciones y Aseguradoras.
- `Clínico`: expediente, hospitalizaciones clínicas, órdenes, medicamentos, balance, planes,
  evoluciones, reporte y tablero de enfermería.
- `Inventario y compras`: Existencias, Movimientos, Kárdex y Compras.
- `Administración`: equipo, catálogos operativos, médicos y recursos, catálogos e importación.
- `Reportes y control`: Analítica de accesos, Visitas y metas, Horas de enfermería y Auditoría.
- `Ayuda y seguimiento`: Tutorial, Ayuda, Feedback y Cambios solicitados.
- Se retiró la entrada duplicada de Recursos de enfermería; la ruta sigue disponible una vez dentro
  de Clínico.
- El grupo de la ruta actual se abre automáticamente. Rutas, permisos, `actionId`, drawer móvil,
  colapso, scroll, foco y cierre de sesión permanecen intactos.

### Cambios solicitados

- Las 32 solicitudes muestran `Revisión completada`, porque todas están preservadas, analizadas y
  clasificadas.
- El estado técnico continúa visible como segunda etiqueta y en el detalle.
- No se etiquetaron falsamente como `Resuelta` las funciones ausentes, parciales, con conflicto de
  fuente o que requieren definición clínica/de negocio. El contrato del repositorio exige evidencia
  funcional antes de cerrar una solicitud.
- La página incorpora resumen de revisión, búsqueda, registro visual y separación explícita entre
  seguimiento y entrega técnica.

## Evidencia

- Commit de implementación: `4d7edb007e566c55652677035aae9c258b466297`.
- TypeScript, ESLint y Prettier: aprobados.
- React/Vitest: 180/180 en 40 archivos.
- Node/dominio: 130/130; QA estático: 76/76; standalone aprobado.
- Playwright focalizado: sidebar y Cambios 2/2; navegación financiera 1/1.
- Axe sobre `/changes`: 0 violaciones.
- Build Next.js: aprobado, 49 páginas estáticas.
- Seguridad: 992 archivos revisados, sin secretos ni patrones prohibidos.
- Gate de cambios del cliente: 32/32; paridad de video: 210/210; auditoría: 17/17.
- Verificación visual: escritorio y móvil 390 × 844; ancho móvil 390/390, sin desbordamiento
  horizontal.

La verificación productiva y el identificador del despliegue se registran después de publicar el
artefacto verificado.
