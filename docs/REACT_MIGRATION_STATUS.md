# Estado de migración React

`apps/web` es la aplicación principal para desarrollo y build. No usa iframe, `dangerouslySetInnerHTML`, ni carga `app/main.js` o el demo heredado. `npm run react:boundaries` lo verifica de forma estática.

La referencia previa se conserva temporalmente para reproducir los 17 capítulos y sus pruebas mientras los módulos restantes se trasladan con paridad demostrable. Esta separación evita envolver HTML heredado o introducir dos árboles de estado en la aplicación React.

Módulos ya funcionales en React: panel, pacientes, reporte de salud, acciones operativas, tablero de enfermería, horas de enfermería, seguros con guardas explícitas, kárdex y ayuda. Las pantallas de evoluciones y seguros no automatizan reglas no aprobadas; explicitan sus guardas hasta tener contrato de cliente y Supabase.

La revisión visual manual quedó registrada en `docs/react/screenshots/dashboard-1440x900.png` y `docs/react/screenshots/kardex-mobile-390x844.png`.
