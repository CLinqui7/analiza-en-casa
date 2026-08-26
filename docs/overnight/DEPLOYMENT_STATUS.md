# Deployment status

`STATUS=READY_REQUIRES_AUTH`

Fecha de revisión: 2026-08-26.

No se creó preview remoto: Vercel CLI no está instalada/autenticada en este entorno y no se usó un token. El repositorio y `vercel.json` están listos para conectar desde GitHub.

Siguientes pasos:

1. Instale/inicie sesión en Vercel CLI o importe el repositorio en el panel.
2. Configure las variables indicadas en `docs/VERCEL_SETUP.md`, sin secretos `NEXT_PUBLIC_*`.
3. Cree un preview de `codex/overnight-audit-hardening`.
4. Ejecute smoke tests de `/`, `/api/health`, login demo, portal y ruta de auditoría.
5. Registre URL, commit y resultados aquí y en el pull request.
