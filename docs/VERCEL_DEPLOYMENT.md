# Despliegue en Vercel

1. Crea un repositorio Git y sube el proyecto.
2. En Vercel selecciona **Add New Project**.
3. Importa el repositorio.
4. Framework preset: `Other`.
5. No configures build command.
6. No configures output directory.
7. Agrega las variables de `.env.example`.
8. Define `CRON_SECRET` con un valor aleatorio largo.
9. Despliega.
10. Comprueba:
    - `/api/health`
    - `/api/runtime-config`
    - login demo
    - navegación
    - impresión
    - portal demo

Para modo Supabase cambia `NEXT_PUBLIC_DATA_MODE=supabase`.
