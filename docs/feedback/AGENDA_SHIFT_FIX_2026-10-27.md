# Agenda: guardado y edición de turnos · 27 de octubre de 2026

Fuente: captura compartida por el cliente con el mensaje «El servidor no confirmó la serie de turnos» al guardar un turno desde Agenda. La imagen es evidencia del usuario y permanece fuera de Git. No contiene un número de reporte de feedback visible.

El 27 de octubre, la web del VPS y `/api/health` respondían correctamente. En la organización sintética de QA se reprodujo la creación por API (HTTP 201) y por el formulario publicado, con paciente, empresa y horario de 08:00 a 16:00. La edición del mismo turno devolvía HTTP 503. El registro de PostgreSQL mostró `permission denied for table shifts` en la consulta `SELECT ... FOR UPDATE` usada por la edición. El rol web sólo tenía `SELECT,INSERT` sobre esa tabla.

Una inspección de sólo lectura de la organización principal encontró cuatro recursos y ningún turno superpuesto al 28 de octubre, de 08:00 a 16:00. Por tanto, no hay evidencia de que una colisión existente haya provocado el error de la captura. El fallo exacto de ese intento no puede reconstruirse sólo con la imagen: el cliente web convertía cualquier rechazo de la API en el mismo mensaje genérico. El cambio permite distinguir los rechazos posteriores sin alterar datos reales.

Se agregó el permiso mínimo `UPDATE` para `analiza.shifts` al provisionamiento idempotente del rol web. `analiza.commands` y `analiza.audit_events` conservan escritura sólo de inserción; no se concedió `DELETE`. La pantalla recibirá el error específico del servidor cuando una serie o edición sea rechazada por validación, por ejemplo por colisión de horario, en vez de mostrar únicamente el mensaje genérico de falta de confirmación.

La prueba nueva `node:postgres-shift-update-runtime-grant` verifica el permiso necesario y que el registro de comandos siga siendo de sólo inserción. La comprobación conectada posterior al despliegue debe incluir alta, edición y rechazo por colisión con datos sintéticos de QA, además del estado de salud y respaldo previo del VPS. No se cambia ningún turno de la organización principal durante estas pruebas.
