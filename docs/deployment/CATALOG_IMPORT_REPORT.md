# Resultado de importación de catálogos

Fecha: 2026-10-13. Destino: organización independiente `Linqui` en `analiza-contabo-staging`. Hash del Excel: `56acf4489cc5cd3652c735763ea6f72408458ae85e93282ab5cb37ec5715d012`.

| Hoja | Filas detectadas | Filas guardadas | Artículos activos | Movimientos de inventario |
| --- | ---: | ---: | ---: | ---: |
| Servicios | 47 | 47 | 0 | 0 |
| Insumos | 156 | 156 | 0 | 0 |
| Medicamentos | 99 | 99 | 0 | 0 |
| Equipos | 94 | 94 | 0 | 0 |
| Proveedores | 150 | 150 | 0 | 0 |
| **Total** | **546** | **546** | **0** | **0** |

Se creó un lote de importación; el segundo intento con el mismo SHA devolvió el resultado existente, sin nuevas filas ni duplicados. Se guardaron las 546 filas como candidatos y registros de origen, con IDs estables. No se descartó ninguna fila ni se fabricó una operación. La plantilla vacía de siete conjuntos se reconoció y rechazó para importar por ausencia de registros, sin crear datos.

Se detectaron dos correos de proveedor mal formados, en filas de origen 61 y 144: el dato bruto quedó en evidencia privada y no se proyectó como correo utilizable. Los 47 precios de servicio conservan su precisión decimal **en el registro de origen**, incluso valores con más de dos decimales; la moneda no está confirmada y el precio USD operativo queda pendiente. La corrección transaccional `deploy/contabo/reconcile-unconfirmed-currency.sql` elimina sólo el rótulo/precio USD previamente proyectado para esos 47 candidatos inactivos y registra auditoría; los números del Excel no cambian. Costos cero o faltantes no se aceptaron como costos confirmados. Los 349 productos carecen de prueba de existencias físicas; cero movimientos y cero compras. Ninguna fila de personal, tarifa, cobertura o compra se inventó a partir de la plantilla vacía.

La vista previa devolvió 546 filas y cero bloqueos estructurales del primer Excel. `546 guardados` significa importación técnica trazable, **no** validación comercial final. Quedan por revisar moneda, costos, unidades, los dos correos y vigencia de proveedores antes de activar artículos o usar tarifas en cotizaciones.
