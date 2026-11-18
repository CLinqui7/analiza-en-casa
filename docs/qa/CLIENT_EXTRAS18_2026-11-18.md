# Ajustes clínicos y conciliación de insumos del 18 de noviembre

Fuente: `extras18denov_.docx`, SHA256 `21a4a415bce02be3c24358ab73c1bd3b177b6294902d159a826c217b751fc825`. [Texto fuente](sources/CLIENT_EXTRAS18_2026-11-18.txt); correo operativo conservado en el original privado. El usuario autorizó elegir el nombre de la cuenta; se utilizará el nombre de presentación Dr. Carlos Sorto, con las cuatro pantallas expresamente indicadas.

Estado: implementación local; pruebas de navegador y despliegue pendientes. Base Git `6ba3d88`, producción previa `cc009b1`. Preflight y 376 pruebas de la línea base pasaron antes de editar. No se añadieron dependencias ni migraciones.

| ID | Cambio solicitado | Implementación y regresión necesaria |
|---|---|---|
| EX18-01 | Antecedentes personales | Sólo cambia la etiqueta; `BACKGROUND`, registros e historial se conservan. |
| EX18-02 | Buscar hospitalización escribiendo | Reutiliza selector accesible existente, limitado al paciente; conserva contexto inmutable al corregir. |
| EX18-03 | Una descripción por tipo de cuidado | Dieta y cuidados separados; texto conservado al alternar selección; servidor conserva campos y legado. Corrección agrega versión. |
| EX18-04 | PDF por una, varias o todas las secciones | Descarga PDF real usando la misma selección renderizada para imprimir; filtros de paciente, caso y versiones compartidos. |
| EX18-05 | Añadir soluciones a la tarjeta | Predicado compartido para medicamentos o palabras Solución/Soluciones, sin distinguir tildes/mayúsculas; configuración y consumo también aceptan esos productos. No inventa dosis/unidades. |
| EX18-06 | Cuenta Doctor con cuatro pantallas clínicas | Rol existente restringido, entrada a Ingresos clínicos; Agenda, Expediente y Órdenes médicas. Contexto de cotización proyectado sin importes ni pagadores. API financiera/decisiones/configuración rechaza al rol; directorio mínimo y pacientes son dependencias clínicas. |
| EX18-07 | Insumos y cuenta sin duplicación en VPS | Revisión de transacciones/idempotencia y pruebas concurrentes. Tras POST confirmado, fallo de refresco advierte sincronización pendiente y reintenta sólo lectura. Falta verificación de escritura con organización sintética pública. |

Se preservan los estados históricos de las matrices. No hay nueva declaración EXACT ni revisión completa de los 17 capítulos. Las revisiones delegadas de CH08/CH14 y CH09/CH10/CH17 fueron de sólo lectura y focalizadas. Se abrieron CH08-E0087, CH14-E0017, CH09-E0126, CH10-E0013, CH17-E0008 y CH17-E0026; sus conclusiones protegen saldo/pagos, separación de inventario, historial y selección de impresión.

La primera comprobación TypeScript detectó una sustitución accidental de la interfaz del selector compartido; se restauró su implementación y se reutilizó. Sólo se añadió protección del botón de limpiar cuando está deshabilitado. Dos expectativas antiguas de permisos se ajustaron al nuevo alcance Doctor, conservando las aserciones de acceso prohibido para los otros roles. Ninguno de esos estados se publicó.
