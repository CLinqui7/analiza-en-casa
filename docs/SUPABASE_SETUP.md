# Configuración de Supabase

## Orden

1. Esquema.
2. Seguridad/RLS/funciones.
3. Índices/permisos/storage.
4. Seed sintético.
5. Crear usuario Auth.
6. Asignar rol.
7. Probar RLS con cada perfil.

## Pruebas mínimas de RLS

- Usuario de organización A no lee organización B.
- Enfermería no registra pagos.
- Finanzas no modifica notas clínicas.
- Auditor no escribe.
- Documento firmado no se edita sin `clinical:correct_signed`.
- Portal no consulta tablas directamente.
- Bucket clínico no genera URL pública.
- Service role nunca llega al navegador.

## Storage

Rutas:

```text
<organization-id>/clinical/<hospitalization-id>/<file>
<organization-id>/financial/<quote-id>/<file>
<organization-id>/templates/<template-code>/<file>
```
