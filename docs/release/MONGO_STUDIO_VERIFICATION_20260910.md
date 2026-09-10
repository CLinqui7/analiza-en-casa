# React Studio y Mongo · verificación 10 septiembre 2026

## Alcance de la evidencia

Mismo checkout y rama `codex/ui-polish-final-20260904`. Se preservó el HEAD inicial `c47bb2ae94d08152836d9a98fc001d6dba043440`, coincidente con el remoto, y no se ejecutaron restauraciones ni launchers. Un solo escritor de aplicación. El HTML fue abierto en navegador y recorridas sus 35 rutas; las capturas y el inventario de interacciones están en `.local/studio-reference/` (no se publican datos eventualmente introducidos en esa demo).

Se trasladó la paleta final del HTML (azul oscuro, rojo, fondo gris claro), anchos de menú, tablas compactas, jerarquía de botones y diálogos. Se preservan los grupos plegables, el menú retraíble y sus estados de navegación. No se copió la autenticación ni la persistencia local del HTML.

## Atlas real, no emulado

- Proyecto existente `6aa160fb84024a21784cb906`, clúster `analiza-cluster`, base `analiza_en_casa`.
- Usuario técnico limitado a `readWrite` sobre esa base y a ese clúster. Secretos sólo en archivos ignorados del operador; no se publican valores.
- Lista de acceso restringida a una IPv4 del operador; no se habilitó `0.0.0.0/0`.
- Se ejecutó el bootstrap existente, con semilla exclusivamente ficticia y 41 índices idempotentes. El URI estándar de réplica proporcionado por Atlas resolvió el fallo DNS SRV local, conservando TLS y autenticación.
- Prueba HTTP real más consultas Atlas: `apps/web/src/server/mongo-live-verification.ts`, última ejecución completa `2026-09-10T06:55:48.539Z`, lote `qa-f818838c`, contra las funciones del build Next.
- La prueba crea datos sintéticos identificables QA; las ejecuciones dejan sus registros de prueba y auditoría para inspección. No hay información clínica real.

## Flujos comprobados localmente

| Flujo | Evidencia real | Pendiente |
| --- | --- | --- |
| Paciente, hospitalización y cotización | Crear, editar, recuperar en otra sesión autorizada; organización ajena no accede; CSRF obligatorio | Repetir en preview conectado |
| Documentos privados | Creación desde React con identidad y responsable (dos PNG ficticios), descarga de ambos bytes desde una sesión nueva; además API rechaza otra organización con 404 | Repetir en preview conectado |
| Enfermera encargada | Crea cuenta NURSE y recurso vinculado; no puede inyectar rol ADMIN | Alta institucional y aprobación final de matriz de roles |
| Catálogos | Medicamento y dosis configurables, guardados por encargada; especialidades y seguros usan el mismo comando | Valores institucionales; descuento no implica cobertura aprobada automática |
| Balance hídrico | Enfermera de misma organización consulta; sólo asignadas editan; cierre y corrección conservan original; reintento no duplica | Validación institucional; no se interpretan umbrales clínicos |
| Administración e inventario | Dos tabletas descuentan dos; blíster usa equivalencia configurada; repetición no descuenta; caja sin stock revierte toda la transacción | Lotes, vencimientos, traslados y reglas institucionales no certificados |
| Pagos | Persiste entre sesiones; idempotencia; cambio de importe en reintento rechazado; anulación auditada conserva fila | Facturación fiscal, conciliación y proveedor de pagos |
| Visitas y metas | Página separada, profesional autenticado, mes, visitas realizadas y ventas con referencia explícita; metas persistidas | Conciliación de ventas con fuente institucional |
| Error de guardado | Formulario React con POST rechazado: muestra error, sigue abierto, no modifica localStorage ni Atlas | Repetición en preview conectado |

`scripts/verify-local-mongo-browser.mjs` comprobó navegación, formularios de escritorio y móvil a 390px, y ausencia de errores JavaScript. Evidencia de ejecución y capturas reales: `.local/mongo-verification/`. Las capturas no constituyen certificación de equivalencia clínica ni de todos los eventos del video.

`scripts/verify-patient-private-files.mjs` pasó el 2026-09-10T07:13:04.490Z: crea el paciente desde el formulario React, carga dos imágenes ficticias de un píxel y compara los bytes descargados desde una sesión nueva autenticada. Se ejecuta con `node --env-file=.env.mongodb.operator.local scripts/verify-patient-private-files.mjs`; no imprime credenciales.

## Preview visual publicado

- URL: https://web-nrj9qg9ad-clinqui7s-projects.vercel.app
- Estado de Vercel: `READY`; entorno Preview protegido y DEMO.
- Deployment: `dpl_G4ZNE6eFsnqJUZp7ZacbCM7GvW69`.
- SHA del artefacto: `4572c898518c9fef049451e926e57b21ed57e63b` (los commits posteriores de evidencia no alteran ese artefacto).
- Comprobación publicada terminada el `2026-09-10T07:14:11.710Z`: 32 rutas del menú, 7 diálogos en escritorio y móvil, menú retraído persistente, cero errores JavaScript y sin desbordamiento horizontal global.
- Informe: `PREVIEW_STUDIO_BROWSER_REPORT_20260910.json`; 15 capturas publicadas conservadas en `docs/parity/screenshots/studio-preview-*-4572c89.png`.
- La petición sin autorización a `/login` devuelve 302 a Vercel. La verificación autenticada usa un secreto de operador sólo como cabecera del origen exacto, no en URLs o capturas.
- Se corrigió la omisión del registro de cambios en el empaquetado CLI. El build final conserva los endpoints dinámicos de sesión, archivos, pacientes, hospitalizaciones, cotizaciones y operaciones; no usa exportación estática ni una versión canary.

## Límites que siguen abiertos

Regresión del candidato: 178/178 Playwright sin skips contra un servidor Next del build optimizado, 98/98 pruebas React/servidor, 103/103 pruebas base, typecheck y lint aprobados. Los gates de trazabilidad CH01–CH03 y las 32 solicitudes pasan; esto no convierte los requisitos pendientes en funciones completas. Selenium no se volvió a ejecutar. Se ajustaron selectores a la interfaz Studio manteniendo las aserciones funcionales y se añadieron comprobaciones de menú contraído y bloqueo seguro de QR.

El equipo Vercel permanece en Hobby; la solicitud de salida fija devolvió 402. No se puede conectar el preview a Atlas con la restricción de red acordada hasta disponer de salida fija autorizada. Un preview DEMO protegido puede mostrar el rediseño, pero no equivale a la aplicación local conectada. Las páginas nuevas de operaciones no simulan un guardado exitoso cuando Mongo no está habilitado.

La inspección efectiva encontró `ssoProtection: null` pese al informe antiguo. Se habilitó únicamente `ssoProtection.deploymentType: preview` en el proyecto existente, y una petición sin autenticación a `/login` redirige ahora a Vercel (302). Comments sigue desactivado y `VERCEL_PREVIEW_FEEDBACK_ENABLED=0` se conserva para la rama. No se modificaron las políticas de producción.

Se mantienen las 32 solicitudes Excel y 210 requisitos de video. Las escalas con conflicto o sin formulario aprobado siguen abiertas; no se inventan puntuaciones, dominios ni interpretaciones. La interfaz de Cambios solicitados permite inspeccionar esas diferencias. La revisión estructural de los 17 capítulos pasó, pero no certifica por sí sola paridad funcional React.

WhatsApp/OTP necesita proveedor seguro; no se afirma envío de PDFs ni mensajes entregados. La importación de médicos/expedientes existentes requiere datos fuente y validación. “Selección de fin” no identifica aún inequívocamente el control. No se eliminan egresos o límites de turnos por suposición.
