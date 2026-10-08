# Acceso administrativo por cuenta, con Dashboard excluido cuando corresponde

Fecha: 8 de octubre de 2026. Solicitud del cliente: “necesito que tengan acceso de admin ... no tiene que tener el dashboard ... claudia ... carlos, webmaster, sissy ... acceso a todo ... cotizaciones, hospitalizacion, todas ... funciones”. Se aplicó únicamente a las cuatro personas nombradas y comprobadas; no se convirtió a todas las cuentas `NURSE` en administradoras.

## Resultado en producción

| Cuenta | Rol activo | Dashboard | Entrada después de iniciar sesión |
| --- | --- | --- | --- |
| Karla | `ADMIN` | Restringido | `/patients` |
| Nancy | `ADMIN` | Restringido | `/patients` |
| Claudia | `ADMIN` | Permitido | `/dashboard` |
| Sissy | `ADMIN` | Permitido | `/dashboard` |
| Carlos | `WEBMASTER`, sin cambio | Permitido | `/dashboard` |
| Webmaster | `WEBMASTER`, sin cambio | Permitido | `/dashboard` |

La exclusión del Dashboard es un indicador individual `dashboard_restricted`, no una reducción de los demás permisos administrativos. El rol `ADMIN` habilita Cotizaciones, Hospitalizaciones y los otros módulos de trabajo, mientras el acceso directo a `/dashboard` vuelve a Pacientes para Karla y Nancy. Las sesiones anteriores de las cuatro cuentas se revocaron para que el cambio fuera inmediato.

## Trazabilidad y seguridad

- Código: `554d7f70b689dc0df301a7ea2be0e98489c88734`; certificación CH01: `de738cc852769d5b93163b9db545972fd2b659cd`.
- Migración aditiva y ordenada: `027_admin_dashboard_restriction.sql`. Las cuentas existentes conservaron su comportamiento hasta el cambio explícito por cuenta.
- El cambio de cuatro membresías se hizo en una transacción con identidad, organización y rol previo verificados. Se registraron cuatro eventos en `analiza.membership_access_changes`, una tabla con RLS activo y forzado. No se guardaron contraseñas ni datos clínicos.
- Una segunda ejecución del reconciliador confirmó idempotencia: 0 cuentas modificadas y 0 sesiones revocadas.
- Despliegue Vercel `dpl_3ZPHcU8jDdKgQjeM4EYSXDZhpJdE`, primero probado sin mover el dominio y después promovido a `https://analiza-en-casa-demo.vercel.app`. `/api/health` respondió `ready` con PostgreSQL `ready`.

## Pruebas

- 212/212 Playwright contra build de producción local con datos sintéticos; 209/209 pruebas React/servidor; 135/135 pruebas del proyecto; CH01 14/14; trazabilidad 210/210; cambios cliente 32/32; auditoría de 17 capítulos completa.
- En la URL pública, las cuatro cuentas iniciaron sesión con el rol y destino previstos. Cotizaciones mostró el botón `+ Nuevo`; Hospitalizaciones mostró `Nueva hospitalización`; las APIs de Cotizaciones, Hospitalizaciones y Feedback respondieron HTTP 200; no hubo errores de página. Karla y Nancy regresaron a Pacientes al abrir `/dashboard` directamente; Claudia y Sissy permanecieron en Dashboard.
- No se hicieron escrituras de pacientes, cotizaciones ni movimientos reales para probar permisos. Las operaciones de escritura se cubrieron con datos sintéticos en la regresión automatizada.
- La consulta de errores del despliegue en Vercel para los últimos 30 minutos no encontró registros.
