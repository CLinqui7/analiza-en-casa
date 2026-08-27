# Baseline de paridad exacta

Fecha: 2026-08-26 (America/El_Salvador)  
Rama: `codex/exact-video-parity-production`  
Punto de partida: `fee266d` (`origin/main`)  
Clasificación de datos: `SYNTHETIC_DEMO`

## Resultado ejecutivo

El baseline automatizado es reproducible, pero el producto no cumple todavía la paridad exacta ni los controles mínimos de autenticación y permisos. Las pruebas existentes pasan porque verifican contratos parciales; no detectan que la UI acepta credenciales arbitrarias, que `AUDITOR` recibe controles de escritura, que varios filtros no hacen nada ni que la demo autónoma depende de `/api` para el OTP.

No se modificó código de aplicación antes de completar este baseline. Las únicas salidas creadas durante la medición son este informe, el inventario de defectos y las capturas de evidencia.

## Preflight automatizado

| Comando | Resultado | Evidencia |
| --- | --- | --- |
| `npm ci` | PASS | 1 paquete auditado; 0 vulnerabilidades reportadas. |
| `npm run check` | PASS | 29/29 tests, 75/75 controles QA y standalone de 409,844 bytes. |
| `npm run audit:verify` | PASS | 17/17 capítulos, 1,359 eventos, 0 fallos. |
| `npm run codex:preflight` | PASS | 6,389 archivos, 507.54 MiB, 17 clips exactos, 730 detail crops, 0 errores/advertencias. |

## Recorrido de navegador

- SPA servida en `http://127.0.0.1:4173/`; se reutilizó el proceso existente `node scripts/serve.mjs` después de verificar PID, comando y respuesta HTTP 200.
- Se recorrieron 29 rutas representativas con ADMIN, DOCTOR, NURSE, INVENTORY, FINANCE y AUDITOR.
- Todas las rutas renderizaron un `h1` o un bloqueo explícito; no se registraron errores JavaScript o de consola durante el recorrido.
- No se detectó overflow horizontal global a 390×844 en las rutas recorridas.
- La ausencia de error de render no demuestra acción, persistencia, permiso, estado de carga, error o paridad de controles.

## Autenticación y sesión

- Un correo desconocido con contraseña incorrecta inicia sesión como `ADMIN`.
- Un usuario conocido con contraseña incorrecta inicia sesión como `ADMIN`.
- El submit del login ignora por completo la contraseña y aplica fallback al primer usuario.
- El HTML autónomo reproduce el mismo defecto.
- No existe enlace o flujo de recuperación de contraseña en el login observado.
- Los accesos rápidos inician sesión sin validar `Demo2026!`.

Resultado: `QA-P0-001` confirmado y abierto.

## Pacientes y hospitalizaciones

- Pacientes no contiene las pestañas `Activos`, `Inactivos` y `Carga masiva` observadas en CH01.
- Las columnas actuales (`Paciente`, `Contacto`, `Seguro`, `Casos`) sustituyen u omiten `Acciones`, `Nombre completo`, `Empresa` y `Notif. Botmaker/WhatsApp` sin una desviación aprobada.
- No existe selector de cantidad, paginación `Anterior / páginas / Siguiente` ni ordenamiento.
- El selector de estado se renderiza pero no participa en el cálculo del listado.
- Hospitalizaciones repite el defecto del selector de estado sin efecto.
- La búsqueda textual sí vuelve a renderizar, pero no hay estados diferenciados de carga y error; el vacío usa una presentación genérica.

## Dashboard y navegación CH01

- El dashboard actual muestra cuatro métricas distintas de las seis métricas visibles en el video.
- No existe la tabla de pacientes con valores fuera de rango ni sus columnas FC, FR, oxígeno, sistólica, diastólica, temperatura, dolor, glicemia, fecha y recurso.
- Los umbrales clínicos continúan correctamente bloqueados por información del cliente; no se inventaron.
- El menú de usuario ofrece Configuración, Restaurar y Cerrar sesión, pero no presenta de forma equivalente organización y Mi usuario.
- No existe control PWA funcional demostrado; un manifest por sí solo no prueba instalación.

## Roles

- Las rutas deniegan varios módulos de forma coherente para DOCTOR, NURSE, INVENTORY y FINANCE.
- `AUDITOR` recibe todas las rutas y múltiples botones de escritura; por ejemplo, `Nuevo profesional` en Médicos y recursos.
- Los botones se renderizan según la página y no según permiso de acción, por lo que ocultar navegación no asegura separación de funciones.

Resultado: `QA-P0-006` y el control extremo a extremo de permisos permanecen abiertos.

## Standalone y portal

- El archivo `Analiza_en_Casa_Demo_QA.html` abre correctamente desde `file://`.
- El portal muestra la pantalla de verificación, pero `Enviar código de verificación` intenta acceder a `file:///S:/api/portal-request-code`.
- Chrome bloquea la solicitud; la demo muestra “No fue posible completar la solicitud”.
- No existe todavía el modo OTP sintético autónomo requerido.

Resultado: `QA-P0-005` confirmado y abierto.

## Placeholders y éxito aparente

Se confirmaron acciones que muestran mensajes sin completar una operación real: importación de pacientes/catálogos, aplicación de kit, administración de medicamentos, soporte del portal y el handler por defecto `Acción ... registrada para QA`. Deben inventariarse en `PLACEHOLDER_ACTIONS.csv` y eliminarse o convertirse en estados explícitamente deshabilitados.

## Decisión de baseline

El baseline queda congelado como `FUNCTIONAL_RENDER_PARTIAL / NOT_PRODUCTION_READY`. Los defectos observados están en `BASELINE_DEFECTS.csv`. El siguiente trabajo permitido es construir la matriz exacta y cerrar CH01 antes de iniciar CH02.
