# Cambios clínicos del 7 de noviembre

Fuente: `analizaencasa7nov_.pdf`, SHA-256 `2068a972b61ceeeebc99b3f34e5862ecac83624ddfd0f9f872bdcc6ee0c06762`. Una página leída y revisada visualmente; texto original en `docs/qa/sources/CLIENT_CLINICAL_CHANGES_2026-11-07.txt`.

## Alcance y decisiones

1. Impresión del expediente: una o varias secciones, o todas. Los grupos completos se generan independientemente del filtro de pantalla. Se conservan paciente, hospitalización, historial/versiones, autor, JVPE y documentos anteriores. Los signos vitales no se duplican al imprimir todo.
2. Tarjeta: cada medicamento cotizado permite varias horas explícitas y dilución libre; Crónicos sigue al final. No se generan dosis, frecuencias ni diluciones. Las instrucciones históricas siguen visibles y las correcciones crean versiones.
3. Administración: cada medicamento/horario tiene su estado y motivo. El detalle general de hora real, dosis, presentación y vía permanece abajo. No aparecen campos de salida manual.
4. Decisión explícita del usuario en este chat: **Configurar origen y unidades por medicamento**. La pestaña Consumo de medicamentos en Diagnósticos y escalas permite guardar una regla por artículo de inventario y organización. Disponible para los roles que ya acceden a configuración clínica. La administración resuelve la referencia exacta del artículo y registra la configuración aplicada. Las reglas posteriores no reescriben consumos anteriores.
5. Si falta el vínculo del artículo en la cotización, origen o unidades, se indica qué completar; no se elige una bodega por suposición ni se consume una unidad arbitraria. Configurar consumo se abre aparte para conservar el formulario en curso. Los crónicos continúan fuera del inventario.
6. Cada horario registrado tiene identidad propia: reintentos y concurrencia no duplican salidas. Correcciones compensan únicamente la aplicación modificada. Lotes vigentes/liberados, FEFO, stock suficiente, auditoría y aislamiento por organización se mantienen.
7. Las revisiones de una misma línea de cotización conservan sus horarios, dilución y asignación histórica al corregir la tarjeta, siempre que sigan correspondiendo al mismo medicamento. El servidor reconoce esa identidad entre versiones y rechaza registrar otra vez el mismo horario y fecha. Una línea con otro artículo no hereda la pauta anterior.

La solicitud del 7 de noviembre sustituye únicamente los puntos de presentación de tarjeta e inventario del documento del 4 de noviembre. No cambia cotizaciones enviadas ni autoriza editar registros firmados silenciosamente.

## Evidencia y límites

Revisión acotada de evidencia inmutable, con subagentes de solo lectura: CH10-E0020 (00:27:59.800), CH10-E0042 (00:28:42.400), CH10-E0050 (00:29:08.800), CH17-E0008 (00:51:16.600), CH17-E0021 (00:51:34.400) y CH17-E0043 (00:52:08.400), cuadros y recortes correspondientes. Archivos bajo `references/video-audit/chapters/CH10_orden_medica_tratamientos_y_tarjeta_de_medicamentos/` y `CH17_reporte_de_salud_detallado_e_impresion/`. La evidencia apoya horarios y selección de impresión, pero no certifica nuevas reglas PRN ni el diseño final de todas las impresiones. Se mantienen estados y preguntas pendientes de paridad; no se declara EXACT ni una nueva revisión completa de los 17 capítulos.

## Verificación del lote

- Preflight aprobado. Base anterior: 356/356 pruebas unitarias/servidor y 18/18 escenarios clínicos de navegador.
- Implementación final `e1223d3f121d3718c9e08e1dfdd049f3dc4f4c34`: 363/363 pruebas unitarias/servidor; TypeScript, ESLint y compilación Next aprobados. `npm run check`: 144 pruebas base, 76 comprobaciones QA y standalone; análisis de secretos aprobado.
- Navegador: 18/18 escenarios clínicos y 60/60 de regresión ampliada, incluyendo impresión selectiva, horarios a 1440/390 px, seis roles y portal. El primer intento de las dos pruebas nuevas detectó una inicialización vacía de la cotización sintética en el test; se corrigió esa preparación y ambas pasaron.
- Integridad de evidencia 17/17, trazabilidad 210/210, solicitudes 32/32, espejo y gates CH01–CH03 aprobados. Estados de paridad conservados. Revisión equivalente de cambios contra la base y rutas afectadas: autorización, organización, versiones, compensación por horario y compatibilidad histórica comprobadas en código y pruebas conectadas; sin hallazgos P0/P1 pendientes del lote.
- `scripts/prepare-clinical-web-qa.mjs` exige SHA publicado en la rama actual, credenciales privadas fuera de Git, base `analiza_qa` y nombres exclusivos de contenedores QA. Construye y publica sólo en loopback; nunca reemplaza el contenedor de producción.
- PostgreSQL aislado final: **15/15 grupos aprobados**, con rol sin privilegios elevados y RLS activo. Incluyen consumo configurado, reintentos, concurrencia, FEFO, corrección por aplicación, aislamiento por organización y falta de existencias.
- Navegador conectado final: **8/8 escenarios aprobados** sobre la imagen construida desde ese SHA publicado, con PostgreSQL real aislado. Se guardaron/recargaron reglas con enfermería, horarios, diluciones, aplicaciones, versiones y descuentos; se comprobó impresión selectiva e individual y los siete menús de enfermería. La primera pasada detectó pérdida de horarios al revisar una cotización; la repetición confirma su conservación y el rechazo HTTP 400 del horario duplicado entre versiones. Los registros anteriores permanecen iguales.
- Regresión clínica final: **20/20** escenarios a 1440/390 px y permisos de los roles. Un intento local usó la configuración de servidor en lugar de demo: se corrigió el entorno, sin cambiar las expectativas. Un túnel QA caducó al reconstruir el contenedor; se restableció y se repitió íntegra la prueba PostgreSQL. No afectó producción.
- Guía del equipo: `GUIA_CLINICA_2026-11-07.md`. Impresiones sintéticas generadas y revisadas; capturas en `evidence/clinical-nov07/`.
- Revisión de las 15 páginas de la impresión sintética detectó margen inconsistente y animación de entrada capturada con menor contraste. Ajuste final exclusivamente de impresión: márgenes repetidos de 12 mm, animaciones desactivadas al imprimir y encabezados unidos a su contenido. Vista PDF con los registros QA existentes revisada de sólo lectura y los dos escenarios de impresión/móvil repetidos. No cambia persistencia ni cálculos.
- Publicación y prueba pública todavía pendientes en esta fase.
