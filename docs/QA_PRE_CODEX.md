# QA previo a Codex

## Resultado de la prueba

La prueba construye un baseline funcional completo con datos ficticios. El objetivo no es declarar un sistema clínico certificado, sino comprobar que la especificación entregada a Codex puede convertirse en una aplicación coherente sin perder los módulos vistos en el video.

## Cobertura funcional comprobada

- 17 capítulos representados.
- 7 categorías de cotización.
- Flujo de seguro con estados y eventos.
- Pago con control de referencia duplicada.
- Portal del paciente separado del expediente clínico.
- Documentos clínicos con borrador, firma, versión e impresión.
- Nota de enfermería bloqueada y compartida mediante enlace seguro.
- Turnos.
- Compras.
- Inventario comprometido y cierre en dos etapas.
- Kits.
- Descuentos por categoría.
- Estados de cuenta médicos.
- Auditoría.
- Adaptador Supabase.
- Vercel Functions.

## Qué encontró la QA

1. El flujo de cotización necesitaba ramas válidas desde revisión a aprobación total o parcial. Se corrigió.
2. El control de roles no podía permitir escritura a un auditor únicamente porque tuviera lectura. Se corrigió.
3. El exportador CSV necesitaba inferir columnas cuando no se entregaba una configuración. Se corrigió.
4. El inventario distingue stock bajo y stock sin disponibilidad.
5. Se mantuvieron brechas abiertas para formatos impresos, precios, seguros, honorarios y proveedores reales.
6. La app necesita una prueba UAT con usuarios del negocio antes de cargar datos reales.

## Criterio para continuar con Codex

Codex puede comenzar a partir de este repositorio, pero cada tarea debe:

- Referenciar una brecha o requisito concreto.
- No cambiar reglas clínicas o financieras sin aprobación.
- Mantener pruebas.
- Preservar RLS y auditoría.
- No introducir datos reales.
- Producir un diff revisable.

## QA de navegador adicional

Después de la primera revisión se ejecutaron 33 rutas, un flujo end-to-end, validaciones de permisos y vistas móviles. Durante esa prueba se encontraron y corrigieron:

- Etiquetas de estado que podían mostrarse como `[object Object]`.
- Un conflicto de `z-index` que hacía que el fondo del modal interceptara clics.
- La compresión del listado de próximos turnos.
- Contraste insuficiente en el resumen financiero de la cotización.
- Ancho heredado de una maqueta anterior en el portal del paciente.
- Avisos genéricos duplicados al guardar.
- Falta de bloqueo para rutas directas sin permiso.

Resultado final:

- 9/9 pruebas de dominio.
- 75/75 controles estáticos.
- 33/33 rutas.
- 6/6 casos de acceso por rol.
- Flujo crítico integral aprobado.
- Cero errores de consola y de página.
