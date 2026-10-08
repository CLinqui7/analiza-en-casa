# Acceso administrativo para las ocho cuentas solicitadas

Fecha: 8 de octubre de 2026. Solicitud del cliente: “a todos esos necesito que puedan ver todo ... solo a las que te dije que no pueden ver el dashboard ... cotizaciones y todo”. La lista fuente es la de los ocho correos de esta tabla; no se aplicó un cambio global al rol `NURSE`.

| Cuenta | Rol activo | Dashboard | Página inicial |
| --- | --- | --- | --- |
| nancy.vasquez@analizaencasa.com | `ADMIN` | No | Pacientes |
| karla@analizaencasa.com | `ADMIN` | No | Pacientes |
| abigailsv92@analizaencasa.com | `ADMIN` | No | Pacientes |
| analiza@analizaencasa.com | `ADMIN` | No | Pacientes |
| claudia.pinzon@analizaencasa.com | `ADMIN` | Sí | Dashboard |
| nelly.viscarra@analizaencasa.com | `ADMIN` | No | Pacientes |
| olaya.deras@analizaencasa.com | `ADMIN` | No | Pacientes |
| sissy.chavez@analizaencasa.com | `ADMIN` | Sí | Dashboard |

Las cuatro cuentas que faltaban (Abigail, Abril, Nelly Viscarra y Olaya) pasaron de `NURSE` a `ADMIN` con `dashboard_restricted=true` en una sola transacción. Karla, Nancy, Claudia y Sissy ya estaban correctas y no se volvieron a modificar. Se revocó una sesión anterior de las cuentas modificadas. La tabla de auditoría, con RLS activo y forzado, contiene cuatro eventos nuevos de este lote y cuatro del lote anterior. Una segunda ejecución del reconciliador no cambió cuentas.

## Verificación

- El plan sin escritura enumera exactamente los ocho correos y los seis “Dashboard: No” / dos “Dashboard: Sí”. El test de plan, los 136 tests del proyecto, los 76 controles QA, el escaneo de seguridad, CH01 14/14, los cambios cliente 32/32 y la auditoría de 17 capítulos pasaron.
- En `https://analiza-en-casa-demo.vercel.app`, cada una de las ocho cuentas inició sesión en su destino previsto. Todas mostraron `ADMIN`, el botón `+ Nuevo` de Cotizaciones y `Nueva hospitalización`; las APIs de Cotizaciones, Hospitalizaciones y Feedback respondieron 200. El enlace directo a `/dashboard` respetó las seis exclusiones y los dos accesos; no hubo errores de página.
- La compilación publicada `dpl_3ZPHcU8jDdKgQjeM4EYSXDZhpJdE` ya soportaba la exclusión individual; no se hizo un despliegue nuevo por este cambio de datos. `/api/health` siguió en `ready` con PostgreSQL `ready`; la consulta de errores del despliegue no encontró registros recientes.
- No se crearon ni modificaron pacientes, cotizaciones, pagos o registros clínicos reales para probar los permisos. La regresión de navegador de 212 pruebas con datos sintéticos del mismo código publicado ya había pasado antes de este lote.

Nota de alcance: `ADMIN` conserva todos los permisos del espacio de trabajo, salvo la restricción individual del Dashboard. La bitácora privada de accesos sigue reservada a `WEBMASTER`, conforme a la decisión previa del cliente, mientras no se confirme expresamente cambiar esa privacidad.
