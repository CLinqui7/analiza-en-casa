# Directorio de médicos · lote autorizado del 5 de noviembre de 2026

El cliente entregó `medicosanalizaencasa_.zip` y pidió «haz la importación». Confirmó «Una ficha por médico, conservando sus distintas clínicas y contactos». Este lote usa datos reales sólo para la carga autorizada; las pruebas siguen siendo sintéticas. Fuente, snapshots y planes detallados permanecen fuera de Git en la carpeta privada del operador.

## Procedencia y conciliación preliminar

- ZIP SHA-256: `8e22e439c1b9e96097cfd87fe5ce3c07aacd1c60da13fe449032a1b1a1f9bf5b`.
- XLSX SHA-256: `06e3786e639a10d4ca82281a6fad48ee39f70e20df28b103cc8dda3cee8df466`.
- Un archivo `.xlsx`, hoja `Medicos Analiza en casa`, 650 filas y 12 columnas; sin fórmulas ni números fraccionarios en identificadores.
- Organización principal identificada por la membresía WEBMASTER activa proporcionada por el cliente; 14 médicos existentes antes de la carga.
- 23 grupos de nombres repetidos: la consolidación deja 623 perfiles, de los que 619 son nuevos y 4 coinciden de manera corroborada con fichas existentes. Se conservan las 650 filas en la evidencia privada.
- Dos grupos tienen el mismo identificador en columnas distintas (JVPM/CONADEM) según la fila: no se corrige por suposición; se conservan ambos campos y la advertencia para revisión.
- La fuente carece de clasificación nuevo/recurrente y 454 filas no tienen teléfono fijo. Tras consolidar y considerar datos existentes, 622 perfiles quedan sin clasificación y 446 sin teléfono fijo. La autorización de cargarlos como históricos pendientes aún está en consulta; no se ha aplicado el lote.

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

## Verificación antes de publicar

- 349/349 pruebas React/servidor; 17 pruebas focalizadas entre el prevalidador y el directorio.
- TypeScript y ESLint aprobados.
- Preparadas pruebas PostgreSQL desechables de 701 filas / 700 médicos, permisos, RLS, idempotencia concurrente, versiones, cambios posteriores y rollback íntegro ante fallo intermedio.
- Preparada regresión de navegador: 700 médicos sintéticos, búsqueda, clínicas adicionales, datos obligatorios, conservación tras editar y anchos 1440/768/390.
- Faltan registrar resultados conectados, respaldo previo, SHA publicado/desplegado y conciliación final. No se declara todavía una importación efectuada.
