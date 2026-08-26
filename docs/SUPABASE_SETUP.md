# Configuración de Supabase

Este procedimiento prepara un proyecto vacío con datos sintéticos. No aplique `seed.sql` a producción sin aprobación explícita.

## Pre-requisitos

- Supabase CLI autenticado y Docker Desktop activo para desarrollo local, o acceso al SQL Editor de un proyecto de prueba.
- Una clave publishable para el navegador y secretos server-side guardados sólo en Vercel/Supabase.

## Aplicación ordenada

Ejecute, una sola vez y en orden, las migraciones siguientes:

1. `202608260001_initial_schema.sql`
2. `202608260002_security_rls_functions.sql`
3. `202608260003_indexes_permissions_storage.sql`
4. `202608260004_p0_organization_portal_hardening.sql`
5. `202608260005_p0_quote_clinical_immutability.sql`
6. `202608260006_p0_notifications_payments_inventory.sql`

Después ejecute `supabase/seed.sql` sólo en el entorno de prueba. La migración 006 añade la cola `notification_attempt`, comprobantes/asignaciones de pago, reversión auditada y RPC atómica para inventario.

En PowerShell, cuando el CLI esté disponible:

```powershell
supabase link --project-ref TU_PROJECT_REF
supabase db push
supabase db reset --linked       # sólo en una base de prueba desechable
```

No ejecute `db reset --linked` contra una base con información que deba conservarse.

## Configuración de la aplicación

En `.env.local` use `DATA_MODE=supabase`, `SUPABASE_URL` y una clave publishable. En Vercel defina las variables server-side `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET`; no las prefije con `NEXT_PUBLIC_`.

## Verificación RLS obligatoria

Con dos organizaciones y usuarios de cada rol, pruebe:

- No lectura/escritura entre organizaciones.
- Enfermería no registra pagos; Finanzas no modifica notas clínicas firmadas.
- Sólo `clinical:correct_signed` crea correcciones/anulaciones.
- Versiones enviadas y sus ítems no se actualizan/eliminan.
- `queue_notification` ignora organización y destino del navegador, exige destinatario registrado y deduplica.
- `apply_payment` bloquea sobrepago, referencia y clave duplicada; `reverse_payment` preserva recibo y auditoría.
- `apply_inventory_movement_v2` bloquea stock/lote/reserva insuficiente y deduplica sin segundo movimiento.
- Buckets privados no conceden URL pública y el portal no consulta tablas directamente.

## Estado de esta entrega

`NEEDS_REAL_SUPABASE_VALIDATION`: no había Supabase CLI ni daemon Docker disponible durante esta ejecución. Las migraciones y contratos fueron revisados estáticamente y cubiertos por pruebas focalizadas, pero no se afirma ejecución real de RLS, triggers, RPC o concurrencia.
