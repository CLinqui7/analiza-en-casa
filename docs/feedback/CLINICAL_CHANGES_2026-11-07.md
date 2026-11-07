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
- Implementación local: 363/363 pruebas unitarias/servidor; TypeScript y ESLint aprobados tras reforzar la identidad entre versiones de cotización. Compilación Next y `npm run check` previos al refuerzo aprobados: 144 pruebas base, 76 comprobaciones QA y standalone.
- Navegador: 18/18 escenarios clínicos y 60/60 de regresión ampliada, incluyendo impresión selectiva, horarios a 1440/390 px, seis roles y portal. El primer intento de las dos pruebas nuevas detectó una inicialización vacía de la cotización sintética en el test; se corrigió esa preparación y ambas pasaron.
- Integridad de evidencia 17/17, trazabilidad 210/210, solicitudes 32/32, espejo y gates CH01–CH03 aprobados. Estados de paridad conservados. Revisión equivalente de cambios contra la base y rutas afectadas: autorización, organización, versiones, compensación por horario y compatibilidad histórica comprobadas a nivel código; validación conectada todavía pendiente.
- `scripts/prepare-clinical-web-qa.mjs` exige SHA publicado en la rama actual, credenciales privadas fuera de Git, base `analiza_qa` y nombres exclusivos de contenedores QA. Construye y publica sólo en loopback; nunca reemplaza el contenedor de producción.
- PostgreSQL aislado: 15 grupos aprobados antes del refuerzo de versiones. Navegador conectado: siete escenarios aprobaron y el octavo detectó que al corregir una tarjeta tras revisar su cotización se perdían los horarios precargados. Se corrigió y se agregó una comprobación de aplicación duplicada entre versiones. Repetición conectada y publicación pendientes. Este informe no certifica todavía el despliegue.
