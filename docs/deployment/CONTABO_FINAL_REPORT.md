# Informe ejecutivo · copia privada Contabo

Fecha: 2026-10-13. Rama `codex/contabo-clean-migration`. Aplicación Contabo: `b993553c30856a86ad98fc4eee1427c9c145c96b`. Vercel permanece en `6c2273f3e210b9fea6b4da91dbbd865f03b1b331`, sin modificar configuración, DNS, base, usuarios ni pipelines originales.

La copia privada está operativa en la VPS de Contabo y el Excel oficial produjo 546 **candidatos de catálogo inactivos**. Se crearon la organización y cuenta administradora independientes. La nueva base conserva cero pacientes y cero transacciones; la copia de datos originales está pendiente porque su procedencia por fila y la autorización de datos sensibles para este proveedor y ubicación todavía no están demostradas. Mantener esta separación evita que registros de prueba se presenten como operaciones reales.

| # | Pregunta del encargo | Estado | Evidencia y límite |
| ---: | --- | --- | --- |
| 1 | Conexión VPS | **COMPLETADO** | SSH con host conocido y clave dedicada para `root`/`deploy`; contraseñas SSH deshabilitadas tras validar ambas claves. Ubuntu 24.04.5, instancia `vmi3659839`. |
| 2 | Dependencias instaladas | **COMPLETADO** | Docker/Compose/Buildx, PostgreSQL 18 en contenedor, Nginx, UFW, Fail2ban, restic, utilitarios y Node 24 para QA. |
| 3 | Aplicación y commit | **COMPLETADO** | Next.js/API completos en imagen `b993553`, separada de la revisión Vercel. |
| 4 | Motor y estructura | **PARCIAL** | PostgreSQL 18, 29 migraciones y RLS; dos migraciones aplicadas en origen faltan en checkout y deben conciliarse antes de copiar. |
| 5 | Registros reales encontrados/conservados | **PARCIAL** | Origen: 2.455 filas de metadatos en 45 tablas, incluidas 35 de pacientes; ninguna fila verificada como real ni copiada. Todas permanecen intactas en el original. |
| 6 | Demos confirmados/excluidos | **BLOQUEADO** | Cero filas originales confirmadas demo y cero excluidas; no se clasificó por nombre/aspecto. La base nueva no recibió semillas. |
| 7 | Pendientes de clasificación | **COMPLETADO** | 2.455 filas originales `UNKNOWN_ORIGIN`, con doble conteo de entidades dependientes, sesiones y auditoría; no son 2.455 personas. |
| 8 | Catálogo oficial incorporado | **PARCIAL** | 546/546 filas guardadas con procedencia y sin duplicación; 0 activadas comercialmente. Los 47 precios originales se conservan sin atribuirles USD hasta confirmar moneda. |
| 9 | Rechazos | **COMPLETADO** | Cero filas descartadas. Dos correos de proveedores no se proyectaron por formato; el texto de origen sigue privado para corregirlo. |
| 10 | Importaciones Excel | **PARCIAL** | Vista previa, validación y carga idempotente del oficial funcionan; plantilla vacía reconocida. Tarifas, compras y personal quedan sólo como registros/enlaces hasta acordar reglas. |
| 11 | BI con datos reales | **BLOQUEADO** | Pantallas consultables con cero operaciones en destino; no se inventaron ingresos, stock ni pacientes. Requiere migración autorizada y conciliada. |
| 12 | Pruebas | **PARCIAL** | 252 unitarias React, 216 de navegador mock, 16 rutas Contabo, dos tenants sintéticos, backup/restore y gates CH01–CH03 pasaron. Hay una prueba existente omitida; roles reales y datos clínicos originales no se ensayaron en Contabo. |
| 13 | CPU/RAM/disco | **PARCIAL** | Última muestra: web 0,01% CPU/63,84 MiB, DB 0,64%/79,04 MiB. Directorio Analiza 1,6 GiB (revisiones y backups), volumen DB 67 MiB; imágenes lógicas web 440 MB y PostgreSQL 635 MB con capas compartidas. Disco global 9,3/193 GiB. No es benchmark de carga. |
| 14 | Funcionamiento en Contabo | **PARCIAL** | Health 200, login e importación y lectura operativa funcionan por túnel SSH; sin acceso público HTTPS ni datos originales. |
| 15 | Vercel intacto | **COMPLETADO** | Se verificó despliegue original `READY` y SHA original; esta rama no cambió configuración, dominio, datos ni workflows. No se hizo tráfico mutante contra Vercel. |
| 16 | Antes del dominio | **BLOQUEADO** | Autorizar datos sensibles para región/proveedor, clasificar y conciliar filas, recuperar DDL faltante, definir moneda/costos, probar roles y BI con datos reales, respaldo externo, HTTPS, sincronización final, ventana y plan de regreso. El corte exige autorización posterior. |

La salida ya permite revisar la interfaz por túnel SSH (`CONTABO_DEPLOYMENT.md`), pero no reemplaza Vercel ni constituye producción clínica. El respaldo cifrado local se restauró realmente; el complemento Auto Backup y almacenamiento externo no están confirmados. No se pagaron recursos adicionales. `CONTABO_QA_REPORT.md` detalla pruebas y riesgos; `DATA_PROVENANCE_AUDIT.md` y `CLEAN_DATA_MIGRATION.md` fijan el procedimiento pendiente sin borrar origen.
