# Arquitectura propuesta

## Objetivo

Mantener una aplicación que funcione inmediatamente en modo QA, pero que pueda cambiar a persistencia Supabase sin reescribir la interfaz.

```text
Navegador
  ├─ UI y rutas hash
  ├─ App Store
  │    ├─ localStorage, modo QA
  │    └─ Supabase Adapter, modo productivo
  ├─ Impresión / plantillas
  └─ Portal externo

Vercel Functions
  ├─ Runtime config
  ├─ Health
  ├─ Mensajería segura
  ├─ Portal status
  └─ Retry worker

Supabase
  ├─ Auth
  ├─ PostgreSQL
  ├─ RLS
  ├─ Storage privado
  ├─ RPC transaccionales
  └─ Auditoría
```

## Decisiones

1. **Modo dual:** el producto se puede validar sin infraestructura. En modo Supabase usa el mismo contrato de datos.
2. **RLS por organización:** ningún cliente debe depender únicamente de filtros del frontend.
3. **Operaciones sensibles server-side:** mensajería, portal y jobs no reciben claves de servicio en el navegador.
4. **Eventos y versiones:** cotizaciones enviadas, pagos, inventario y documentos firmados no se sobrescriben silenciosamente.
5. **Idempotencia:** reintentos no deben duplicar pagos, movimientos o mensajes.
6. **Plantillas provisionales:** la estructura es reemplazable cuando el cliente entregue formatos oficiales.
7. **Auditoría append-only:** no existe política de actualización o eliminación para la bitácora.
8. **Datos sintéticos:** fixtures claramente identificados para evitar confusión con producción.

## Escalamiento recomendado

Para una segunda versión:

- Mover la SPA a Next.js App Router si se requiere SSR, middleware complejo o múltiples portales.
- Añadir cola gestionada para mensajería.
- Crear Edge Functions separadas por proveedor.
- Implementar pruebas RLS en CI contra Supabase local.
- Introducir versionado formal de APIs.
- Añadir observabilidad, alertas y trazas.
