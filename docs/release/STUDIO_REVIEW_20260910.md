# Revisión del candidato React Studio

Base preservada: `c47bb2ae94d08152836d9a98fc001d6dba043440`, rama `codex/ui-polish-final-20260904`. Revisión equivalente de diff realizada por el único escritor; no se alteraron fuentes del video, commits anteriores ni `main`.

## Hallazgos corregidos

- El fetch extraído perdía su receptor en navegador; el proveedor Mongo usa una función envolvente.
- La carga inicial de workspace competía con la sesión; ahora espera identidad y cancela cargas obsoletas.
- El formulario de paciente ocultaba el fallo de guardado detrás del modal; muestra error en el pie y no se cierra ni guarda localmente tras un POST fallido.
- La edición de hospitalización no recibía los repositorios para validar cuentas de enfermería; ambos endpoints los reciben y derivan los usuarios en el servidor.
- El movimiento de inventario validaba sólo el identificador en reintentos; ahora exige el mismo contenido y prueba rechazo de cantidades distintas.
- Los grupos de navegación contraídos retenían enlaces accesibles; ahora son `inert` y se excluyen del árbol accesible.
- La tabla del Dashboard carecía de roles de celda; se añadieron y se corrigió contraste sin eliminar la prueba axe.
- Avisos de integración no disponible aparecían verdes; ya no se representan como éxito.
- La configuración efectiva de Vercel estaba sin Deployment Protection pese al estado anterior; se habilitó exclusivamente Preview y se comprobó la redirección de visitantes sin autorización.

## Límites no cerrados

No se certifica producción, paridad visual idéntica de cada interacción, todas las solicitudes Excel ni las 210 funciones del video. Las reglas clínicas/fiscales, escalas en conflicto, importación histórica, WhatsApp/OTP, y módulos sin comando Mongo continúan abiertos. Los guardados locales de la demo están separados del proveedor Mongo: un fallo remoto no activa ese modo.

La evidencia vigente está en `MONGO_STUDIO_VERIFICATION_20260910.md`, `DESKTOP_DELIVERY_STATE.json` y las matrices QA. Las pruebas realizadas distinguen API Atlas real, navegador local y preview DEMO; no son intercambiables.
