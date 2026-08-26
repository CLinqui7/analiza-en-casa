# Inventario funcional · CH02

Se revisaron 82 event frames, 48 detail crops, 10 hojas de eventos, 11 hojas de seguridad, README, cobertura, manifiestos CSV/JSON, transcripciones TXT/SRT y el clip exacto. El ASR tiene pasajes ruidosos; los campos y asteriscos se documentan desde evidencia visual.

| ID | Clasificación | Función | Evidencia principal | Observación / regla |
|---|---|---|---|---|
| CH02-F001 | VISIBLE | Ruta autenticada hasta Pacientes | CH02-E0005 · 00:02:05.200 · `event_frames/CH02-E0005_00h02m05s200ms_abrupt_change.jpg` | Login, dashboard y Pacientes; no prueba política de sesión. |
| CH02-F002 | VISIBLE | Listado con vistas y acciones | CH02-E0008 · 00:02:07.000 · `event_frames/CH02-E0008_00h02m07s000ms_stable_change.jpg` | Activos, Inactivos, Carga masiva, Excel, + Nuevo, búsqueda, tabla y paginación. |
| CH02-F003 | VISIBLE | Formulario por secciones | CH02-E0009 · 00:02:17.000 · `event_frames/CH02-E0009_00h02m17s000ms_abrupt_change.jpg` | Paciente nuevo; no se abre un registro existente para probar edición. |
| CH02-F004 | VISIBLE | Datos personales y obligatoriedad | CH02-E0011 · 00:02:17.800 · `event_frames/CH02-E0011_00h02m17s800ms_abrupt_change.jpg` | Se respetan solo los asteriscos visibles; no se infiere validación de servidor. |
| CH02-F005 | VISIBLE | Documento y fecha | CH02-E0012 · 00:02:23.400 · `event_frames/CH02-E0012_00h02m23s400ms_motion_progress.jpg` · crop E0012 | Cédula/Pasaporte y calendario; formato y unicidad quedan abiertos. |
| CH02-F006 | VISIBLE | Selectores demográficos/empresa | CH02-E0024 · 00:03:00.400 · `event_frames/CH02-E0024_00h03m00s400ms_abrupt_change.jpg` · crop E0024 | Sexo, sangre, estado civil, nacionalidad buscable y empresa. |
| CH02-F007 | VISIBLE | Consentimiento Botmaker/WhatsApp | CH02-E0022 · 00:02:57.200 · `event_frames/CH02-E0022_00h02m57s200ms_settled.jpg` · crop E0022 | Marcado por defecto; desmarcar impide avisos automáticos de visitas/recursos. No autoriza contenido clínico sensible. |
| CH02-F008 | VERBAL | Paciente regular o asegurado | CH02-E0031 · 00:03:26.000 · `event_frames/CH02-E0031_00h03m26s000ms_abrupt_change.jpg` · crop E0031 | La explicación verbal coincide con el valor inicial y selección visible. |
| CH02-F009 | VISIBLE | Catálogo buscable de seguros | CH02-E0032 · 00:03:30.400 · `event_frames/CH02-E0032_00h03m30s400ms_abrupt_change.jpg` · crop E0032 | Lista extensa y búsqueda; fuente y alcance no demostrados. |
| CH02-F010 | UNCERTAIN | Resultados anómalos de seguro | CH02-E0058 · 00:03:46.600 · `event_frames/CH02-E0058_00h03m46s600ms_stable_change.jpg` · crop E0058 | El filtro mezcla una aseguradora con entradas de apariencia personal; requiere confirmación. |
| CH02-F011 | VISIBLE | Modal de titularidad | CH02-E0062 · 00:03:49.800 · `event_frames/CH02-E0062_00h03m49s800ms_stable_change.jpg` | Pregunta si el paciente es titular; solo se desarrolla Sí. |
| CH02-F012 | VISIBLE | Cobertura condicional | CH02-E0066 · 00:04:10.000 · `event_frames/CH02-E0066_00h04m10s000ms_abrupt_change.jpg` · crop E0066 | Póliza, certificado/unidad, titular, fecha efectiva y Agregar; no se agrega. |
| CH02-F013 | VISIBLE | Contactos del paciente | CH02-E0068 · 00:04:11.000 · `event_frames/CH02-E0068_00h04m11s000ms_stable_change.jpg` | Seis campos; sin guardado ni reglas de multiplicidad. |
| CH02-F014 | VISIBLE | Dirección e importación de enlace | CH02-E0071 · 00:04:19.600 · `event_frames/CH02-E0071_00h04m19s600ms_abrupt_change.jpg` | Pegar enlace, información, Limpiar, Dirección*, Comentarios* y ubicación. |
| CH02-F015 | VISIBLE | Mapa de ubicación | CH02-E0076 · 00:04:35.800 · `event_frames/CH02-E0076_00h04m35s800ms_abrupt_change.jpg` · crop E0076 | Marcador, capas, pantalla completa, cámara y ayuda de zoom; precisión no demostrada. |
| CH02-F016 | VISIBLE | Atrás y Guardar | CH02-E0082 · 00:04:39.000 · `event_frames/CH02-E0082_00h04m39s000ms_stable_change.jpg` · crop E0082 | El clip termina sin clic, validación, éxito ni persistencia observable. |

No se convierten en requisitos las reglas ausentes de formato documental, consentimiento, cobertura, geocodificación, persistencia o auditoría; se remiten a preguntas abiertas.
