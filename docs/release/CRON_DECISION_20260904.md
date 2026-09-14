# Decisión de scheduler / cron · 2026-09-04

## Decisión

Para la fase actual de staging y validación final, **no se usará el cron automático de 15 minutos**.

El endpoint `api/cron-retries.js` se conserva en el código para no destruir la capacidad de reintento futura, pero `vercel.json` no programará llamadas automáticas.

## Qué era el cron

El cron era un temporizador de Vercel que llamaba automáticamente a `/api/cron-retries` cada 15 minutos. Su propósito era reintentar trabajo pendiente, principalmente tareas de entrega/integración que todavía no tienen proveedores productivos certificados.

## Motivo

- El plan Vercel Hobby rechaza esa frecuencia.
- Los proveedores reales todavía no están habilitados/certificados.
- No es necesario para revisar la interfaz, ejecutar QA, validar Supabase staging o completar UAT.
- No se sustituye silenciosamente por otra frecuencia.

## Producción futura

Si posteriormente se requiere reintento automático, deberá aprobarse un scheduler compatible (Vercel Pro u otro servicio) y volver a certificar el flujo con sus secretos, idempotencia, auditoría y proveedor real.
