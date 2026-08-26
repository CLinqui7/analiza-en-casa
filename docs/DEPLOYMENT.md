# Despliegue

El despliegue objetivo es Vercel desde GitHub, empezando siempre con preview. No haga merge ni producción desde esta rama sin aprobación.

1. Confirme `npm run check`, `npm run audit:verify` y `npm run codex:preflight`.
2. Importe `CLinqui7/analiza-en-casa` en Vercel con preset **Other**.
3. Configure las variables de [`.env.example`](../.env.example), separando variables publicables de secretos server-side.
4. Conecte el proyecto Supabase de prueba y aplique migraciones antes de elegir `DATA_MODE=supabase`.
5. Cree un preview de `codex/overnight-audit-hardening`, compruebe `/`, `/api/health`, login demo y una ruta protegida.
6. Registre URL, commit, fecha, smoke tests y resultado en `docs/overnight/DEPLOYMENT_STATUS.md`.

Nunca defina `SUPABASE_SERVICE_ROLE_KEY`, tokens de proveedor o `CRON_SECRET` como variables `NEXT_PUBLIC_*`.
