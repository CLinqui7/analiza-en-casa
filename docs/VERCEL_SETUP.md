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

Use preview antes de producción. Si se instala el CLI y existe sesión: `vercel` para preview; no use `vercel --prod` en esta tarea. Consulte [DEPLOYMENT.md](DEPLOYMENT.md) para smoke tests.
