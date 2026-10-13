# Procedencia de datos y cuarentena de la copia

La consulta a la base original se ejecutó en una transacción `REPEATABLE READ READ ONLY`, limitada a conteos y metadatos. El manifiesto local privado `.local/contabo-source-counts.json` registra 2.455 filas en 45 tablas, incluidas sesiones, eventos de acceso y auditoría. No son 2.455 personas o registros comerciales. Entre los conteos: 35 pacientes, 12 médicos, 20 usuarios, 9 organizaciones, 800 artículos de catálogo, 15 hospitalizaciones, 27 cotizaciones, 15 pagos, 5 compras y 17 movimientos de inventario. Esos conteos prueban existencia, no origen.

| Clasificación de la base original | Filas confirmadas | Acción |
| --- | ---: | --- |
| `REAL_USER_DATA` | 0 verificadas individualmente | No copiar hasta demostrar procedencia y autorización. |
| `APPROVED_BUSINESS_CATALOG` | 0 verificadas individualmente | Mantener separadas del Excel oficial nuevo. |
| `REQUIRED_SYSTEM_REFERENCE` | 0 verificadas individualmente | Conciliar esquema y permisos antes de trasladar. |
| `CONFIRMED_DEMO_DATA` | 0 verificadas individualmente | No se excluyó ninguna fila basándose en apariencia. |
| `UNKNOWN_ORIGIN` | 2.455 | Cuarentena de origen; no presente en la VPS. |

Se identificaron rutas de seed y fixtures en el código, pero no se demostró que filas concretas de la base original provengan de ellas. En consecuencia se conservaron todas las filas originales sin modificación y se copiaron **cero** filas originales. Tampoco se copiaron sesiones, auditorías, archivos clínicos, contraseñas o secretos. La base operativa nueva tiene cero pacientes y cero operaciones; sólo la cuenta administradora autorizada y los catálogos del Excel oficial en revisión. No se declara completa una migración de pacientes.

El archivo oficial de catálogos tiene hash SHA-256 `56acf4489cc5cd3652c735763ea6f72408458ae85e93282ab5cb37ec5715d012`; la plantilla tiene `562d6fbe2969117dbffc1f510c6e4954482d50f4fb286804d8e6a3b4c56050b7`. Su contenido privado no se versiona. Los 546 candidatos se clasifican por fuente como `APPROVED_BUSINESS_CATALOG` **pendiente de revisión operativa** y se guardan inactivos; no son pacientes ni transacciones. `import_batches`, `import_records` y sus enlaces conservan hash, hoja, fila, usuario y hora. La segunda carga del mismo archivo devuelve el mismo lote sin duplicar artículos.

`scripts/deployment/clean-data-plan.mjs` genera un plan de sólo lectura: exige evidencia para toda clasificación distinta de `UNKNOWN_ORIGIN`, mantiene dependencias dudosas en cuarentena y señala relaciones que mezclan demostración con datos reales. No ejecuta borrados ni escrituras. Antes de producir una copia real se necesitan prueba fila a fila, respaldo consistente del origen, autorización de datos sensibles para proveedor/región y reconciliación de las dos migraciones de origen ausentes. El manifiesto final deberá incluir identidad y hash de cada fila incluida/excluida, sus dependencias y una verificación postcopia. Véase `CLEAN_DATA_MIGRATION.md`.
