# Mapeo de los dos Excel oficiales

Los archivos originales permanecen fuera del repositorio, sin ediciones. Se abrieron como datos de origen, no como instrucciones para ejecutar comandos. El primer archivo contiene 546 filas de negocio; el segundo es una plantilla vacía de siete conjuntos y dos hojas auxiliares.

| Origen | Filas de negocio | Proyección actual | Pendiente sin inventar |
| --- | ---: | --- | --- |
| SERVICIOS, cinco grupos | 47 | `import_records` conserva precio decimal original sin IVA, hoja/fila; `catalog_items` categoría `SERVICES` conserva nombre y clasificación. Se ignoran cinco rótulos de sección. | Moneda, costo fiable, unidad comercial y aprobación de tarifa antes de proyectar precio operativo. |
| INSUMOS | 156 | `import_records` y `catalog_items` categoría `SUPPLIES`; nombre e ID estable. | Existencia, lote, costo, precio, unidad, características. |
| MEDICAMENTOS | 99 | `import_records` y `catalog_items` categoría `MEDICATIONS`. | Concentración, receta, vía, lote, vencimiento y demás datos clínicos. |
| EQUIPOS E INSTRUMENTAL | 94 | `import_records` y `catalog_items` categoría `EQUIPMENT`. | Serie, disponibilidad física, cantidad, costo o alquiler. |
| PROVEEDORES | 150 | `import_records` y `catalog_items` categoría `PROVIDERS`; sólo campos de contacto válidos se proyectan. | Vigencia, datos fiscales/contactos incompletos y conciliación con proveedores existentes. |

Los IDs automáticos son hashes estables de hoja y nombre normalizado, con el identificador fiscal del proveedor donde procede; no dependen del número de fila. El lote conserva el SHA-256 del archivo, la hoja, fila y cuerpo de origen. Los ceros explícitos del Excel se conservan como dato bruto; un costo ausente o sospechoso no se presenta como costo real confirmado. No se generan inventarios, compras, cuentas de personal ni números de serie.

La plantilla `plantilla_carga_analiza_en_casa.xlsx` define `Servicios`, `Proveedores`, `Seguros`, `Productos`, `Tarifas_Coberturas`, `Compras_Proveedor` y `Personal`. Los nombres de columna de la fila 5 se validan contra `importDatasetDefinitions`; `Resumen` explica la carga y `Listas` restringe categorías, moneda, unidades y booleanos. Se comprueban fecha de calendario, orden de vigencias, decimales, correo, ID duplicado y referencias. Las columnas de fórmula o formato vacías a la derecha no crean registros. La plantilla suministrada tiene **cero filas de negocio**.

| Conjunto de plantilla | Destino/relación | Uso actual |
| --- | --- | --- |
| Servicios, Productos, Proveedores, Seguros | `import_records` + `catalog_items` de organización | Catálogos legibles y mantenibles, con aprobación de precio pendiente. |
| Tarifas_Coberturas | `import_records` + `import_record_links` a servicio, seguro y proveedor | Evidencia estructurada; no se aplican coberturas ni tarifas sin regla acordada. |
| Compras_Proveedor | `import_records` + enlaces a producto/proveedor | Evidencia; no crea recepción, stock o deuda. |
| Personal | `import_records` | No crea usuarios, permisos ni asignaciones sin identidad y autorización. |

Las claves de enlace contienen organización y tienen FK compuestas y RLS. La vista previa valida referencias existentes o incluidas en el mismo archivo; al guardar se resuelve la grafía exacta del ID. Todos los artículos importados quedan inactivos para revisión aunque el Excel indique “Activo”; el estado fuente permanece en `import_records`. Los precios con moneda distinta de USD o sin moneda confirmada permanecen sólo en el registro de origen, pues el modelo de cotización usa USD. Un usuario no puede activar un precio importado sin conciliación de moneda. Los contactos inválidos se conservan sólo en el origen privado para corregirlos y no se usan en el catálogo operativo.
