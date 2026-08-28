# Próximo paso

- Punto de reanudación: `CH17-R001`.
- Antes de editar, comprobar rama y estado, y leer `docs/parity/PROGRESS.md`, la matriz exacta y únicamente la evidencia delimitada de CH17. No reiniciar ni reauditar CH01–CH16.
- Iniciar CH17 ampliando el generador y la matriz exacta con la raíz de evidencia y los requisitos del capítulo; después implementar cada brecha de forma incremental.
- Alcance de evidencia ya revisado para CH17: lista y acción del reporte (R001), rango de fechas (R002), pestañas y secciones anidadas (R003), antecedentes y alergias (R004), signos vitales anidados (R005), y notas de enfermería con impresión/acción (R006).
- Preservar el flujo de documentos firmados y correcciones auditadas; no incluir contenido clínico en canales de mensajería o correo no seguros.
- Validación requerida: pruebas focales de CH17 y navegador, seguido de `npm run check` y `npm run audit:verify`; actualizar la matriz, progreso y preguntas abiertas antes de hacer commit y push.
- La validación de migraciones y RLS de Supabase contra una instancia real sigue pendiente: no hay CLI ni proyecto configurado y el daemon local de Docker no está activo.
