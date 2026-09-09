# Preparación de Vercel

`vercel.json` contiene los encabezados de seguridad y el cron de reintentos. La función cron requiere `CRON_SECRET`; sin esa variable responde 401 y no procesa cola.

Variables públicas permitidas:

- `NEXT_PUBLIC_DATA_MODE`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Variables privadas:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- Credenciales de WhatsApp, SMS o correo, si el cliente las aprueba
- Para MongoDB: `ANALIZA_DATA_MODE=mongodb`, `MONGODB_URI`, `MONGODB_DB=analiza_en_casa` y
  `MONGODB_BOOTSTRAP_TOKEN`. Ninguna de estas variables usa el prefijo `NEXT_PUBLIC_`.
- Sólo para la inicialización privada de un único administrador: `MONGODB_INITIAL_ADMIN_EMAIL`,
  `MONGODB_INITIAL_ADMIN_PASSWORD` y `MONGODB_INITIAL_ORGANIZATION_ID`. Retírelas después de
  ejecutar el bootstrap y no las configure en el navegador.

El operador debe ejecutar `npm run mongo:bootstrap --workspace=@analiza/web -- --dry-run` antes
de aplicar el esquema. Tras una revisión, `npm run mongo:bootstrap --workspace=@analiza/web` crea
índices idempotentes; agregue `--initialize-admin` únicamente durante el primer aprovisionamiento
auditado. No inserta pacientes ni datos clínicos.

Use preview antes de producción. Si se instala el CLI y existe sesión: `vercel` para preview; no use `vercel --prod` en esta tarea. Consulte [DEPLOYMENT.md](DEPLOYMENT.md) para smoke tests.
