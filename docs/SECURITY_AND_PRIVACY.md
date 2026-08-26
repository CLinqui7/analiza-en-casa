# Seguridad y privacidad

## Controles incluidos

- Acceso por rol.
- RLS por organización.
- Buckets privados.
- Tokens del portal almacenados como hash.
- Segundo factor de verificación en el portal.
- Límite de intentos y vencimiento.
- Respuesta genérica para impedir enumeración.
- Service role exclusivamente en funciones server-side.
- Mensajes externos con contenido administrativo mínimo.
- Documentos firmados inmutables para edición ordinaria.
- Pagos y movimientos con idempotencia.
- Auditoría de acciones sensibles.
- Encabezados de seguridad en Vercel.

## Datos que no deben enviarse por WhatsApp o SMS

- Diagnóstico.
- Evolución clínica.
- Medicamentos.
- Resultados de laboratorio.
- Notas de enfermería.
- Documento completo del paciente.
- Archivos clínicos adjuntos.

El canal externo debe enviar únicamente una notificación y un enlace seguro.

## Revisión obligatoria antes de producción real

- Legislación salvadoreña y contratos aplicables.
- Matriz definitiva de roles.
- Mínimo privilegio.
- Pruebas RLS por rol y organización.
- Retención y eliminación.
- Cifrado y gestión de secretos.
- Backups y restauración.
- Plan de incidentes.
- Registro de consentimiento.
- Firma y validez de documentos clínicos.
