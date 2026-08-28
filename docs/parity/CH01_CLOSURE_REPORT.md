# Cierre secuencial de CH01

Fecha: 2026-08-26 (America/El_Salvador)

## Resultado

CH01 queda cerrado para poder iniciar CH02: la matriz tiene **0 `MISSING`** y **0 `CONFLICTS_WITH_VIDEO`** no bloqueados. Sus 46 requisitos se distribuyen en 6 `IMPLEMENTED_EXACT`, 33 `IMPLEMENTED_PARTIAL` y 7 `NEEDS_CLIENT_CONFIRMATION`.

La clasificación exacta y sus rutas de evidencia están en `EXACT_VIDEO_PARITY_MATRIX.json`. No se atribuye paridad exacta a requisitos sin prueba específica o sin validación de Supabase en un entorno conectado.

## Evidencia revisada

- Se abrieron los 24 event frames y los 11 detail crops de CH01, además de los contact sheets de eventos y seguridad.
- `video-audit-reviews/CH01_contexto_inicial_acceso_dashboard_y_listado_de_pacientes/event_review_notes.csv` contiene una observación no vacía para cada evento CH01-E0001–CH01-E0024.
- El clip exacto no fue necesario para resolver ambigüedades restantes después de revisar la secuencia de frames y crops; las transiciones ajenas al producto permanecen clasificadas como contexto o incertidumbre, no como funciones.

## Cambios cerrados

- Autenticación demo sin fallback: correo conocido y contraseña exacta `Demo2026!`; error genérico y recuperación anti-enumeración.
- Adaptador Supabase Auth separado del modo demo, sin mezclar semilla local con datos remotos.
- Pestañas Activos/Inactivos/Carga masiva, validación CSV atómica en demo, columnas observadas, búsqueda, tamaño de página, paginación y orden accesible.
- Estados de carga, vacío y error mutuamente excluyentes.
- Navegación jerárquica con los seis grupos observados, estado activo y sidebar compacto/expandido.
- Seis métricas del dashboard y tabla con las doce columnas observadas; ninguna regla clínica fue inventada.
- Organización activa, Mi usuario y cierre de sesión.
- PWA condicionada a `beforeinstallprompt` y shell cacheado sin API ni evidencia.
- AUDITOR de sólo lectura en navegación, acciones, formularios y store; la configuración se muestra deshabilitada.
- HTML autónomo con OTP exclusivamente sintético (`202626`), rotulado y anti-enumeración, sin dependencia de `/api`.

## Bloqueos del cliente

Los siete requisitos bloqueados se relacionan sólo con `CH01-Q002`, `CH01-Q003` o `CH01-Q005`: fórmulas/períodos de métricas, umbrales clínicos, incidentes y reglas/consentimiento de Botmaker. Los placeholders seguros están visibles y no se presentan como reglas reales.

## Verificación

- `npm test`: 33/33.
- `npm run qa`: 75/75.
- `npm run test:browser:ch01`: 5/5 en Chrome headless.
- `npm run build:standalone`: generado correctamente.
- `npm run audit:verify`: 17/17 capítulos estructuralmente verificados, 1,359 eventos, sin errores de ledger/evidencia.
- Desktop 1440×900 y móvil 390×844: sin errores de página/consola en los recorridos CH01 y sin desbordamiento horizontal global en las rutas comprobadas.

## Límite explícito

El adaptador de Supabase está implementado y fijado a `@supabase/supabase-js@2.112.4`, pero no se marca paridad exacta de persistencia remota porque este repositorio no contiene credenciales ni un proyecto de prueba conectado. Ninguna clave de servicio fue añadida al navegador ni al repositorio.
