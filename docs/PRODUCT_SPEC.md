# Especificación funcional P0

## Objetivo

Reducir la fragmentación operativa y las consultas repetitivas de pacientes mediante un flujo único que conecte paciente, caso, cotización, seguro, pago, atención clínica, inventario y liquidación médica.

## Flujo central

```text
Paciente
  -> Hospitalización o caso
  -> Cotización versionada
  -> Envío al paciente
  -> Envío y seguimiento con seguro
  -> Aprobación total, parcial o rechazo
  -> Responsabilidad del paciente
  -> Registro de pago
  -> Programación del servicio
  -> Documentos clínicos básicos
  -> Consumos e inventario
  -> Estado de cuenta médico
```

## Módulos P0

### 1. Usuarios, roles y auditoría

- Inicio de sesión.
- Roles mínimos.
- Permisos por módulo y acción.
- Historial de cambios sensibles.
- Registro de accesos al portal externo.

### 2. Pacientes

- Documento, nombres, fecha de nacimiento, sexo y nacionalidad.
- Teléfono, correo y contactos responsables.
- Dirección y referencia geográfica.
- Seguro, plan, número de póliza y vigencia.
- Triage o prioridad administrativa.
- Activación e inactivación.
- Importación CSV con validación y reporte de errores.

### 3. Hospitalizaciones

- Número único.
- Paciente.
- Tipo de cuenta.
- Aseguradora.
- Responsable administrativo.
- Fecha de inicio y cierre.
- Estado actual.
- Próxima acción.
- Eventos y documentos relacionados.

### 4. Catálogos y tarifas

- Servicios.
- Estudios diagnósticos.
- Medicamentos.
- Insumos.
- Equipos.
- Honorarios.
- Extras.
- Listas de precios, vigencia y moneda.
- Descuentos autorizados.
- Importación CSV.

### 5. Cotizaciones

- Constructor por categorías.
- Cantidad, precio, subtotal, descuento y total.
- Cobertura estimada o registrada.
- Monto de seguro y monto del paciente.
- Comentarios.
- Versionado inmutable después del envío.
- PDF provisional.
- Enlace seguro y QR.
- Registro de mensajes y reintentos.

### 6. Seguros

Estados mínimos:

- Borrador.
- Lista para enviar.
- Enviada al paciente.
- Enviada al seguro.
- Seguro en revisión.
- Información requerida.
- Aprobación parcial.
- Aprobada.
- Rechazada.
- Pago del paciente.
- Servicio programado.
- Cerrada.

Cada cambio debe incluir fecha, usuario, observación y archivos cuando apliquen.

### 7. Portal del paciente

- Enlace con token aleatorio y vencimiento.
- Verificación adicional por código o dato acordado.
- Estado en lenguaje humano.
- Línea de tiempo.
- Última actualización.
- Total cotizado.
- Monto aprobado por seguro.
- Responsabilidad del paciente.
- Pagos y saldo.
- Documentos o acciones pendientes.
- Descarga de cotización vigente.
- Contacto administrativo.

No mostrar diagnóstico, órdenes médicas ni notas clínicas.

### 8. Pagos

- Cotización asociada.
- Monto, fecha, método, pagador y referencia.
- Comprobante.
- Aplicación al saldo.
- Prevención de duplicados.
- Ajustes y devoluciones solo con permiso.
- Actualización inmediata del portal.

### 9. Clínica P0

- Orden médica básica.
- Reporte de salud básico.
- Tarjeta de medicamentos básica.
- Plan de cuidados básico.
- Vista previa e impresión.
- Estado borrador, firmado o anulado.
- Profesional responsable.
- Versiones y auditoría.

Las reglas clínicas y plantillas finales requieren aprobación del cliente.

### 10. Inventario P0

- Ítems, bodegas y existencias.
- Disponible, comprometido y mínimo.
- Lotes y vencimientos cuando apliquen.
- Entrada, salida y ajuste.
- Asociación opcional a hospitalización.
- Kits básicos.
- Alertas de reposición.

### 11. Médicos y estados de cuenta

- Médico y especialidad.
- Servicios realizados.
- Tarifa registrada.
- Ajustes.
- Pagado y pendiente.
- Corte por período.
- PDF provisional.
- Revisión antes de enviar.
- Registro de envío.

## Fuera de P0

- Integración automática con todos los seguros.
- Contabilidad completa.
- Facturación electrónica por país.
- Conciliación bancaria automática.
- Aplicación móvil nativa.
- Firma electrónica certificada.
- Predicción clínica.
- Analítica avanzada.
