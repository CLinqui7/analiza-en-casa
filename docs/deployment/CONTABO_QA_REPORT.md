# Pruebas ejecutadas para la instancia Contabo

> Resultados históricos del primer despliegue. La verificación de la versión `93d8903` y los límites actuales constan en [CONTABO_COMPLETION_REPORT.md](CONTABO_COMPLETION_REPORT.md).

Fecha: 2026-10-13. Evidencia detallada de infraestructura, importación, navegador y ensayo aislado se guarda en `.local/contabo-*.log` y en archivos privados fuera del repositorio; estos contienen metadatos comerciales o de acceso y no se publican. El código y las pruebas sintéticas sí están versionados.

Capturas sin datos clínicos ni credenciales: [ingreso por túnel](screenshots/contabo-login.png) y [dashboard operativo vacío](screenshots/contabo-empty-dashboard.png).

| Comprobación | Resultado observado |
| --- | --- |
| Baseline y auditoría de video | Preflight, 17 libros/1.359 eventos y `audit:verify` pasan; no equivale a certificar toda la paridad. |
| Pruebas de componentes | Vitest: 252/252 en 55 archivos; TypeScript, ESLint, Prettier y escáner de seguridad pasan. |
| Navegador React sintético | 216/216 ejecutadas pasan, una prueba existente omitida; seis roles demo y portal se cubren en el modo mock separado. |
| Gates CH01–CH03 | 14/14, 16/16 y 13/13; espejo de trazabilidad y cambios de cliente 32/32 pasan. Se preservan estados parciales/bloqueados existentes. |
| Excel oficial en PostgreSQL Contabo | Vista previa 546/546; importación 47 servicios, 349 productos y 150 proveedores; segunda importación sin duplicados; 546 artículos inactivos, cero pacientes, inventario y compras. Los 47 precios sin moneda confirmada siguen íntegros en la fuente y no se rotulan USD en el catálogo operativo. |
| Plantilla Excel | Siete conjuntos reconocidos; al estar vacía se devuelve una incidencia y no se crean filas. Parser prueba fechas, listas, referencias, duplicados y decimales. |
| Seguridad operativa | Inicio de sesión de administrador nuevo, semillas demo 403, recursos privados sin sesión 401, endpoints de portal no implementados 503 seguros, aislamiento por organización en una prueba sintética separada. UFW sólo 22, Fail2ban `sshd` activo y SSH sin contraseña; `root`/`deploy` verificados por clave tras recargar `sshd`. |
| Navegador Contabo | 16 rutas autenticadas devuelven 200; lista de 47 servicios de la organización, costos pendientes visibles, sin errores JavaScript, sin desbordamiento a 390/768 px en dashboard/pacientes/catálogos. |
| Ensayo descartable en la misma VPS | Dos organizaciones sintéticas: importación Excel con referencia entre hojas y distinta grafía de ID, repetición idempotente, rechazo de ID variante, registro/sesión, pacientes, hospitalización, turno, archivo privado con SHA-256, denegación cruzada y persistencia tras reiniciar PostgreSQL/web. Ninguna fila de ese ensayo llegó a la base operativa. |
| Respaldo/restore | Snapshot restic cifrado `abb9dddf`, `restic check` y restauración en PostgreSQL descartable: 29 migraciones, 546 artículos, un lote, cero pacientes y RLS forzado. Sin directorios temporales de backup restantes. |
| Reinicio VPS | Contenedores, Nginx, firewall/timers, salud y conteos comprobados tras reboot; detalles en evidencia privada. |

La primera ejecución del navegador encontró HTTP 502 durante un reinicio de infraestructura concurrente; la prueba se repitió secuencialmente y todas las rutas pasaron. Otra aserción consultó la tabla antes de que terminara de cargar; ahora espera la celda visible y pasó. La primera corrida local de Playwright usó por error variables de PostgreSQL; se corrigió a `mock` para la regresión sintética y quedó 216/216. El ensayo aislado de Excel encontró dos fallos del propio comprobador (ruta de contraseña de la base operativa y carrera durante el arranque temporal de PostgreSQL); se corrigieron y la ejecución final pasó. Ninguno de esos intentos produjo cambios en producción.

La revisión de cambios contra `origin/main` detectó y corrigió duplicados de ID por mayúsculas, proyección de moneda no confirmada como USD y limpieza incompleta del directorio temporal de backup cuando ocurre un fallo. Reconciliamos además la trazabilidad CH17: la pantalla actual lee y puede imprimir datos clínicos, aunque las notas antiguas la describían como vacía. Los estados de paridad siguen parciales o faltantes; no se promovió ninguna función clínica a `EXACT`. Las restricciones de RLS, versiones de cotización y separación de producción se conservaron. No quedan P0/P1 conocidos dentro del alcance aislado; el traslado de datos clínicos y la salida pública permanecen bloqueados por las preguntas abiertas.

Límites: la base operativa Contabo tiene un solo administrador y cero datos clínicos originales; no se han verificado seis roles **reales** allí ni BI con datos reales, importación de expedientes originales, mensajería, portal PostgreSQL, DNS o HTTPS público. La pantalla `/clinical/reports` lee y puede imprimir datos del workspace cuando existan; su fuente, permisos y formato clínicos de CH17 siguen sin certificar, aunque la ruta vacía respondió 200. La prueba de dos tenants y la regresión de seis roles son sintéticas y separadas. El respaldo actual está en el mismo servidor; falta destino externo. La auditoría visual nueva fue por muestras de los capítulos y por las 17 bitácoras existentes, sin afirmar una nueva paridad exhaustiva fotograma a fotograma.
