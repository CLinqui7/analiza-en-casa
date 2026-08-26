# Runbook local

## Iniciar, detener y reiniciar

En PowerShell, desde la raíz:

```powershell
npm install
npm start
```

Abra `http://localhost:4173`. Detenga con `Ctrl+C`; reinicie ejecutando de nuevo `npm start`. Para la demo sin servidor abra `Analiza_en_Casa_Demo_QA.html`.

## Logs, puerto y salud

El log aparece en la consola que inició Node. Revise el puerto sin afectar procesos ajenos:

```powershell
Get-NetTCPConnection -LocalPort 4173 -ErrorAction SilentlyContinue
Get-Process -Id <PID>
```

Si hay `EADDRINUSE`, confirme que el PID pertenece a una instancia anterior antes de detenerlo. No borre `node_modules`, evidencia ni migraciones para resolver un puerto ocupado.

## Diagnóstico y recuperación

```powershell
npm test
npm run qa
npm run audit:verify
npm run codex:preflight
git status --short --branch
git log --oneline -10
```

El modo `mock` puede reiniciarse desde la interfaz o limpiando sólo el storage del navegador. Si Supabase falla, deje `DATA_MODE=mock` para demo y registre el error remoto; no desactive RLS.

## Rollback

1. Identifique el commit estable remoto con `git log --oneline`.
2. Para Vercel, promueva el deployment previo desde el panel o cree un nuevo preview desde el commit estable.
3. Para base de datos, aplique una migración compensatoria revisada; no edite ni elimine migraciones ya aplicadas y no use `reset` en producción.
4. Documente el incidente, actor, alcance y auditoría preservada antes de reintentar.
