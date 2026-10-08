# Inicio según permisos — 8 de octubre de 2026

Solicitud: las cuentas sin acceso al Dashboard deben abrir una pantalla permitida tras iniciar sesión; comprobar Karla, Nancy y Sissy.

## Cambio

- El inicio de sesión conserva la selección de destino autorizada: cuentas NURSE sin `dashboardAccess` van a `/patients`; cuentas ANALYTICS van a `/analytics/logins`.
- Si una cuenta autenticada sin permiso abre `/dashboard` directamente o mediante un marcador, `AppShell` la redirige al mismo destino permitido. No se amplían permisos ni se muestran datos del Dashboard durante la transición.
- Una cuenta con permiso conserva `/dashboard`.

## Evidencia

- Implementación: `e055e77619bfd0697f98b993d76ba7b76c1944f6`; certificación CH01: `30d9928`.
- Regresión sintética: `apps/web/e2e/dashboard-landing.spec.ts`; 211/211 pruebas de navegador con build de producción local; 207/207 pruebas React/servidor; CH01 14/14; trazabilidad de video 210/210; cambios de cliente 32/32; auditoría 17/17.
- Despliegue Vercel `dpl_27HujpJjtgEYJ4eCLZ3rtTL3PS8D`, probado primero en URL candidata y luego en la URL pública `https://analiza-en-casa-demo.vercel.app`. Salud: `ready`, base de datos PostgreSQL: `ready`.
- `npm audit --omit=dev` reportó 0 vulnerabilidades en dependencias de producción. El instalador de Vercel advirtió 5 de severidad alta al incluir también dependencias de desarrollo; no forman parte del conjunto `--omit=dev`.

| Cuenta | Permiso Dashboard vigente | Después del inicio | Enlace directo a `/dashboard` |
| --- | --- | --- | --- |
| Karla | No | `/patients` | `/patients` |
| Nancy | No | `/patients` | `/patients` |
| Sissy | Sí | `/dashboard` | `/dashboard` |

La comprobación final usó las cuentas existentes en producción y sesiones aisladas de navegador. No se guardaron contraseñas ni datos clínicos en el repositorio o en esta evidencia. La clasificación histórica de paridad de video no cambió; esta certificación cubre únicamente la regresión de navegación y permisos.
