# Protocolo forense de revisión del video · Analiza en Casa

## Objetivo

Evitar que una función visible o mencionada en el video quede fuera del producto por depender de una revisión manual rápida, una muestra cada 15 segundos o una sola transcripción automática.

La fuente de verdad es el archivo original:

- Duración: **00:54:30.960**
- Resolución: **1920 × 842**
- Frecuencia: **25 fps**
- Fotogramas nativos: **81,774**
- SHA-256: `7f559db533e0c09f6c6d01f740abd5bd2cc005b837fcceb39f3223998533c97d`

## Por qué no se entregan 81,774 imágenes sueltas

Convertir cada fotograma nativo en un archivo produciría una montaña de duplicados y saturaría la revisión humana y el contexto de Codex. El video original se conserva como evidencia exacta, mientras que la revisión utiliza cuatro niveles:

1. **Clips exactos por capítulo:** conservan video y audio, con un segundo de solape en cada borde.
2. **Safety frames:** una captura determinística por segundo, aunque el detector no encuentre cambios.
3. **Event frames:** la grabación se analiza cinco veces por segundo y se conserva cada cambio de interfaz relevante.
4. **Detail crops:** ampliaciones automáticas de menús, modales, tablas y zonas que cambiaron.

Las hojas de contacto permiten recorrer rápidamente el capítulo, pero los archivos individuales mantienen el texto a resolución suficiente.

## División funcional

El material se divide en 17 capítulos. Cada capítulo se analiza y aprueba antes de consolidarlo:

1. Contexto inicial, acceso, dashboard y pacientes.
2. Alta y edición de pacientes.
3. Hospitalización y preautorizaciones.
4. Cotización, datos generales.
5. Cotización, servicios, estudios y medicamentos.
6. Cotización, insumos, equipos, honorarios, extras y totales.
7. Seguro, preautorización y reclamo.
8. Perfil administrativo, cuentas por cobrar y pagos.
9. Hospitalización clínica y reporte de salud.
10. Orden médica, tratamientos y tarjeta de medicamentos.
11. Agenda y turnos.
12. Cuentas por pagar y pagos de servicios.
13. Compras.
14. Inventario, movimientos, acuses, cierres, bodegas y kits.
15. Acuse y catálogos maestros.
16. Descuentos.
17. Reporte de salud detallado e impresión.

## Regla de evidencia

Ningún requisito entra a la matriz maestra sin:

- ID de capítulo.
- ID de evento.
- Timestamp.
- Ruta de la imagen o recorte.
- Clasificación: visible, verbal, inferido o incierto.

Ninguna función se marca como implementada sin evidencia de código y una prueba reproducible.

## Flujo de trabajo obligatorio

### Etapa 1 · Auditoría del capítulo

Codex revisa las hojas de contacto, luego cada event frame y su detail crop. Después comprueba las hojas de safety frames. No modifica código.

### Etapa 2 · Inventario estructurado

Genera `chapter_feature_inventory.json`, `chapter_feature_inventory.md` y `chapter_open_questions.md`.

### Etapa 3 · Verificación de cobertura

Se ejecuta `scripts/verify_chapter_review.py` pasando el directorio inmutable del capítulo. El script lee el recibo y el
ledger desde `video-audit-reviews/<capítulo>/`; nunca escribe ni exige artefactos de revisión dentro de
`references/video-audit/`. También valida que cada función inventariada cite un evento y timestamp reales y una ruta de
evidencia existente. La auditoría falla cuando falta un evento, una observación completa, una hoja de contacto, un
recorte obligatorio o una referencia funcional trazable.

### Etapa 4 · Consolidación

Solo después de aprobar los 17 capítulos se genera `MASTER_VIDEO_REQUIREMENTS.json` y la matriz funcional maestra.

### Etapa 5 · Comparación con la plataforma

Cada requisito se compara contra rutas, componentes, API, tablas, migraciones y pruebas del producto. Estados permitidos:

- `IMPLEMENTED_EXACT`
- `IMPLEMENTED_PARTIAL`
- `MISSING`
- `CONFLICTS_WITH_VIDEO`
- `NOT_TESTABLE`
- `NEEDS_CLIENT_CONFIRMATION`

### Etapa 6 · Construcción

La implementación comienza únicamente con la matriz de brechas aprobada. Cada PR debe citar los IDs de requisitos y evidencia del video que resuelve.

## Límites y honestidad

- La transcripción automática es apoyo, no autoridad final.
- Un detector visual puede omitir un cambio extremadamente breve o minúsculo; el clip exacto permanece disponible para resolver dudas.
- Una acción visible no demuestra por sí sola la regla de negocio interna.
- Un botón de imprimir no revela el documento final cuando el video no muestra la salida.
- Los precios, coberturas, fórmulas médicas y reglas clínicas no se inventan.


## Verificación mecánica reforzada

El recibo de cada capítulo debe declarar expresamente que se leyeron `README.md`, `coverage.json`, `event_manifest.csv` y `transcript_raw.txt`; además debe confirmar que el clip exacto se consultó para resolver dudas. El verificador exige todos los IDs de eventos, todas las hojas de eventos, todas las hojas de seguridad y todos los recortes de detalle. Una sola omisión hace fallar el capítulo.
