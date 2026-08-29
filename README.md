# Analiza en Casa

Analiza en Casa es una aplicación web de demostración para la operación de atención domiciliar. Reconstruye los flujos visibles de 17 capítulos de referencia y añade controles de seguridad, trazabilidad e integridad para una evolución productiva.

> Estado: `SYNTHETIC_DEMO`. Todos los usuarios, pacientes, pagos, documentos y catálogos son ficticios. No use este repositorio con datos reales sin completar la lista de producción.

## Objetivo y módulos

El sistema concentra pacientes, responsables, hospitalizaciones, cotizaciones versionadas, preautorizaciones, cobros, portal del paciente, documentos clínicos, agenda, compras, inventario, kits, cuentas por pagar, catálogos, auditoría y QA de paridad del video.

Los seis controles P0 están implementados a nivel de aplicación, contrato SQL y prueba estática/focalizada. Su estado es `IMPLEMENTED_PARTIAL` hasta ejecutar las migraciones y pruebas de RLS/RPC contra un proyecto Supabase real. La matriz trazable está en [docs/VIDEO_VS_PLATFORM_GAP_MATRIX.csv](docs/VIDEO_VS_PLATFORM_GAP_MATRIX.csv).

## Arquitectura actual

- `apps/web/`: aplicación principal Next.js App Router con React y TypeScript estricto.
- `packages/domain/`: lógica pura de búsqueda, formatos configurables, mediciones, CSV y kárdex.
- `packages/contracts/`: contratos Zod y tipos compartidos.
- `packages/ui/`: diálogo y componentes visuales reutilizables.
- `packages/testing/`: utilidades de prueba compartidas.
- `legacy-demo/`: referencia temporal de la SPA previa; sus archivos permanecen en la raíz mientras se completa la migración y nunca se cargan dentro de React.
- `api/`: funciones server-side para portal y cola segura de notificaciones.
- `supabase/migrations/`: esquema incremental, RLS, RPCs y auditoría.
- `supabase/seed.sql`: datos exclusivamente sintéticos.
- `tests/` y `scripts/`: pruebas de dominio, contratos P0, QA, build y verificadores.
- `Analiza_en_Casa_Demo_QA.html`: build autónomo para una demo offline.

## Requisitos

- Node.js 20 o posterior (`node --version`).
- Git.
- Opcional para validación persistente: Supabase CLI y Docker Desktop en ejecución.
- Opcional para preview: Vercel CLI autenticado o importación desde el panel de Vercel.

## Descargar e iniciar en Windows PowerShell

```powershell
git clone https://github.com/CLinqui7/analiza-en-casa.git
Set-Location analiza-en-casa
git switch codex/client-audio-selenium-hardening
npm ci
npm run qa:local
npm run dev
```

Abra `http://localhost:3000`. Para detener el servidor, presione `Ctrl+C` en la misma consola. El demo heredado se mantiene sólo como respaldo de evidencia y se inicia explícitamente con `npm run start:legacy` en `http://localhost:4173`; también existe `Analiza_en_Casa_Demo_QA.html` para la demo autónoma.

Si aparece `EADDRINUSE`, el puerto 4173 ya está ocupado. Identifique el proceso con `Get-NetTCPConnection -LocalPort 4173`, detenga únicamente el proceso que corresponda o ejecute la app en otro puerto si el script admite su variable de puerto. No finalice procesos desconocidos.

## Variables de entorno

Copie `.env.example` a `.env.local`; nunca suba ese archivo ni secretos al repositorio.

```powershell
Copy-Item .env.example .env.local
```

Para modo local basta `DATA_MODE=mock`. Para Supabase configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y los equivalentes `NEXT_PUBLIC_*` necesarios para el navegador. Sólo las claves publicables/anon pueden ir al cliente. `SUPABASE_SERVICE_ROLE_KEY`, tokens de WhatsApp/SMS/email y `CRON_SECRET` son exclusivamente server-side en Vercel/Supabase.

## Comandos frecuentes

```powershell
npm run dev               # aplicación React principal
npm run build             # build optimizado de Next.js
npm test                  # regresiones del demo heredado
npm run test:react        # pruebas Vitest de dominio React
npm run test:browser:react # Playwright + axe sobre React
npm run test:browser:quotes # Playwright focalizado de Cotizaciones React
npm run test:selenium     # Selenium + Chrome sin autenticación
npm run qa:local          # compuerta local completa
npm run check             # regresiones heredadas + QA + demo autónoma
npm run audit:verify      # integridad de los 17 capítulos
npm run audit:master      # regenera matrices desde el JSON canónico
npm run codex:preflight   # preflight del repositorio/evidencia
npm run react:boundaries  # impide iframe, HTML peligroso y carga del demo en React
npm run inventory:generate # regenera inventarios funcionales y de textos
git status --short --branch
```

Los resultados de QA se escriben en `docs/QA_AUTOMATED_RESULTS.*`; las capturas y resultados de navegador de baseline están en `docs/QA_BROWSER_RESULTS.*`.

## Usuarios demo y roles

El demo heredado conserva seis roles sintéticos para sus regresiones: Administración, Médico, Enfermería, Inventario, Finanzas y Auditoría. Las claves de prueba no se publican ni se almacenan en claro en código productivo; las pruebas las construyen localmente. En producción, Supabase Auth, invitaciones verificadas, RLS y permisos reemplazan ese mecanismo.

## Seguridad y límites

- Organización, permiso y destinatario se validan en servidor/RPC; el navegador no envía `organization_id`, teléfono, correo, contenido clínico ni service-role.
- El portal requiere token hasheado, expiración, OTP y respuestas anti-enumeración.
- Cotizaciones enviadas, pagos, movimientos y documentos firmados conservan historial y auditoría; una corrección/reversión es una nueva evidencia, no un borrado.
- Mensajería usa plantillas administrativas genéricas y proveedor simulado hasta recibir credenciales. `SIMULATED` nunca significa entrega real.
- La firma clínica actual es metadato de aplicación, no una firma electrónica legal.

Faltan confirmaciones del cliente sobre firmas legales, reglas clínicas, precios, seguros, impuestos, retención, consentimiento, proveedores y reglas de operación. Consulte [docs/MASTER_OPEN_QUESTIONS.md](docs/MASTER_OPEN_QUESTIONS.md) y [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md).

## Supabase y Vercel

Use [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) para aplicar las seis migraciones, cargar el seed sintético y ejecutar la matriz RLS. Use [docs/VERCEL_SETUP.md](docs/VERCEL_SETUP.md) y [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para el preview. El estado actual está en [docs/overnight/DEPLOYMENT_STATUS.md](docs/overnight/DEPLOYMENT_STATUS.md).

## Estructura

```text
app/                 interfaz y lógica de demo
apps/web/            aplicación React / Next.js principal
packages/            dominio, contratos, UI y pruebas compartidas
legacy-demo/         documentación de la referencia temporal heredada
api/                 endpoints server-side
supabase/            migraciones, RLS, seed sintético
tests/               pruebas de dominio y P0
scripts/             QA, build y auditoría
docs/                runbooks, matrices y handoff
references/          evidencia inmutable de video
video-audit-reviews/ ledgers de revisión
```

Para operación, recuperación y rollback consulte [docs/RUNBOOK.md](docs/RUNBOOK.md). Para la entrega completa consulte [docs/FINAL_HANDOFF.md](docs/FINAL_HANDOFF.md).
