# Criterios de aceptación P0

## Flujo de punta a punta

1. Un usuario autorizado registra un paciente.
2. Crea una hospitalización asociada.
3. Crea una cotización con al menos dos categorías.
4. El sistema calcula subtotal, descuento, seguro y responsabilidad del paciente.
5. Al enviar, se crea una versión inmutable.
6. Se genera un enlace seguro y un QR.
7. El paciente accede únicamente después de validación.
8. Administración actualiza el estado del seguro.
9. El portal refleja el nuevo estado sin exponer información clínica.
10. Se registra un pago.
11. El saldo se actualiza una sola vez.
12. Se genera un documento clínico básico.
13. Se registra un servicio médico.
14. Se genera y envía un estado de cuenta.
15. Todos los eventos sensibles aparecen en auditoría.

## Seguridad

- Un usuario sin permiso recibe acceso denegado.
- Un paciente no puede ver datos de otro paciente.
- Un token vencido no funciona.
- El sistema no confirma públicamente si un DUI existe.
- Los logs no contienen datos clínicos sensibles ni secretos.
- Los archivos privados no son accesibles mediante URL pública permanente.

## Cotizaciones

- Un precio faltante bloquea el envío, no la creación del borrador.
- Una cotización enviada no puede sobrescribirse.
- Un cambio crea una nueva versión.
- El descuento requiere permiso y motivo.
- Los cálculos usan decimales exactos.

## Pagos

- La misma referencia externa no puede aplicarse dos veces.
- Un pago superior al saldo requiere proceso de crédito o excepción.
- Un fallo de red no duplica el movimiento al reintentar.
- El comprobante conserva trazabilidad.

## Mensajería

- Un envío registra canal, destino enmascarado, plantilla, resultado y reintentos.
- El mensaje no contiene diagnóstico ni detalle clínico.
- Si el proveedor no está configurado, el sistema usa modo simulado visible para administración.

## Documentos

- La vista previa coincide con el PDF generado.
- Cada documento muestra versión, fecha y responsable.
- Un documento firmado no puede editarse silenciosamente.
