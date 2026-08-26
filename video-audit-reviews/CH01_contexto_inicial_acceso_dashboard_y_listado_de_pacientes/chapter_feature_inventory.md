# Inventario funcional · CH01

Se revisaron 24 event frames, 11 detail crops, 3 hojas de eventos, 7 hojas de seguridad, README, cobertura, manifiestos CSV/JSON, transcripciones TXT/SRT y el clip exacto. La transcripción solo contiene `[MÚSICA]`; no hay hallazgos `VERBAL`.

| ID | Clasificación | Función | Evidencia principal | Observación / regla |
|---|---|---|---|---|
| CH01-F001 | INFERRED | Acceso desde URL directa | CH01-E0002 · 00:00:05.600 · `event_frames/CH01-E0002_00h00m05s600ms_abrupt_change.jpg` · crop E0002 | Un enlace externo apunta a `/pacientes.php`; no se demuestra el caso sin sesión. |
| CH01-F002 | VISIBLE | Listado de pacientes | CH01-E0009 · 00:00:56.200 · `event_frames/CH01-E0009_00h00m56s200ms_abrupt_change.jpg` | Pestañas Activos, Inactivos y Carga masiva. |
| CH01-F003 | VISIBLE | Columnas de pacientes | CH01-E0012 · 00:01:25.000 · `event_frames/CH01-E0012_00h01m25s000ms_abrupt_change.jpg` | Acción, Documento, Nombre completo, Edad, Empresa, Triage, Notif. Botmaker y Estado. |
| CH01-F004 | VISIBLE | Búsqueda y paginación | CH01-E0013 · 00:01:26.800 · `event_frames/CH01-E0013_00h01m26s800ms_settled.jpg` · crop E0013 | Selector, páginas, anterior/siguiente y búsqueda. |
| CH01-F005 | VISIBLE | Excel y + Nuevo | CH01-E0009 · 00:00:56.200 · `event_frames/CH01-E0009_00h00m56s200ms_abrupt_change.jpg` | No se abre exportación ni formulario. |
| CH01-F006 | VISIBLE | Carga y vacío | CH01-E0011 · 00:01:24.600 · `event_frames/CH01-E0011_00h01m24s600ms_abrupt_change.jpg` | `Cargando...` coexiste con `No hay registros disponibles`. |
| CH01-F007 | VISIBLE | Estados por paciente | CH01-E0012 · 00:01:25.000 · `event_frames/CH01-E0012_00h01m25s000ms_abrupt_change.jpg` | Triage, notificación y estado; no se infieren fórmulas. |
| CH01-F008 | VISIBLE | Menú lateral jerárquico | CH01-E0014 · 00:01:28.800 · `event_frames/CH01-E0014_00h01m28s800ms_abrupt_change.jpg` | Módulos principales y grupos desplegables para el usuario observado. |
| CH01-F009 | VISIBLE | Dashboard de seis indicadores | CH01-E0018 · 00:01:31.400 · `event_frames/CH01-E0018_00h01m31s400ms_abrupt_change.jpg` | Contadores en cero; fórmula y período inciertos. |
| CH01-F010 | VISIBLE | Valores fuera de rango | CH01-E0019 · 00:01:32.000 · `event_frames/CH01-E0019_00h01m32s000ms_stable_change.jpg` | Sección clínica vacía con encabezados concatenados y etiqueta `Normales`. |
| CH01-F011 | VISIBLE | Perfil y organización | CH01-E0020 · 00:01:38.400 · `event_frames/CH01-E0020_00h01m38s400ms_motion_progress.jpg` · crop E0020 | Organización, Mi usuario y Cerrar Sesión. |
| CH01-F012 | VISIBLE | Cierre de sesión | CH01-E0022 · 00:01:41.800 · `event_frames/CH01-E0022_00h01m41s800ms_abrupt_change.jpg` | El clip exacto confirma transición directa a Login. |
| CH01-F013 | VISIBLE | Formulario de login | CH01-E0023 · 00:01:42.400 · `event_frames/CH01-E0023_00h01m42s400ms_stable_change.jpg` · crop E0023 | Usuario, Clave, Iniciar sesión y recuperación; sin validaciones observadas. |
| CH01-F014 | INFERRED | Instalación PWA aparente | CH01-E0023 · 00:01:42.400 · `event_frames/CH01-E0023_00h01m42s400ms_stable_change.jpg` · crop E0023 | El botón existe, pero no se observa instalación completa. |

CH01-E0001 a E0008 contienen WhatsApp, placas de reunión, transiciones y una imagen externa. Se registran en el ledger, pero no prueban integración WhatsApp ni reglas financieras del producto.
