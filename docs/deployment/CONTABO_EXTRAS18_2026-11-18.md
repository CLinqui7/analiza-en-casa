# Extras18: publicación y verificación del 18 de noviembre de 2026

Publicado: Antecedentes personales, hospitalización con búsqueda parcial, dieta/cuidados separados, PDF del expediente por secciones, soluciones en tarjetas de medicamentos y rol Doctor limitado a cuatro pantallas. También se conserva la escala histórica al corregir y se recupera la vista de saldos sin repetir la asignación de insumos. [Fuente y QA](../qa/CLIENT_EXTRAS18_2026-11-18.md).

| Evidencia | Valor |
|---|---|
| Release activo | `9f8307d99ec4647d1ded9f1656c4fb9e5fddb016` |
| Código funcional final | `71672e53025931c8aa0ff0a7cdb3c61322538b8f` |
| Archivo SHA256 local/remoto | `ede520df54aa951e6ddd2f6b6b9548673da2f8a9676e22c5820ee52f73e735aa` |
| Imagen activa | `sha256:46a89c830059f0b4ca66f4894e723b92c6509b45fcef29cfc9151635eaa5a4cd` |
| Release anterior conservado | `cc009b15d0c273f17ae4c667ab7c10f6924f4ad3` |
| Imagen anterior conservada | `sha256:ba0bf46f727cdf40463de1cd0467133f73eb16b5f86f712332bbbf19326b38d2` |
| Respaldo previo | `5e6db0405d01df2207c6b3f42dccdda26b4251616f5263e0bfcef0d43af88abd` |
| Hora del respaldo | 18/11/2026 10:18:52 El Salvador; 17:18:52 CET |
| Base activa / esquema | `analiza_live_20261014` / `041_quote_fulfillment.sql` |
| Migraciones nuevas | Ninguna |
| Verificador financiero público | `805b057` |
| PR abierto, sin fusionar | https://github.com/CLinqui7/analiza-en-casa/pull/20 |

El SHA se comprobó en GitHub antes de transferir y desplegar, tanto en QA como en producción. El despliegue compiló las imágenes, creó el respaldo y verificó sus archivos, comprobó las migraciones existentes y sustituyó sólo el contenedor web. Web y PostgreSQL están saludables; `/` y `/api/health` responden HTTP 200. Disco 21 % utilizado, aproximadamente 9.6 GB de memoria disponible al finalizar. No se actualizó Ubuntu ni se reinició el VPS.

## Conciliación real por la URL pública, en organización sintética

Se creó una cotización de prueba con un servicio del catálogo por 20.00, descuento explícito de 10 % y responsabilidad de aseguradora de 3.00. Total inicial 18.00, responsabilidad del paciente 15.00 y pago previo 5.00. Se añadieron tres insumos con precio confirmado 7.25 cada uno mediante dos solicitudes concurrentes con la misma clave. Los reintentos posteriores reutilizaron exactamente esas claves y esos registros.

Resultado: total 37.57, aseguradora 3.00, paciente 34.57, pagado 5.00, saldo 29.57. **Una cuenta, dos versiones, una sola línea añadida.** La versión original no cambió. La tabla Estado de cuentas mostró una sola fila de esa cuenta y el mismo saldo después de recargar; cero errores JavaScript. [Resultado reproducible](../qa/evidence/extras18-20261118/public-financial.json).

El primer intento del verificador fue rechazado correctamente por falta de vínculo del servicio con el catálogo; se registró el precio sintético explícito y se repitió. Una expectativa inicial contaba también las filas del estado de cuenta individual y del historial de pagos; se acotó a la tabla Estado de cuentas. No era una duplicación financiera. Los cambios al verificador se subieron a GitHub antes de ejecutarse. Los registros sintéticos permanecen para auditoría; no se probaron escrituras sobre pacientes o pagos reales.

## Cuenta Doctor

Se creó por la API administrativa auditada la cuenta solicitada, con nombre Dr. Carlos Sorto y una contraseña aleatoria privada. Antes de crearla no existían ni ese correo ni cuentas Doctor activas en la organización principal; después existe una sola cuenta correspondiente en `analiza-main`.

Se inició sesión con ella y se comprobaron Ingresos clínicos, Agenda, Expediente clínico y Órdenes médicas. La navegación tiene cuatro enlaces; Finanzas devuelve 403 en API y acceso restringido en pantalla. El workspace no entrega cotizaciones financieras ni pagos. El perfil propio sigue disponible para cambiar la contraseña. No se envió una invitación ni la contraseña por correo.

La información de acceso está en el archivo privado local `C:\Temp\analiza-extras18-private\ACCESO_DOCTOR_PRIVADO.md`. Sesiones, secretos y correo de la cuenta permanecen fuera de Git.

## Pruebas y cierre operativo

382 pruebas unitarias/servidor, 144 legacy, 76 controles QA, 37 grupos PostgreSQL, 80 escenarios mock y 20 conectados aprobados, más la repetición final de descarga PDF y comprobación de símbolos. TypeScript, ESLint, formato, compilaciones, seguridad, límites React, CH01–CH03, auditoría y trazabilidad aprobados. El reporte de QA distingue los SHA y repeticiones; no certifica una revisión nueva de los 17 videos completos.

Se retiraron ambos contenedores QA, su red, tres imágenes/source checkouts temporales y sus túneles. No se tocaron los volúmenes productivos. No hubo cambios adicionales de aplicación después del release: los commits posteriores contienen verificadores y evidencia. Se preservó `main`; no se ejecutaron GitHub Actions ni se fusionó el PR.

Recuperación: usar `/opt/analiza-contabo-staging/releases/before-9f8307d99ec4647d1ded9f1656c4fb9e5fddb016.env` y la imagen anterior siguiendo la guía operativa. No restaurar una base antigua sobre operaciones nuevas sin conciliación. Este lote no verifica copia externa ni restauración del respaldo nuevo; el respaldo local fue validado por el despliegue.
