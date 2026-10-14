# Copia íntegra de origen en cuarentena · 2026-10-13

El usuario confirmó expresamente que actúa como responsable autorizado de las **nueve organizaciones** de la base original y autorizó su traslado al VPS de Contabo en US-central. Esta autorización cubre la copia protegida, no identifica registros de demostración ni ordena cambiar Vercel, DNS o producción.

## Estado comprobado

- Origen Neon: transacción `REPEATABLE READ READ ONLY`; ninguna escritura, migración ni cambio de configuración en Vercel. El snapshot lógico exacto de las 16:15 UTC contiene **47 tablas y 2.559 filas**. El formato 2 conserva el texto JSON emitido por PostgreSQL para no redondear enteros o importes al pasarlos por JavaScript. Archivo cifrado AES-256-GCM, SHA-256 `dc5d8040b4e61c609a050eebb73a9de7367330d91bb9813bd17f6276042bd64f`. Su autenticidad y conteos se verificaron mediante descifrado local.
- La copia cifrada llegó al directorio privado `backups/source-quarantine/` del VPS con permisos `root:root 0600`; tamaño y SHA-256 coincidieron. Otra copia cifrada e idéntica quedó en la carpeta OneDrive local `respaldos-cifrados/origen-neon-20261013T161518Z/`. La sincronización efectiva de OneDrive con la nube sigue sin prueba independiente.
- En el cluster PostgreSQL local se creó **`analiza_source_quarantine`**, una base aparte. El rol web `analiza_app` no tiene `CONNECT`. Se aplicaron las **30 migraciones originales** cuyos archivos y hashes coinciden con el historial de origen. La importación de las 2.559 filas fue transaccional y conservó todas las relaciones: 47/47 conteos y digests por tabla coinciden con el snapshot. Contiene nueve organizaciones y 35 pacientes; sólo el operador de base puede acceder. No se reutilizó ninguna sesión en la aplicación.
- `analiza_en_casa`, la base operativa del VPS, permaneció con **32 migraciones, 546 candidatos oficiales, un lote de importación y cero pacientes originales**. Web y PostgreSQL siguieron `healthy`; `/api/health` respondió 200. Vercel y su base siguieron intactos.
- El backup diario cifrado ahora incluye `database.dump` y, cuando la cuarentena existe, `source-quarantine.dump`, ambos con SHA-256. El snapshot restic `d78a7c05` terminó correctamente. Se restauraron **ambos volcados** en un contenedor PostgreSQL descartable y se comprobaron 32/30 migraciones, 546 catálogos operativos, nueve organizaciones y 35 pacientes en cuarentena. La tarea Windows copió el repositorio cifrado a `snapshot-20261013T162250Z`: 42 archivos, 8.416.899 bytes, `restic check --read-data` aprobado, ambos volcados presentes. La tarea terminó con código 0.

## Procedencia y límite de promoción

El inventario privado ligado al snapshot clasifica **236 referencias técnicas verificadas**: 30 registros de migración con hashes Git idénticos y 206 catálogos por defecto sin alteraciones respecto de las migraciones `011`/`012`. Un catálogo por defecto presenta una diferencia y permanece incierto. Las **2.323 filas restantes** siguen `UNKNOWN_ORIGIN`; no se infirió que fueran reales o demos por nombre, fecha o apariencia. El manifiesto HMAC y la tabla de revisión de organizaciones permanecen fuera de Git.

El inventario previo de 2.455 filas no era un snapshot completo: excluía `schema_migrations` y quedó desactualizado por **74 filas nuevas** entre lecturas, incluidas operaciones, sesiones y eventos de acceso. Esto demuestra actividad en origen. Antes de promover expedientes, pagos, usuarios o catálogos no verificados a `analiza_en_casa`, hace falta identificar los registros de prueba mezclados, aprobar un manifiesto de inclusión por relación y ejecutar una conciliación de cambios desde el punto de corte. Las sesiones y límites de autenticación históricos no deben activarse en el nuevo sistema. La cuarentena conserva los datos inciertos sin mezclarlos con el catálogo oficial ni con cuentas operativas.

El [creador/verificador de snapshots](../../scripts/deployment/source-snapshot.mjs) quedó versionado. Exige URL de origen en `ANALIZA_SOURCE_DATABASE_URL`, nombre de host esperado, archivo de contraseña y salida absoluta **fuera del repositorio**; usa únicamente una transacción de lectura y permite verificar el cifrado y todos los conteos. Una ejecución de comprobación posterior produjo **2.571 filas**, doce más que la copia en cuarentena. Los digests cambiaron en auditoría, límites de acceso, catálogos, eventos de login, cotizaciones y sesiones: la diferencia no se reduce a doce altas. Esa copia se conserva de forma privada y no se confunde con el corte restaurado. La URL y los datos nunca se escribieron en Git.

Invocación del operador, después de cargar la URL privada en la variable de entorno:

```text
node scripts/deployment/source-snapshot.mjs create --archive <ruta-absoluta-fuera-de-Git> --password-file <ruta-absoluta-de-clave> --expected-host <host-Neon-verificado>
node scripts/deployment/source-snapshot.mjs verify --archive <misma-ruta> --password-file <misma-clave>
```

La restauración desde el snapshot cifrado demuestra recuperabilidad de esta copia; no constituye un corte final ni garantiza sincronía con nuevas escrituras de Vercel. El dominio y el cambio de producción continúan pendientes.
