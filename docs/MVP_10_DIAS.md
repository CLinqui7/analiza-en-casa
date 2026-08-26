# Plan de ejecución de 10 días

## Principio

El día 10 se entrega producción controlada del flujo P0. No se promete la sustitución completa de todos los módulos históricos sin datos, plantillas, credenciales y validaciones del cliente.

## Día 1 - Cierre y arquitectura

- Revisar repositorio, prototipo, video y referencias.
- Congelar P0.
- Validar roles, estados y datos sensibles.
- Crear arquitectura, ambientes y CI.
- Crear esquema inicial, autenticación y auditoría.
- Entregar mapa de riesgos y preguntas bloqueantes.

## Día 2 - Pacientes y catálogos

- Pacientes y contactos.
- Seguro del paciente.
- Servicios, medicamentos, insumos, equipos y honorarios.
- Importadores CSV.
- Permisos y RLS.

## Día 3 - Hospitalizaciones

- Crear y consultar casos.
- Próxima acción.
- Eventos de estado.
- Relación con paciente, seguro y responsable.

## Día 4 - Cotizaciones

- Constructor por categorías.
- Cálculos y validaciones.
- Descuentos autorizados.
- Versionado.
- PDF provisional.

## Día 5 - Mensajería

- Adaptadores de WhatsApp, SMS y correo.
- Modo simulado cuando no existan credenciales.
- Plantillas.
- Enlaces seguros.
- Registro de intentos y reintentos.

## Día 6 - Portal del paciente

- Token, vencimiento y verificación.
- Línea de tiempo.
- Resumen financiero.
- QR.
- Vista móvil.
- Protección contra enumeración y acceso indebido.

## Día 7 - Seguros y pagos

- Flujo de estados.
- Archivos solicitados.
- Aprobación total y parcial.
- Responsabilidad del paciente.
- Pagos y comprobantes.
- Idempotencia.

## Día 8 - Documentos y médicos

- Plantillas clínicas P0.
- Impresión.
- Servicios médicos.
- Estados de cuenta.
- Envío automático revisado.

## Día 9 - QA y UAT

- Pruebas unitarias, integración y E2E.
- Permisos y RLS.
- Cálculos.
- Duplicados.
- Portal.
- Mensajería.
- Documentos.
- UAT con datos anonimizados.

## Día 10 - Producción controlada

- Migración disponible.
- Variables y credenciales.
- Dominio y SSL.
- Respaldos.
- Monitoreo.
- Capacitación.
- Manual breve.
- Evidencia de aceptación.
- Plan de reversión.

## Corte de alcance

Todo elemento nuevo solicitado después del cierre del día 1 debe clasificarse como:

- Cambio crítico que sustituye otra función P0.
- P1 posterior.
- P2 evolutivo.
