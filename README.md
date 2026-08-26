# Analiza en Casa · Production QA
## Entrega nocturna para Codex

Este paquete incluye la evidencia completa de los 17 capítulos, ledgers verificables, instrucciones `AGENTS.md`, CI y un prompt maestro. Empieza en `CODEX_AND_GITHUB_START_HERE.md` y usa `codex/PROMPT_OVERNIGHT_MASTER.md`.

Antes de subir a GitHub ejecuta `UPLOAD_TO_GITHUB.bat`.


Plataforma integral de atención domiciliar reconstruida a partir del video funcional de referencia y las mejoras solicitadas. Este repositorio incluye una aplicación interactiva, datos ficticios, preparación para Supabase, configuración para Vercel, migraciones SQL, RLS, pruebas y una matriz de cobertura de los 17 capítulos del video.

> **Clasificación del entorno:** `SYNTHETIC_DEMO`. No contiene datos reales de pacientes.

## Qué incluye

- Dashboard operativo.
- Pacientes, responsables, direcciones, seguro y notificaciones.
- Hospitalizaciones como expediente central.
- Cotizaciones por servicios, estudios, medicamentos, insumos, equipos, honorarios y extras.
- Versionado, descuentos, cobertura, monto del paciente, impresión y mensajería.
- Preautorizaciones, solicitudes de información, aprobación, rechazo y reclamo.
- Cuentas por cobrar, pagos, referencias únicas y comprobantes.
- Portal seguro del paciente con línea de tiempo, resumen financiero y QR demostrativo.
- Reporte de salud, orden médica, plan de cuidados, evolución, signos vitales y notas.
- Tarjeta de medicamentos y administración.
- Agenda y turnos.
- Compras, proveedores, factura, IVA y recepción.
- Inventario, lotes, series, comprometidos, acuses, movimientos, cierres, bodegas y kits.
- Cuentas por pagar y estados de cuenta médicos.
- Catálogos, tarifas y descuentos por categoría.
- Auditoría y QA de cobertura video vs. plataforma.

## Inicio inmediato

### Sin instalar nada

Abre directamente:

```text
Analiza_en_Casa_Demo_QA.html
```

Ese archivo autónomo contiene CSS, JavaScript y datos ficticios en una sola pieza. Funciona con doble clic y también sirve como demo para validación funcional.


### Windows

1. Extrae el ZIP.
2. Abre la carpeta.
3. Ejecuta `START_WINDOWS.bat`.
4. Abre `http://localhost:4173`.

### macOS o Linux

```bash
chmod +x START_MAC_LINUX.sh
./START_MAC_LINUX.sh
```

También puedes ejecutar:

```bash
npm start
```

El proyecto no requiere instalar paquetes externos para funcionar en modo QA.

## Credenciales de demostración

| Perfil | Correo | Contraseña |
|---|---|---|
| Administración | `admin@analiza.demo` | `Demo2026!` |
| Médico | `medico@analiza.demo` | `Demo2026!` |
| Enfermería | `enfermeria@analiza.demo` | `Demo2026!` |
| Inventario | `inventario@analiza.demo` | `Demo2026!` |
| Finanzas | `finanzas@analiza.demo` | `Demo2026!` |
| Auditoría | `auditoria@analiza.demo` | `Demo2026!` |

En el modo local la contraseña es ilustrativa. La autenticación productiva se realiza con Supabase Auth.

## Pruebas

```bash
npm test
npm run qa
npm run check
```

Los resultados se guardan en:

- `docs/QA_AUTOMATED_RESULTS.json`
- `docs/QA_AUTOMATED_RESULTS.md`
- `docs/QA_BROWSER_RESULTS.json`
- `docs/QA_BROWSER_RESULTS.md`

## Estructura

```text
.
├── index.html
├── app/
│   ├── main.js
│   ├── views.js
│   ├── store.js
│   ├── domain.js
│   ├── mock-data.js
│   ├── supabase-adapter.js
│   ├── templates.js
│   └── styles.css
├── api/
│   ├── runtime-config.js
│   ├── health.js
│   ├── notifications.js
│   ├── portal-status.js
│   └── cron-retries.js
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── scripts/
├── tests/
├── docs/
├── vercel.json
└── .env.example
```

## Activar Supabase

1. Crea un proyecto vacío de Supabase.
2. Ejecuta, en orden:
   - `supabase/migrations/202608260001_initial_schema.sql`
   - `supabase/migrations/202608260002_security_rls_functions.sql`
   - `supabase/migrations/202608260003_indexes_permissions_storage.sql`
   - `supabase/seed.sql`
3. Crea un usuario en Supabase Auth con metadata:

```json
{
  "full_name": "Nombre del usuario",
  "organization_id": "00000000-0000-0000-0000-000000000001"
}
```

4. Asigna el rol usando la instrucción al final de `supabase/seed.sql`.
5. Copia `.env.example` a `.env.local`.
6. Configura:

```env
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

7. Reinicia el servidor.

La aplicación conserva un fallback local cuando Supabase no está disponible. En producción se recomienda bloquear el fallback con una política de despliegue una vez terminada la migración.

## Desplegar en Vercel

1. Sube la carpeta a un repositorio Git.
2. Importa el repositorio en Vercel.
3. Framework preset: **Other**.
4. Build command: dejar vacío.
5. Output directory: dejar vacío.
6. Agrega las variables de `.env.example`.
7. Define `CRON_SECRET`.
8. Despliega.

`vercel.json` incluye encabezados de seguridad y el job de reintentos de mensajería.

## Seguridad implementada en la preparación

- RLS por organización.
- Roles y permisos.
- Buckets privados.
- Portal con token hash, vencimiento, código adicional y anti-enumeración.
- Pagos, movimientos y notificaciones con llaves de idempotencia.
- Versiones de cotización inmutables después de envío.
- Documentos clínicos firmados protegidos.
- Notas de enfermería bloqueadas después de firma.
- Auditoría append-only.
- Mensajes externos sin diagnóstico ni contenido clínico.
- Service role limitado a funciones server-side.

## Límites que deben cerrarse antes de pacientes reales

El sistema está listo para prueba funcional y desarrollo productivo, pero no debe operar con información real hasta completar:

1. Validación legal y de privacidad aplicable.
2. Plantillas oficiales de todos los documentos impresos.
3. Catálogos, precios y fórmulas reales.
4. Reglas de seguro y aprobación.
5. Firma clínica y política de correcciones.
6. Retención, respaldo, recuperación y continuidad.
7. Pruebas de penetración y revisión de RLS.
8. UAT formal con usuarios autorizados.
9. Configuración de proveedores de mensajería.
10. Consentimientos y política de envío de información.

Consulta `docs/QA_PRE_CODEX.md`, `docs/QA_BROWSER_RESULTS.md` y `docs/OPEN_GAPS.md`.

## Uso de Codex después de esta prueba

Este proyecto ya sirve como baseline. Codex debe trabajar sobre tareas pequeñas, siempre con:

- Objetivo.
- Archivos permitidos.
- Reglas de negocio.
- Criterios de aceptación.
- Pruebas obligatorias.
- Prohibición de inventar datos o reglas.
- Revisión del diff antes de merge.

El prompt recomendado está en `docs/PROMPT_CODEX_NEXT_PHASE.md`.
