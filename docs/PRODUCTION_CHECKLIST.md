# Checklist de producción

- [ ] Cliente confirma reglas clínicas, cobertura, precios, impuestos, descuentos y retención.
- [ ] Revisión legal de privacidad, consentimiento, firma electrónica y comunicaciones.
- [ ] Supabase real aplica las seis migraciones y supera la matriz RLS/RPC de `SUPABASE_SETUP.md`.
- [ ] Dos organizaciones y todos los roles pasan pruebas de aislamiento.
- [ ] Proveedores reales configurados sólo con secretos server-side; reintentos y webhooks verificados.
- [ ] Backup, recuperación, monitoreo, alertas y owner de incidentes definidos.
- [ ] Escaneo de dependencias, revisión de seguridad y prueba de penetración completados.
- [ ] Preview validado en escritorio y móvil; no hay overflow, errores de consola ni acciones duplicadas.
- [ ] UAT formal aprueba flujos de cotización, pagos, clínica, portal e inventario.
- [ ] Plan de rollback y ventana de despliegue aprobados.

No se autoriza producción mientras alguna casilla material siga pendiente.
