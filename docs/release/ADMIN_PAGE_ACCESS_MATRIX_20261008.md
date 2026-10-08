# Acceso a páginas de las ocho cuentas administrativas

Solicitud del cliente, 8 de octubre de 2026: todas las cuentas enumeradas deben usar las páginas del espacio de trabajo como administradoras; la bitácora privada de accesos queda excluida. Dashboard queda habilitado únicamente para Claudia y Sissy dentro de este grupo.

| Cuenta | Rol | Dashboard | Otras páginas operativas | Analítica de accesos |
| --- | --- | --- | --- | --- |
| nancy.vasquez@analizaencasa.com | ADMIN | No | Sí | No |
| karla@analizaencasa.com | ADMIN | No | Sí | No |
| abigailsv92@analizaencasa.com | ADMIN | No | Sí | No |
| analiza@analizaencasa.com | ADMIN | No | Sí | No |
| claudia.pinzon@analizaencasa.com | ADMIN | Sí | Sí | No |
| nelly.viscarra@analizaencasa.com | ADMIN | No | Sí | No |
| olaya.deras@analizaencasa.com | ADMIN | No | Sí | No |
| sissy.chavez@analizaencasa.com | ADMIN | Sí | Sí | No |

## Hallazgo y corrección

El rol `ADMIN` ya tenía permisos de lectura y escritura para las páginas generales, y la restricción individual de Dashboard funcionaba. Había una excepción adicional no reflejada en el permiso genérico: `Visitas y metas · venta de equipos` dependía de una lista de dos correos y se ocultaba a las otras seis administradoras. Ahora el alcance comercial se resuelve a partir de membresía organizacional activa y usuario habilitado: Claudia conserva el flujo de representante (`REP`); Sissy y los demás `ADMIN`/`WEBMASTER` obtienen alcance de gestión (`MANAGER`). Los demás roles no reciben acceso comercial por este cambio. La bitácora `/analytics/logins` y su API conservan el permiso exclusivo `login-analytics:read`, que no tiene `ADMIN`.

La comprobación `scripts/verify-admin-page-access.mjs` inicia sesión con cada cuenta sin guardar contraseñas, coteja el menú completo con la navegación declarada, abre cada destino operativo con una cuenta sin Dashboard y verifica API, acceso comercial, Dashboard y rechazo de analítica. No crea ni modifica registros de pacientes, clínica, inventario o finanzas.

## Validación local

- 221 pruebas React/servidor y 136 pruebas de repositorio aprobadas.
- TypeScript, ESLint y build Next aprobados.
- CH01 14/14, CH02 16/16 y CH03 13/13 aprobados después de corregir el listado de pruebas que el verificador reconoce; no se elevó ningún estado de paridad del video.
- Auditoría de evidencia: 17/17 capítulos aprobados. Los resultados de navegador y producción se consignan en la entrega final.
- Regresión de navegador con datos sintéticos: 212/212 pruebas aprobadas. La prueba de honorario médico se hizo determinista identificando la cotización creada, sin alterar el flujo de cotización.

## Comprobación de despliegue candidato

El despliegue `dpl_BptBMM6RVU5B7gJrqhqSyreiAsDg` quedó listo. En el recorrido autenticado de Karla, Abigail, Abril, Claudia, Nelly, Olaya y Sissy se verificaron rol `ADMIN`, 39 enlaces operativos, cuatro APIs operativas 200, alcance comercial esperado, analítica de accesos 403 y Dashboard según la tabla. Los 39 destinos se abrieron con Karla sin pantalla de acceso denegado. Nancy ya había demostrado rol, página inicial y alcance comercial, pero quedó pendiente la repetición completa de este barrido debido al límite temporal de sesiones de prueba; se respetó el límite y no se deshabilitó. La compilación final agrega un estado de carga claro para evitar mostrar un rechazo comercial transitorio mientras responde la API.

La modificación no cambia registros ni membresías: las ocho membresías `ADMIN` y seis restricciones individuales de Dashboard fueron reconciliadas y verificadas en el lote previo (`docs/release/FULL_NURSING_ADMIN_COHORT_20261008.md`).
