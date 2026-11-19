# Preparación de más de 650 médicos desde Excel

Fecha: 5 de noviembre de 2026, America/El_Salvador. Las comprobaciones nocturnas tienen fecha UTC del 6 de noviembre.

Implementación verificada y publicada en GitHub: `d4c2fa9b9138e66513a0e221e3423a0e858d6cdb`. El registro posterior sólo agrega trazabilidad; no despliega ni carga datos.

## Alcance y estado

El cliente pidió revisar los cambios de otro Codex y preparar una importación de más de 650 médicos. Aclaró que ese Codex sólo revisó commits/VPS y que el archivo llegará en Excel `.xlsx`. Aún no entregó el archivo de médicos. Esta solicitud habilita la preparación del nuevo lote; no reactiva una copia indiscriminada de bases históricas ni incluye expedientes clínicos.

Se actualizaron las referencias de todas las ramas remotas: no había commits posteriores a `c055daa6b1f6bc25ddce46c4cdc4ecee122b17e1`. El PR #20 seguía abierto, sin comentarios de revisión nuevos. La lectura del VPS confirmó Analiza y PostgreSQL saludables, `/api/health` HTTP 200 y cero unidades systemd fallidas. La imagen seguía en `analiza-contabo-web:81823a6933b027cde0e8b21596612f54741c89b8`; los tres scripts de mantenimiento/respaldo cotejados coincidían con Git. Esto no certifica todos los archivos del servidor ni sustituye una nueva auditoría de mantenimiento.

La pantalla de importación actual admite catálogos y personal, **no médicos**. No debe cargarse este lote como `STAFF`. Se prepararon una plantilla vacía y un prevalidador local: no se crearon rutas, no se cambiaron permisos, no se escribieron médicos en PostgreSQL y no se desplegó otra imagen.

## Entrega y campos

- Plantilla: `outputs/doctors-preparation-20261105/Plantilla-medicos-Analiza.xlsx`.
- Hojas: `Medicos` (19 columnas, 1.000 filas disponibles) y `Guia`.
- Encabezado y dos primeras columnas inmovilizados; filtro de tabla, campos obligatorios destacados y lista Nuevo/Recurrente.
- Identificadores y teléfonos como texto para conservar ceros iniciales. Fechas completas `AAAA-MM-DD` o fechas nativas de Excel.
- Obligatorios según el formulario vigente: nombre completo, especialidad, teléfono fijo y nuevo/recurrente. DUI y dirección siguen opcionales.
- El archivo original también puede revisarse sin adaptarlo primero a la plantilla. Los encabezados sin correspondencia y las hojas ambiguas se reportan para mapearlos expresamente.

No completar teléfonos, especialidades, identificadores, fechas ni categorías por suposición. Un celular no se convierte en teléfono fijo. Si falta un dato obligatorio, la fila queda para revisión y el equipo lo completa. No se agregan reglas clínicas ni comprobaciones legales de documentos.

## Prevalidación local sin escrituras en la aplicación

Conservar la fuente y los informes fuera del repositorio. La carpeta de salida debe existir; cada informe usa un nombre nuevo. El comando nunca sobrescribe un informe ni muestra celdas del listado en consola.

```powershell
npm run doctors:prepare -- --input C:/DatosPrivados/medicos.xlsx --sheet Medicos --organization ID_ORGANIZACION --output C:/DatosPrivados/revision-medicos-01.json
```

Sin `--existing`, el informe es preliminar y nunca queda listo para carga. Para conciliar, un operador deberá obtener una exportación reciente de médicos de **esa misma organización**, por un mecanismo autorizado, y conservarla también fuera de Git:

```json
{"organizationId":"ID_ORGANIZACION","doctors":[{"doctor":{"id":"ID_EXISTENTE","fullName":"Nombre sintético","specialty":"Especialidad sintética","attachments":[]},"version":1}]}
```

El ejemplo sólo explica la estructura; no representa una exportación real. Cada `doctor` se valida contra el contrato actual y conserva su versión. No fabricar una lista vacía para declarar una conciliación de producción.

```powershell
npm run doctors:prepare -- --input C:/DatosPrivados/medicos.xlsx --sheet Medicos --organization ID_ORGANIZACION --existing C:/DatosPrivados/medicos-existentes.json --output C:/DatosPrivados/revision-medicos-02.json
```

El prevalidador admite hasta 2.000 filas y 5 MiB por archivo; limita el contenido descomprimido de XLSX a 32 MiB. También admite CSV UTF-8 separado por coma o punto y coma, con comillas y saltos de línea. Rechaza fórmulas de Excel: usar una copia de valores y conservar el original. No elimina silenciosamente columnas desconocidas, no deduce ceros perdidos de celdas numéricas y no interpreta fechas ambiguas.

El JSON contiene la huella SHA-256 del archivo, hoja, fecha, organización, números de fila originales, incidencias, huellas por registro y candidatos. Es privado: se crea con acceso restringido al operador antes de escribir datos (ACL en Windows; modo 0600 en POSIX). La herramienta rechaza una salida dentro del repositorio y no incluye credenciales ni conexión de base de datos.

Coincidencias de nombre, ID de origen, DUI, JVPM, CONADEM o NIT se señalan para revisión. Comparar nombres ignora acentos, espacios y prefijos Dr./Dra.; **no prueba que sean la misma persona**. No se fusiona ni sobrescribe nada. Compartir teléfono o correo de clínica no basta para marcar duplicación. Se comprueba que la exportación existente indique la misma organización; el informe no es un mecanismo de autorización.

Códigos de salida: `0`, prevalidación sin incidencias y con conciliación suministrada; `2`, informe generado con incidencias o sin conciliación; `1`, archivo/parámetros/salida no válidos. `readyForControlledImport` es sólo un resultado de la preparación: no ejecuta una importación y no certifica que el snapshot siga vigente. Los IDs `preview-*` nunca son IDs de producción.

## Verificación ejecutada

| Comprobación | Resultado |
| --- | --- |
| `npm run repo:preflight` | PASS, 17 capítulos / 1.359 eventos |
| Pruebas focalizadas del prevalidador | 9/9; XLSX real con 700 filas sintéticas, plantilla vacía, ceros iniciales, fórmulas, duplicados, fechas, columnas, límites y organización |
| `npm run test:doctors:prepare` | PASS; CLI con 700 filas sintéticas, informe privado, fuente intacta, rechazo de sobrescritura, otra organización y salida en Git |
| `npm run test:react` | 341/341 en 68 archivos, incluida regresión de validación de médicos |
| `npm run typecheck` y `npm run lint` | PASS |
| `npm run audit:verify` | PASS de los 17 ledgers existentes; no es una nueva revisión visual completa |
| `npm run security:scan` | PASS |
| `npm run qa:client-changes` / `npm run qa:video-parity` | PASS, 32/32 cambios y 210/210 requisitos trazados; estados existentes conservados |
| Gates por capítulo CH01 / CH02 / CH03 | PASS, 14/14, 16/16 y 13/13; certificaciones históricas conservadas |
| Formato / `npm run react:boundaries` | PASS |
| Inspección de la plantilla | Tres vistas renderizadas revisadas; encabezados, guía y desplegable legibles |

Para reproducir el QA del lote sin datos reales:

```powershell
npm run test --workspace=@analiza/web -- src/server/doctor-import-preflight.test.ts
npm run test:doctors:prepare
```

El generador de la plantilla es `scripts/artifacts/create-doctor-import-template.mjs`; utiliza el runtime de artefactos de Codex a través de `ARTIFACT_WORKSPACE`. La plantilla exportada queda versionada: usarla o ejecutar las pruebas no requiere ese runtime. No se añadió una dependencia de producción.

## Pendiente cuando llegue el Excel

1. Conservar original y huella; confirmar hoja, significado de columnas y organización de destino con la información del archivo.
2. Prevalidar y conciliar contra los médicos actuales; resolver coincidencias y datos obligatorios pendientes con el equipo, sin inventarlos.
3. Implementar y probar la escritura controlada con transacción, organización, claves idempotentes, versiones, auditoría por lote y conciliación antes/después. Aún no hay un importador masivo de médicos certificado.
4. Subir ese código a GitHub antes de aplicarlo; verificar respaldo/restauración y cargar sólo las filas revisadas. No actualizar registros existentes ni deshacer registros con referencias sin un plan explícito.

CR-032 conserva `MISSING / NOT_CERTIFIED` para la importación real de médicos y expedientes. Esta entrega cubre preparación y detección de incidencias; no afirma paridad nueva de video ni una carga de datos efectuada.

Revisión del delta de preparación contra la base y los contratos vigentes: no se encontraron P0/P1 pendientes en los archivos añadidos. Se revisaron los límites de organización, ausencia de escrituras/red, conservación del archivo fuente, duplicados sin fusión, salida privada, validaciones existentes y evidencia reproducible. No se ejecutó otra regresión completa de navegador: el lote no cambia pantallas, rutas ni persistencia.
