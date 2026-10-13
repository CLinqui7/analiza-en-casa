# Conciliación del esquema PostgreSQL de Contabo

Verificación: 2026-10-13. La base original de Neon se consultó en una transacción `REPEATABLE READ READ ONLY`; no recibió DDL ni DML. Las pruebas de aplicación de migraciones se hicieron primero en un PostgreSQL 18 descartable restaurado desde un respaldo cifrado de Contabo. Después se aplicaron exclusivamente a staging en Contabo mediante el operador separado, con respaldo previo y aplicación explícita.

| Versión | Fuente recuperada | SHA-256 fuente y registro original | Objetos y resultado en Contabo |
| --- | --- | --- | --- |
| `019_clinical_scale_captures.sql` | Git `c7e4add` | `840ca15c1117105c713138ef9ab367fb749008e5d5ddeea7d5c37576cb759b39`, coincidencia exacta | Restricción compuesta en hospitalizaciones; tabla de capturas, índice, claves foráneas y RLS forzado. Aplicada tras restauración aislada y luego en Contabo. |
| `020_account_profile.sql` | Git `710882e` | `17891f755bbe2205619ff96ec4b8d43bcf7ca49608efe68b8bf787e7c7624f17`, coincidencia exacta | Columna `users.must_change_password` con valor inicial `false`. Aplicada tras restauración aislada y luego en Contabo. |

La comparación de metadatos entre origen y destino para `clinical_scale_captures`, `hospitalizations` y `users` encontró las mismas columnas, restricciones, índices, indicadores RLS y políticas después de recuperar las dos versiones. Sus SQL originales no crean funciones ni triggers. La representación de ausencia de políticas de `users` fue `[]` en origen y `null` en la herramienta de destino; ambas significan ninguna política. Se cotejaron además los hashes contra `analiza.schema_migrations` en origen. Esto concilia **esas dos migraciones y sus objetos**; no afirma que todas las tablas del origen y el destino sean idénticas. Contabo conserva su propio esquema y las migraciones posteriores de la rama.

La migración adicional `030_insurance_observations.sql` pertenece sólo al backend PostgreSQL nuevo: crea solicitudes y eventos administrativos de seguro con claves compuestas por organización, clave de idempotencia, permisos limitados y RLS forzado. No se aplicó en la base original. No define cobertura ni resolución de la aseguradora. Se verificó en una base descartable con dos organizaciones antes de desplegarla.

Los registros originales siguen en origen. Una consulta de sólo lectura clasificó individualmente 2.455 filas mediante identificadores HMAC privados; todas quedaron `UNKNOWN_ORIGIN` y en cuarentena lógica, sin copiar identificadores o contenido clínico. La decisión de inclusión por fila y la autorización institucional para transferir expedientes a este proveedor/región siguen abiertas.
