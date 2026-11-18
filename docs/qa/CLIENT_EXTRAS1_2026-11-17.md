# Correcciones de extras1parte_.docx

Fuente: [texto literal](sources/CLIENT_EXTRAS1_2026-11-17.txt). SHA256 del DOCX: `312251e0d04734dacee22dcb9891367aaa769f8818246297025e70cf7e6ac316`. El original no se modificó. No contiene imágenes.

Estado: implementación y verificaciones locales aprobadas; prueba de navegador conectada y publicación pendientes.

| ID | Corrección solicitada | Implementación y criterio de aceptación |
| --- | --- | --- |
| EXTRAS1-01 | Responsable administrativo por defecto y estable al escribir | Completar también formularios recuperados con responsable vacío, después de la recuperación; conservar nombres existentes o escritos mientras llega el perfil. Mantener el valor al cambiar otros campos, guardar temporalmente y recargar. Mostrar reintento si el perfil falla. |
| EXTRAS1-02 | Mostrar cotizaciones del paciente en Precotización; actualizar la misma cotización y Cuentas por cobrar | Consultar de nuevo al abrir la solicitud, con filtro servidor por solicitud/organización independiente de la página; permitir actualizar desde el diálogo. No mostrar un fallo de conexión como ausencia de cotizaciones. Conservar la ampliación auditada de aprobadas, la raíz lógica, pagos y versiones inmutables. |
| EXTRAS1-03 | Proveedores en tabla, como anteriormente | Tabla semántica con nombre/código, contacto, teléfonos, correo, dirección/notas, estado y edición; conservar búsqueda, permisos y datos compartidos con compras. En pantallas pequeñas el desplazamiento queda dentro de la tabla, sin desbordar la página. |

La edición de aprobadas sigue limitada a la ampliación expresamente autorizada desde Precotización. “No crear una nueva” significa una sola cotización lógica/código/cuenta: las versiones internas de una enviada se conservan por auditoría y no aparecen como cuentas duplicadas.

Línea base: preflight y 370 pruebas unitarias/servidor aprobados antes de modificar. Se mantienen los gates CH01–CH03 y los estados históricos de trazabilidad; este lote no constituye una nueva revisión completa de los 17 capítulos.

Verificación inicial: 370 pruebas unitarias/servidor; 54 escenarios mock (CH01–CH03, CH14 y cotizaciones); diez grupos PostgreSQL en base aislada y con rol sin bypass de RLS; TypeScript, ESLint, formato, build de producción, 144 pruebas legacy y 76 controles QA. Auditoría de ledgers, 210 requisitos trazados, 32 cambios de cliente, espejo de matrices, límites React y escaneo de secretos aprobados.

La comprobación de cambios detectó hashes desactualizados en CR-011/CR-012 al modificar el formulario; se actualizaron tras ejecutar la regresión de cotizaciones, conservando sus estados históricos. Los identificadores Selenium históricos no se declaran reejecutados: la regresión actual utilizó Playwright y PostgreSQL.

Revisión del cambio: autorización y RLS se mantienen en servidor; la consulta específica no admite escoger otra organización y obtiene las cotizaciones sólo del paciente de la solicitud. El diálogo cancela consultas anteriores, bloquea Guardar mientras carga y diferencia un fallo de conexión de una lista vacía. No se añaden dependencias, migraciones ni reglas clínicas o de cobertura.

## Hallazgo durante la regresión conectada

La primera ejecución detectó HTTP 403 al asignar después de consultar CSRF otra vez con la misma sesión. El GET de CSRF rotaba el token guardado y dejaba inválido el que una pestaña abierta mantenía en memoria. Era reproducible también al abrir otra pestaña, por lo que podía afectar el guardado temporal de formularios.

La corrección devuelve un token estable por sesión mediante HMAC-SHA256, con separación de dominio y el secreto aleatorio de la cookie HttpOnly como clave; nunca devuelve la cookie de sesión. El servidor sigue exigiendo el encabezado explícito, comparando en tiempo constante y comprobando vigencia/revocación. Las sesiones anteriores conservan su último token emitido hasta su vencimiento normal y también pueden obtener el token estable. No se guarda un token nuevo en cookies ni se actualiza la base al consultar CSRF. Se rechazan consultas explícitamente cross-site. Se siguió el criterio de tokens por sesión y encabezados de [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#synchronizer-token-pattern).

Se añadieron pruebas de concurrencia, separación entre sesiones, token ausente/incorrecto, compatibilidad con formularios anteriores, expiración, revocación, fallo del almacenamiento y consulta cross-site. Las 376 pruebas unitarias/servidor resultantes pasaron. Dos fallos iniciales del nuevo test de formulario se debieron al selector de la etiqueta «Prioridad»; se corrigió para utilizar el identificador estable del control, manteniendo las mismas aserciones de persistencia. Una devolución accidental de un mock desde `beforeEach` también se corrigió en la nueva prueba HTTP.

Verificación conectada final, revisión visual, SHA publicado y resultados del VPS: pendientes de ejecución.
