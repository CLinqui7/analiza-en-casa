# Directorio de médicos · lote autorizado del 5 de noviembre de 2026

El cliente entregó `medicosanalizaencasa_.zip` y pidió «haz la importación». Confirmó «Una ficha por médico, conservando sus distintas clínicas y contactos». Este lote usa datos reales sólo para la carga autorizada; las pruebas siguen siendo sintéticas. Fuente, snapshots y planes detallados permanecen fuera de Git en la carpeta privada del operador.

## Procedencia y conciliación

- ZIP SHA-256: `8e22e439c1b9e96097cfd87fe5ce3c07aacd1c60da13fe449032a1b1a1f9bf5b`.
- XLSX SHA-256: `06e3786e639a10d4ca82281a6fad48ee39f70e20df28b103cc8dda3cee8df466`.
- Un archivo `.xlsx`, hoja `Medicos Analiza en casa`, 650 filas y 12 columnas; sin fórmulas ni números fraccionarios en identificadores.
- Organización principal identificada por la membresía WEBMASTER activa proporcionada por el cliente; 14 médicos existentes antes de la carga.
- 23 grupos de nombres repetidos: la consolidación deja 623 perfiles, de los que 619 son nuevos y 4 coinciden de manera corroborada con fichas existentes. Se conservan las 650 filas en la evidencia privada.
- Dos grupos tienen el mismo identificador en columnas distintas (JVPM/CONADEM) según la fila: no se corrige por suposición; se conservan ambos campos y la advertencia para revisión.
- La fuente carece de clasificación nuevo/recurrente y 454 filas no tienen teléfono fijo. Tras consolidar y considerar datos existentes, 622 perfiles quedan sin clasificación y 446 sin teléfono fijo. El cliente confirmó «Sí, importar con esos datos pendientes». Se aplicó el lote sin inventar esos valores; el formulario conserva sus validaciones al editar.

## Implementación

El planificador específico reconoce los 12 encabezados, exige nombre/especialidad/ID fuente, transforma enteros representables a su texto original y conserva todas las celdas en la evidencia. No usa el importador de personal. No inventa fechas, teléfonos ni clasificación. Los perfiles históricos pueden mantener datos ausentes sólo con la opción explícita aprobada por el cliente; las validaciones interactivas actuales no se relajan.

Se consolida una persona únicamente con nombre coincidente y JVPM, CONADEM o contacto compartido; identificadores contradictorios y coincidencias existentes ambiguas quedan retenidos. En fichas existentes, el identificador, clasificación, adjuntos y valores ya capturados se conservan; sólo se completan vacíos y agregan ubicaciones. Especialidades, clínicas, direcciones, ciudad, departamento y contactos por consulta quedan asociados en `practiceLocations`, visibles desde Editar médico y conservados al guardar el perfil principal.

La escritura se ejecuta con el rol SQL de aplicación, RLS habilitado/forzado y una membresía ADMIN/WEBMASTER activa en la organización. Una transacción bloquea escrituras concurrentes al directorio, compara el snapshot completo, recalcula el plan y comprueba su hash antes de escribir. Se audita cada médico y el lote; `analiza.commands` conserva procedencia, antes/después, filas fuente y clave idempotente por organización/archivo. No hay DDL nuevo ni actualización silenciosa de un perfil con versión distinta.

El comando es de operador, sin endpoint público:

```powershell
npm run doctors:directory -- --input C:/DatosPrivados/source.xlsx --snapshot C:/DatosPrivados/existing.json --organization ID --actor ID_USUARIO --output C:/DatosPrivados/manifest.json --historical-pending-approved
```

Usar `--historical-pending-approved` sólo para la decisión efectivamente confirmada. Sin esa opción, las filas incompletas quedan retenidas. La carpeta debe ser privada y estar fuera de Git. El informe `.review.json` contiene datos personales; no se publica. La aplicación requiere el manifiesto exacto, su SHA-256, la fuente original y el nombre explícito de la base activa:

```text
--apply --input /private/source.xlsx --manifest /private/manifest.json --manifest-sha256 SHA256 --expected-database BASE_ACTIVA
```

La recuperación de una importación ya confirmada debe revisar la evidencia antes/después y cualquier referencia nueva. No borrar médicos ni reemplazar datos editados posteriormente para simular un rollback. Un fallo dentro de la transacción no deja filas ni auditorías parciales.

## Verificación antes de aplicar

Código de aplicación y operador publicado en GitHub: `30795d76d4e35daa8e0c0df7545e44c867efc5a2`. Los operadores ejecutados en el VPS provienen de ese commit; hashes del bundle local y remoto cotejados. La base de integración fue desechable, aislada de producción y eliminada al terminar.

- 349/349 pruebas React/servidor; 17 pruebas focalizadas entre el prevalidador y el directorio.
- TypeScript y ESLint aprobados.
- Seis grupos PostgreSQL aprobados: 701 filas / 700 médicos, permisos, RLS, idempotencia concurrente, versiones, cambios posteriores y rollback íntegro ante fallo intermedio.
- 22/22 escenarios de navegador aprobados: CH01–CH03 y el directorio con 700 médicos sintéticos, búsqueda, clínicas adicionales, datos obligatorios, conservación tras editar y anchos 1440/768/390. Capturas sintéticas en `docs/imports/evidence/`.
- Seguridad y formato aprobados. El primer arranque de navegador usó un nombre de modo incorrecto (`demo`); se corrigió la configuración de ejecución a `mock`, sin relajar pruebas ni alterar producción.
- Los resultados de producción se registran en la sección de cierre; este apartado conserva la evidencia anterior a la carga.

## Dependencias de la entrega

La instalación detectó avisos previos en Next.js 16.3.8 y Zod. Se actualizan a Next.js / eslint-config-next 16.4.1 y Zod 4.6.6, versiones corregidas indicadas en [el aviso de Next.js](https://github.com/advisories/GHSA-2464-fhr4-w9xw) y [el aviso de Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). No se ha comprobado una explotación ni se afirma que todos los escenarios del aviso estén expuestos en esta aplicación. La actualización requiere repetir pruebas y compilación antes del despliegue; el informe final registrará el resultado.

Con esas versiones pasaron nuevamente 349/349 pruebas React/servidor, 22/22 escenarios de navegador, TypeScript, ESLint, 144/144 pruebas del sistema anterior y 76/76 controles de QA. `npm audit --omit=dev` informa cero vulnerabilidades conocidas; no implica ausencia absoluta de vulnerabilidades. Pasaron también los gates de 210 requisitos, 32 solicitudes, el espejo de trazabilidad y la comprobación de los 17 ledgers existentes. No se declara una nueva revisión visual completa de los videos.

## Cierre de producción · 5–6 de noviembre

- Aplicación publicada desde GitHub: `c141d4a543b930cd573e4cc40f7355581eb296c2`. Operador final: `596108970705f2bd69eb11415181820fdd0c99ed`, también publicado antes de ejecutarse. No se fusionó `main` ni se usaron GitHub Actions.
- Manifiesto privado SHA-256: `99c3627a5840b0cf6eb32319e5d1552844b35e0721760792445a18fd17fed45b`. Bundle final SHA-256: `64bec29d5630ae20f8f9e29fd7d7f0c6dff2edf576e69f348b3c33b0feb32ad8`; local y VPS coinciden.
- Respaldo anterior restaurado en un contenedor desechable sin red: `bd0e0b79ac2336ff74efafc9dfac3722e6f17a017e48e928adb6ae379c40f35c`, con 14 médicos. Dump SHA-256: `902b5c763e064e6d478dcd0b08ba8d4e4a6b053198a138e9aef49337642b705d`. El despliegue generó además el snapshot previo `e514c44bb9f638712bb8f5049afdd133a2c3e680b17cfb7142bb42d040509bf8`. La copia externa de estos snapshots no se comprobó en este lote.
- Resultado confirmado en PostgreSQL: **650 filas → 623 personas del archivo; 619 altas, 4 fichas enriquecidas, 0 filas retenidas. Total: 14 → 633 médicos.** Las otras 10 fichas y el directorio de la otra organización permanecen idénticos. Cada perfil y versión se comparó con el plan.
- Auditoría: 623 eventos por médico y un evento de lote. Se conservan las 650 filas fuente y el antes/después en la evidencia privada del comando. Repetir exactamente el manifiesto devolvió `replayed: true`, con los mismos 633 médicos y sin duplicar eventos.
- Verificación autenticada WEBMASTER en la URL pública: 633 médicos devueltos por API, los 623 perfiles del plan con sus clínicas exactas, búsqueda y apertura de una ficha con varias clínicas, anchos 1440/768/390 sin desbordamiento de página y cero errores JavaScript. No se editaron fichas reales para probar la interfaz.
- Regresión pública con organización sintética: 59 rutas, una restricción esperada de Analítica y cero errores JavaScript. El enlace a devoluciones no se volvió a ejercitar porque esa organización no tenía devoluciones en esa ejecución; no se afirma cobertura de ese botón en este lote.
- Incidencias resueltas durante la ejecución: dos invocaciones quedaron detenidas antes de conectarse porque `secrets/web.env` no contiene por sí solo la contraseña que Compose inyecta a la web. Se usó una configuración temporal privada extraída de las variables PostgreSQL efectivas, con el mismo rol `analiza_app`; no se cambiaron credenciales. La primera comprobación de navegador buscaba el buscador como `textbox`, aunque es `searchbox`; se corrigió el selector y pasó.

El equipo debe completar 622 clasificaciones y 446 teléfonos fijos. Dos perfiles requieren revisar el identificador que la fuente coloca en JVPM y CONADEM. El listado privado `C:/Temp/analiza-doctor-import-private-20261105/pendientes-de-completar.csv` permite localizar cada ficha y sus filas originales. Fuente, snapshots, plan detallado y conciliación permanecen en esa carpeta privada y fuera de Git; en el VPS están fuera del directorio público.

No se importaron expedientes clínicos: no forman parte de este Excel. CR-032 permanece parcial por ese alcance pendiente, mientras que este lote de médicos sí está importado y conciliado. Para revertir únicamente la web después de esta carga, usar como mínimo `c141d4a`; una versión anterior sin conservación de `practiceLocations` podría perder esas ubicaciones al editar. No borrar perfiles importados que puedan haber recibido nuevas referencias.

## Comprobación final del release

Release activo confirmado: `14ef0d19d44630661c5239b7d270bbc4bc6ea17b`, que publica además el estado conciliado de CR-032. La comprobación autenticada se repitió después de ese despliegue: 633 médicos, 623 perfiles/prácticas coincidentes, búsqueda, diálogo en tres anchos y detalle actualizado de CR-032 aprobados. Salud pública HTTP 200.

El respaldo posterior a la importación `b760c9e22906e40aff373ff34d10e076795e7e50317ecc5ce076cbf9de6ed054` se restauró también en un contenedor desechable sin red: 633 médicos recuperados. SHA-256 del dump: `c9b9e8b821a3a8e834d69eb98a68e6d8db00efe2979a3ea76e7dcc5c1ef2695e`. Se eliminó la copia temporal de variables de conexión utilizada por el operador; los secretos originales no se modificaron. El procedimiento de respaldo pausa brevemente la web y la reinicia; no se afirma disponibilidad ininterrumpida. La copia externa de este nuevo snapshot queda sin verificar en esta entrega.
