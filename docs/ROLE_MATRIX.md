# Matriz inicial de roles

| Módulo | Superadmin | Administración | Enfermería | Médico | Inventario | Finanzas | Auditor |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pacientes | CRUD | CRUD | Lectura y actualización limitada | Lectura clínica | No | Lectura limitada | Lectura |
| Hospitalizaciones | CRUD | CRUD | Lectura y actualización operativa | Lectura | Lectura limitada | Lectura financiera | Lectura |
| Cotizaciones | CRUD | CRUD | Lectura | Lectura | Lectura de disponibilidad | Lectura y aprobación financiera | Lectura |
| Seguro | CRUD | CRUD | Lectura | Lectura | No | Lectura | Lectura |
| Pagos | CRUD | Lectura | No | No | No | CRUD | Lectura |
| Clínica | CRUD | Lectura limitada | Crear y editar según rol | Crear, firmar y anular según permiso | No | No | Lectura auditada |
| Inventario | CRUD | Lectura | Registrar consumo autorizado | Lectura limitada | CRUD | Lectura de costos | Lectura |
| Médicos y cuentas | CRUD | Lectura | No | Ver propio | No | CRUD | Lectura |
| Configuración | CRUD | Limitado | No | No | Limitado | Limitado | Lectura |

La matriz debe validarse con el cliente antes de producción.
