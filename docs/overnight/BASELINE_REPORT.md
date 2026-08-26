# Baseline report

## Alcance y entorno

- Fecha de ejecución: 2026-08-25 (America/El_Salvador).
- Rama: `codex/overnight-audit-hardening`, creada desde `bd43e31` después de `git fetch origin --prune`.
- Clasificación: `SYNTHETIC_DEMO`; no se usaron datos reales ni credenciales.
- Servidor: la primera ejecución encontró `EADDRINUSE` en 4173. El proceso existente era `node scripts/serve.mjs`, respondió 200 y expuso el título esperado, por lo que se reutilizó sin terminarlo.
- Navegador: Microsoft Edge headless controlado con Playwright 1.62.1 del runtime local, sin agregar dependencias al proyecto.

## Preflight y pruebas iniciales

| Comando | Resultado | Evidencia resumida |
|---|---|---|
| `npm ci` | PASS | 1 paquete auditado, 0 vulnerabilidades. |
| `npm run codex:preflight` | PASS | 6,208 archivos, 478.43 MiB, 17 capítulos, 1,359 eventos, 730 detail crops, 17 clips exactos, 0 errores y 0 advertencias. |
| `npm run check` | PASS | 9/9 pruebas de dominio, 75/75 controles QA, standalone de 365,878 bytes. |
| `npm run audit:status` | INCOMPLETO ESPERADO | 0/17 capítulos con eventos revisados; los 1,359 renglones son plantillas sin observaciones. |
| `supabase --version` | NO DISPONIBLE | El CLI no está instalado en el entorno local; no se ejecutó una base local ni pruebas RLS reales. |

## Recorrido de navegador

- Escritorio 1440×900: 33/33 rutas cargaron con un único `h1`, sin `[object Object]`, `undefined` ni `NaN`, sin overflow global.
- Móvil 390×844: 33/33 rutas cargaron y ninguna produjo overflow horizontal del documento.
- Consola y página: 0 errores.
- Perfiles: 6/6 recorridos correctos.
  - Administración: dashboard permitido.
  - Médico: cuentas por cobrar bloqueada.
  - Enfermería: compras bloqueada.
  - Inventario: clínica bloqueada.
  - Finanzas: clínica bloqueada.
  - Auditoría: auditoría permitida.
- Portal demo: `#/portal/demo-qt-2026-0148` cargó en escritorio y móvil con información sintética.
- Accesibilidad básica: todos los botones inspeccionados tienen nombre accesible y el foco nativo es visible. Se detectaron dos instancias de controles de filtro sin etiqueta accesible, una en Pacientes y otra en Hospitalizaciones.

Capturas:

- `docs/overnight/screenshots/baseline-dashboard-desktop.png`
- `docs/overnight/screenshots/baseline-dashboard-mobile.png`
- `docs/overnight/screenshots/baseline-quote-desktop.png`
- `docs/overnight/screenshots/baseline-portal-desktop.png`
- `docs/overnight/screenshots/baseline-portal-mobile.png`

## API local

| Caso | HTTP | Resultado |
|---|---:|---|
| `/` | 200 | HTML esperado. |
| `/manifest.webmanifest` | 200 | Manifiesto disponible. |
| `/api/health` | 200 | Estado `ok`; Supabase no configurado. |
| `/api/runtime-config` | 200 | Modo mock, sin claves. |
| Notificación SMS administrativa permitida | 202 | Destino enmascarado y preview sin contenido clínico. |
| Plantilla clínica no permitida | 400 | Bloqueada. |
| Portal con datos incompletos | 400 | Respuesta genérica anti-enumeración. |

## Seguridad y datos

- Solo `.env.example` está versionado; no se encontraron valores secretos versionados.
- Las referencias a `SUPABASE_SERVICE_ROLE_KEY` están limitadas a `api/`.
- Las tablas principales declaran RLS y organización, pero no hubo ejecución contra PostgreSQL local.
- Hallazgos iniciales que requieren confirmación durante la auditoría y corrección P0 si quedan no bloqueados:
  1. El portal mock muestra datos con el token de la URL sin pedir segunda verificación ni comprobar vencimiento; solo es aceptable como demostración sintética y no como acceso productivo.
  2. `reviseQuote` incrementa la versión sobre el mismo objeto local y no conserva el snapshot enviado anterior.
  3. `updateClinicalDocument` permite a roles distintos de enfermería mutar un documento firmado sin motivo de corrección ni copia inmutable de la versión firmada.
  4. Varias funciones SQL `SECURITY DEFINER` viven en `public`; se debe verificar y restringir `EXECUTE`, `search_path`, autorización y alcance organizacional.
  5. `bootstrap_new_user` acepta `organization_id` desde `raw_user_meta_data`, controlable por el usuario, y no debe usarse como fuente de autorización.
  6. El endpoint live de notificaciones recibe `organizationId` del cuerpo y no demuestra autenticación ni idempotencia determinista en el límite HTTP.

## Decisión de baseline

El baseline funcional es reproducible y está verde en modo demo. No está aprobado para datos reales ni para producción: faltan la auditoría verificable de video, pruebas RLS reales, correcciones de seguridad e integridad, reglas/plantillas del cliente, UAT y validaciones externas. La siguiente fase es la revisión forense de los 17 capítulos; no se modificó código de aplicación antes de guardar este reporte.
