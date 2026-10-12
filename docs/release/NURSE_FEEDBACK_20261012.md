# Solicitudes de enfermería · 12 de octubre de 2026

Se revisaron los cuatro reportes nuevos y los ocho que seguían en revisión. La rama de partida fue `codex/self-service-profiles-20261008`: conserva el perfil privado de usuario, los permisos diferenciados del Dashboard, visitas comerciales y custodia de artículos a domicilio añadidos por el trabajo anterior. No se cambió su modelo de roles ni las migraciones 026–028.

## Cambios implementados

| Reporte | Solución | Límite importante |
| --- | --- | --- |
| `acb551f8` · Inventario | La lista incluye artículos con recepción trazada aunque aún no haya movimiento de entrada; separa Disponible, Retenido y Vencido. Enlace a Lotes y error de entrega más claro. | Los dos lotes observados tenían 10 unidades cada uno, en cuarentena y vencidos el 8 y 9 de octubre. No se liberó ni entregó producto vencido. |
| `bddfc1ea` · Anular factura recibida | Anulación documental con motivo y auditoría después de recibir. Una factura de varias líneas se anula completa y en una transacción, solo cuando no quedan líneas pendientes de recibir (puede haber líneas ya canceladas). | No borra la recepción ni hace una devolución física o reversión fiscal automática; esa operación requiere un flujo separado. |
| `dbcb2d51` · Varios productos por factura | El formulario permite añadir líneas con lote/serie, cantidad y costo distintos. Se guardan juntas en una transacción bajo el mismo número, proveedor, referencia y bodega. | Cada línea conserva su trazabilidad y se recibe individualmente; una falla al guardar revierte la factura completa. |
| `51132dd2` · Honorarios | El registro de médicos deja de pedir un honorario fijo. La cotización ofrece USD 0 y USD 15–300 en incrementos de USD 5, validado también en el servidor. | Las cotizaciones históricas conservan su precio original. |

Las ocho solicitudes que estaban en `REVIEWING` no se cerraron artificialmente: anexo de una cotización a un expediente concreto y diseño PDF requieren confirmación del caso/formato; factura fiscal y métricas derivadas requieren definición tributaria; WhatsApp y correo requieren proveedor, consentimiento y una entrega segura. Las funciones parciales ya desplegadas permanecen disponibles.

## QA

- Pruebas de política de honorarios, cantidades retenidas/vencidas y comandos de compras; incluye anulación de todas las líneas y rechazo de encabezados distintos.
- Regresión Node, React, verificación estática, tipos, lint y compilación de producción.
- Pruebas de navegador de compras, cotizaciones e inventario. Los casos antiguos que exigían honorario fijo en la ficha del médico fueron actualizados a la regla nueva.

No se modificaron datos clínicos reales ni existencias en producción durante el diagnóstico.
