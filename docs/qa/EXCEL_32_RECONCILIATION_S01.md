# Reconciliación local S01 — 32 solicitudes del Excel

Fecha de revisión: 2026-09-09. Alcance: contraste estático del checkout actual con
`inputs/auditoria/EXCEL_ORIGINAL.xlsx`, sus 25 imágenes extraídas y
`docs/qa/CLIENT_CHANGE_REQUESTS.json`. No es una certificación de producción, de
MongoDB Atlas, de persistencia compartida ni de permisos del servidor.

## Evidencia revisada

- Excel original: `C:\Temp\analiza-jornada-control\inputs\auditoria\EXCEL_ORIGINAL.xlsx`
  (SHA-256 `4227d5623fdf17b8675ac892e07b1a96474c472243022958e031ea8fcc1d15d0`).
  Se confirmó directamente `A1:J35`, 35 filas y 25 medios `xl/media/image*.png`.
- Inventario del lote: `C:\Temp\analiza-jornada-control\inputs\auditoria\excel_32_requisitos.json`
  (SHA-256 actual `bb5f0d304316d7f43f398ed1fd589d242323fa0f5ddf23e44f7ad4b443826f40`).
- Registro vigente: `docs/qa/CLIENT_CHANGE_REQUESTS.json` (SHA-256 actual
  `9558cf68364fc4be7967dc7dd9987138aaaa33dc3f7375a8711a8c723356face`).
- Las 25 imágenes originales bajo
  `C:\Temp\analiza-jornada-control\inputs\auditoria\excel_imagenes\` se abrieron
  una a una en orden numérico. No se editaron, recortaron ni reescalaron.

Convenciones: **UI** describe únicamente la superficie localizada estáticamente en
este checkout; **persistencia** describe el código encontrado, no una prueba de dos
sesiones; **permiso** distingue una guarda de interfaz de autorización de servidor;
**prueba** reproduce los IDs declarados por el registro y dice si fueron ejecutados
en este lote. Ningún ID de prueba fue ejecutado: esta entrega no cambia código y el
navegador de este sandbox no está certificado.

## Resultado por requisito

| ID | UI actual localizada | Persistencia / permiso localizado | Prueba declarada (no ejecutada) | Falta concreta y subfunción programable |
|---|---|---|---|---|
| CR-001 | **Sí, estática**: tipo `DUI` y número en `patients/page.tsx`; contrato lo incluye. `image1.png` muestra la intención de la plantilla. | `useWorkspace`; modo mock usa `localStorage`. Alta/exportación bajo `can('patients:write')`; autorización servidor y lectura por otra sesión no verificadas. | `vitest:ch02-patient-form`, `SEL-PAT-DOCUMENT`. | Implementar/ensayar adaptador HTTP/Mongo con ámbito de organización y duplicado por tenant; conservar validación de formulario. |
| CR-002 | **Sí, estática**: opción `RESIDENT_CARD`, importación CSV y contrato; `image2.png` sólo muestra el selector histórico sin esta opción. | Igual CR-001; no hay prueba de metadato compartido ni de exportación/importación remota. Guarda UI `patients:write`. | `vitest:cr002-resident-card`. | Adaptar el enum al DTO/ETL y probar crear, recargar, importar y exportar sin degradar a `OTHER`. |
| CR-003 | **Parcial**: CSV/XLSX exportan `visiblePatients`; `image3.png` evidencia controles de importar/exportar. | Archivo local generado desde filtro/pestaña/paginación visibles; no hay consulta de todos los pacientes autorizados. Controles dentro de `patients:write`. | `playwright:ch01-xlsx-export`, `SEL-PAT-EXPORT`. | Confirmar orden y alcance (todos vs. vista filtrada) y crear exportación paginada/servidor con conteos. |
| CR-004 | **Sí, estática**: contactos tienen tipo y número de documento; `image7.png` expone la sección Responsable original. | Contactos se incluyen en payload del paciente; mock local o upsert no certificado. Guarda UI `patients:write`. | `SEL-PAT-CONTACTS`. | Persistir y leer el par tipo/número en DTO multiusuario; probar validación y autorización. |
| CR-005 | **Parcial**: médico y recurso están en rutas/altas separadas (`doctors`, `clinical/nursing`); el enlace a recurso es visible. | Recurso se agrega al workspace; médico queda anunciado como demo y la escritura Supabase de médicos lanza error. Guardas `settings:write`/`nursing:write` son sólo UI. | `playwright:cr005-independent-doctor-resource`, `SEL-DOCTOR-LIFECYCLE`. | Crear modelos/endpoints independientes y pruebas de que una alta no crea/modifica la otra. |
| CR-006 | **Parcial**: formulario médico tiene JVPM, DUI, dirección, edición y selector de archivo; adjuntos son metadatos. | `SupabaseDataProvider.saveChanges` rechaza médicos; no hay bytes privados ni descarga autorizada. UI de edición depende de `settings:write` y modo no mock. | `vitest:cr006-doctor-attachment-metadata`, `playwright:cr006-doctor-save-reload-edit`, `SEL-DOCTOR-LIFECYCLE`. | Implementar metadatos/bytes privados separados, autorización de descarga y edición versionada en servidor. |
| CR-007 | **Parcial**: `doctorSpecialtyOptions` alimenta especialidad; `image4.png` muestra el campo original de profesional. | Catálogo queda en cliente/demo; no hay CRUD compartido ni versionado de opciones. Permiso de alta sólo UI. | `vitest:cr007-professional-specialties`, `playwright:cr007-professional-specialties`, `SEL-DOCTOR-LIFECYCLE`. | Contrastar las ocho etiquetas del Excel, modelar catálogo institucional y probar selección/persistencia. |
| CR-008 | **UI bloqueada de forma explícita**: hospitalización muestra aviso de archivos privados bloqueados. `image5.png` muestra la plantilla fuente. | No se almacenan bytes ni se ofrecen descargas; `cases:write` no sustituye autorización por archivo. | `SEL-HOSP-CREATE`. | Implementar pipeline de adjunto privado (tipo/tamaño, metadatos, auditoría, lectura/denegación). |
| CR-009 | **Sí, estática**: ingreso/egreso y períodos adicionales, con validación de repetidos/orden; `image6.png` e `image11.png` son formularios fuente aún con “Fecha de inicio”. | Snapshot puede contener `admissionPeriods`; actualizaciones son mock o upsert histórico. Guarda UI `cases:write`, sin conflicto/versionado servidor probado. | `vitest:ch03-hospitalization-filters`, `playwright:cr009-admission-periods`, `SEL-HOSP-CREATE`, `SEL-B3-HOSPITALIZATION-PERIODS`. | Mantener normalizador y definir semántica de múltiples períodos; luego guardar atómicamente y probar recarga. |
| CR-010 | **No funcional**: “Puntual” está deshabilitado; `image8.png` sólo muestra navegación y no define una entidad. | No modelo/persistencia/permiso de acción. | Ninguna. | Reutilizar sólo el esqueleto de formulario de hospitalización tras decidir entidad, relación, duración y estados. |
| CR-011 | **Sí, estática**: tabs/categorías de cotización y categoría por línea; `image9.png` muestra el constructor fuente sin probar todo el catálogo. | Borrador se agrega a workspace; datos de catálogo de demostración y sin comprobación compartida. Crear bajo `quotes:write` en UI. | `SEL-QUOTE-ITEMS`. | Probar todas las categorías solicitadas y mapear catálogo autorizado; el bloqueo de honorarios no bloquea clasificación. |
| CR-012 | **Parcial**: búsqueda de paciente toma `patients` del workspace; `image10.png` muestra la lista de hospitalizaciones/pacientes fuente. | No refetch multiusuario; mock local y carga actual no prueban que otra sesión vea el alta. Permiso de crear cotización es UI `quotes:write`. | `SEL-QUOTE-CREATE`. | Endpoint de búsqueda con organización, refetch tras alta y prueba Cuenta A/Cuenta B. |
| CR-013 | **Parcial (contradice “MISSING”)**: tab FEES ofrece médico y “Honorario médico (manual)”; el detalle muestra médico. `image11.png` no acredita cálculo. | Se guarda como línea del borrador; no hay regla de liquidación/catálogo ni backend compartido probado. | Ninguna. | Separar valor manual de honorario aprobado, definir trazabilidad/moneda y añadir prueba de guardado/revisión. |
| CR-014 | **Parcial de base, no de solicitud completa**: dashboard cuenta activos, pero no facturación mensual ni gráficas. | Sólo datos del workspace sintético. No regla de mes, facturación o permisos de reporte de servidor. | Ninguna. | Confirmar fuente, período y definición de activo/inactivo; implementar consulta mensual y visualización. |
| CR-015 | **No**: no se localizaron visitas mensuales ni meta/cumplimiento; `image12.png` es turno individual, no métrica. | Sin modelo/fórmula/autorización de reporte. | Ninguna. | Definir visita válida, meta, zona/rol/período; preparar DTO y consulta sin inventar fórmula. |
| CR-016 | **Parcial (contradice “MISSING”)**: dashboard ya calcula y muestra particulares/asegurados desde `insurance.insurer`; no hay gráfica solicitada. | Conteo de snapshot sintético; no consulta mensual ni autorización de reporte comprobada. | Ninguna. | Acordar clasificación y período; extraer métrica servidor por organización y prueba de conteos. |
| CR-017 | **Sí, estática**: selector de múltiples fechas y `buildShiftSeries`, con prevención local de duplicados/colisiones; `image12.png` muestra el turno original. | Series se agregan una a una al workspace; sin transacción/idempotencia multiusuario comprobada. Guarda UI `agenda:write`. | `vitest:cr017-multi-day-shifts`, `playwright:cr017-multi-day-shifts`, `SEL-B3-AGENDA-SERIES`. | Endpoint transaccional con clave de idempotencia y prueba de colisión entre sesiones. |
| CR-018 | **Parcial**: botones 6 h/8 h están implementados; Puntual está deshabilitado. `image13.png` evidencia tipos históricos distintos. | Igual CR-017 para 6 h/8 h; no hay entidad Puntual. | `vitest:cr018-shift-presets`, `playwright:cr018-shift-presets`, `SEL-B3-AGENDA-SERIES`. | Probar duración/serie de presets y desbloquear Puntual sólo tras definición CR-010. |
| CR-019 | **No para la petición**: tarjeta de medicamento tiene campos existentes pero no se localizó campo Observaciones; `image14.png` lo confirma. | Sin modelo ni flujo para dilución/cuidados; no inferir contenido clínico. | Ninguna. | Tras política clínica: campo con alcance (ítem/general), rol, bloqueo por firma, corrección auditada y prueba. |
| CR-020 | **No**: no hay pantalla/formulario Balance hídrico; `image15.png` contiene la planilla 24 h. | Sin entradas, continuidad por turno, auditoría ni cálculo. | Ninguna. | Confirmar si la “edición” es corrección auditada o append-only; modelar entradas por turno, cierre y visibilidad. |
| CR-021 | **No**: no se localizó EVA; `image16.png` contiene escala y bandas fuente. | Sin selección única/versionado/permiso. | Ninguna. | Confirmar versión institucional y codificar selección única sin cambiar bandas/escala fuente. |
| CR-022 | **No**: no se localizó formulario Glasgow/GASGLOW; `image17.png` dice “GASGLOW” y muestra tabla. | Sin suma/versionado/permiso. | Ninguna. | Confirmar nombre y tabla institucional; resolver la fila verbal de 1 punto antes de calcular. |
| CR-023 | **No**: no se localizó Ramsay; `image18.png` contiene seis opciones. | Sin selección/versionado/permiso. | Ninguna. | Modelar únicamente tras aprobación clínica, con una selección y evidencia de versión. |
| CR-024 | **No**: no se localizó ECOG/Ecof; `image19.png` está titulada ECOG. | Sin selección/versionado/permiso. | Ninguna. | Confirmar nombre “ECOG” frente a “Ecof”, versión y roles antes de construir. |
| CR-025 | **No**: no se localizó ESAS; `image20.png` muestra ESAS-r con múltiples dominios 0–10. | Sin dominios/versionado/permiso. | Ninguna. | Confirmar dominios/instrucciones institucionales y modelar una selección por dominio. |
| CR-026 | **No**: no se localizó Karnofsky; `image21.png` contiene la tabla porcentual. | Sin selección/versionado/permiso. | Ninguna. | Resolver grafía Karnofsky/karnofky y versión antes de codificar. |
| CR-027 | **No**: no se localizó Downton; `image22.png` dice “ESCALA DE DOWNTON”. | Sin opciones, cálculo ni permiso. | Ninguna. | Confirmar versión/umbral y modelar una respuesta por dominio, no un score inventado. |
| CR-028 | **No; conflicto real**: el texto repite Dowton, mientras `image24.png` presenta dominios de Norton. | Sin flujo. | Ninguna. | Cliente debe identificar escala/versión; se puede preparar contenedor versionado, no respuestas ni cálculo. |
| CR-029 | **No; conflicto real**: celda de nombre vacía, `image25.png` titulada Índice Barthel. | Sin flujo. | Ninguna. | Cliente debe confirmar que Barthel corresponde a esta fila y versión; luego modelar dominios. |
| CR-030 | **No; conflicto de grafía**: texto “Branden”, `image23.png` título Braden. | Sin selección/versionado/permiso. | Ninguna. | Confirmar nombre/versión Braden antes de modelar la matriz de seis dominios. |
| CR-031 | **No como función multisesión**: UI de pacientes existe, pero no prueba colaboración. | `MockDataProvider` guarda en `localStorage`; el provider histórico Supabase carga pacientes pero no certifica RLS en esta revisión. No hay adaptador Mongo/HTTP. | `SEL-PAT-CREATE`. | Construir gates A→B misma organización y C aislada, con servidor que derive tenant/rol de sesión. |
| CR-032 | **Parcial no equivalente**: importación CSV de hasta 500 filas con previsualización; no hay importador de base existente. | Importa al workspace; no hay dry-run, conciliación, rollback ni fuente autorizada. Botón bajo `patients:write`. | Ninguna. | Acordar fuente sintética/contrato de columnas y crear ETL idempotente con dry-run y reporte de errores. |

## Lectura de las 25 imágenes (sin modificación de escala)

| Archivo | Observación de evidencia fuente |
|---|---|
| `image1.png` | Nuevo paciente con DUI seleccionado y número de documento. |
| `image2.png` | Desplegable histórico DUI/Pasaporte/NIT; no prueba Carnet de residente. |
| `image3.png` | Cabecera Pacientes con Importar CSV y Exportar. |
| `image4.png` | Nuevo profesional con campo Especialidad y tipo de tarifa. |
| `image5.png` | Nueva hospitalización con fecha de inicio y campos administrativos. |
| `image6.png` | Recorte de la misma plantilla de hospitalización; conserva “Fecha de inicio”. |
| `image7.png` | Sección Responsable con nombre/teléfono, sin documento visible. |
| `image8.png` | Navegación lateral de módulos; no define una entidad Puntual. |
| `image9.png` | Nueva cotización con resumen y alta de concepto. |
| `image10.png` | Selector de hospitalización/paciente con lista de opciones. |
| `image11.png` | Plantilla de hospitalización repetida, sin períodos múltiples visibles. |
| `image12.png` | Programar turno de una fecha con horas 06:00–18:00. |
| `image13.png` | Selector histórico de tipo de servicio; no incluye presets 6 h/8 h/Puntual. |
| `image14.png` | Tarjeta de medicamentos sin campo Observaciones. |
| `image15.png` | Planilla Balance hídrico con ingresos/egresos por franjas. |
| `image16.png` | EVA/EVS con bandas de dolor. |
| `image17.png` | Tabla titulada “ESCALA DE GASGLOW”; hay ambigüedad clínica a resolver. |
| `image18.png` | Escala Ramsay, seis niveles. |
| `image19.png` | Tabla de ECOG, grados 0–4. |
| `image20.png` | ESAS-r de múltiples dominios con rango 0–10. |
| `image21.png` | Tabla Karnofky/Karnofsky con porcentajes. |
| `image22.png` | Escala de Downton para riesgo de caída. |
| `image23.png` | Escala de Braden, seis dominios. |
| `image24.png` | Matriz distinta compatible con Norton, pese a la fila “Dowton”. |
| `image25.png` | Imagen titulada Índice Barthel, aunque su celda fuente no tiene nombre. |

## Contradicciones y decisiones que no se deben inferir

1. CR-013 está marcado `MISSING`, pero el checkout actual tiene UI de médico y honorario
   manual. Es una **UI parcial**, no evidencia de regla financiera ni de liquidación.
2. CR-016 está marcado `MISSING`, pero el dashboard actual muestra conteos de particulares
   y asegurados. Falta la dimensión mensual/gráfica y una fuente autorizada; no debe
   reetiquetarse como terminado.
3. CR-010/CR-018: el Excel pide Puntual y una plantilla semejante a hospitalización; no
   define entidad, duración, estados ni vínculo. El botón deshabilitado no satisface la petición.
4. CR-020 pide continuidad entre enfermeras; el registro la interpreta como append-only.
   Editar silenciosamente o imponer append-only requiere confirmación clínica.
5. CR-022, CR-024, CR-026–CR-030 tienen diferencias entre celda, ortografía o imagen.
   Las imágenes son evidencia de referencia, no autorización para corregir sus escalas ni
   para elegir cálculo clínico sin aprobación institucional.
6. CR-031 y CR-032 provienen de filas sin descripción operativa; siguen siendo requisitos,
   no comentarios eliminables. El importador CSV actual no equivale a migración de base.

## Conclusión operativa

El registro vigente conserva los 32 IDs y la fuente Excel, pero no basta para cerrar el
lote: hay 10 superficies de UI presentes/parciales, 11 solicitudes clínicas ausentes o
con conflicto y ninguna evidencia de persistencia compartida Mongo. El siguiente cambio
implementable sin una decisión clínica es CR-031: introducir el adaptador HTTP/Mongo
servidor y pruebas aisladas de aislamiento por organización, sin fallback de producción a
`localStorage`. CR-003, CR-004, CR-006, CR-008, CR-009, CR-012, CR-017 y CR-032 tienen
subfunciones técnicas preparables, pero requieren el contrato de datos/infraestructura
correspondiente para certificación final.
