# Publicación de facturación · 4 de noviembre de 2026

Activo: `a9df5c3a93eaabcdfe0effce45ad7142c09a1848`, publicado después de verificar el mismo SHA en GitHub y el SHA-256 del archivo de release. Imagen `sha256:686ab3955a2e9aa01c04a518637bf0579311b0a6f13fa4ed3919bcfc4389c2e7`. El código funcional final es `fdd7f0e771e8598be6eddbabba6b187be7301b7d`; el commit de release agrega evidencias y matrices.

Se conserva la imagen anterior `dfee2dc0dfe22f89fedde3c74fbbd8da26ed240a` para reversión. El script se ejecutó desde un archivo, con bloqueo de despliegue, respaldo previo verificado y comprobación de revisión/salud. No hay migración nueva: se verificaron nuevamente las migraciones hasta 039.

Respaldo previo: `f5bb4f5d`, creado el 4 de noviembre a las 08:09:36 UTC. Contiene el volcado y manifiesto de la base activa, verificados por el gate de publicación. Este snapshot está en el VPS; no se afirma que ya esté en la copia externa. La comprobación externa anterior permanece documentada en `CONTABO_CLINICAL_RELEASE_2026-11-04.md`.

## Prueba pública

`scripts/verify-billing-release.mjs` pasó cinco grupos usando exclusivamente la cuenta y organización sintéticas previamente provisionadas:

1. Salud HTTP 200, autenticación y comprobación de IDs de paciente/médico sintéticos.
2. Cotización v1 de USD 70.00, un pago de USD 0.29 reintentado sin duplicación, rechazo de importe fraccional, revisión v2 de USD 105.00 y conservación del total original.
3. Seguimiento de la aseguradora registrada en la cotización.
4. Saldo actual USD 104.71 visible desde la versión original; PDF de una página con el total histórico USD 70.00, inspeccionado visualmente; aviso técnico eliminado, un solo cierre de sesión y tablero sin desbordamiento a 1440, 390 y 320 px. Rutas de cobros y reporte accesibles, sin errores JavaScript.
5. Reversión auditada de los pagos sintéticos de la prueba. No se modificaron transacciones ni pacientes reales.

El primer intento del verificador esperaba 200 en una creación de seguimiento que correctamente devuelve 201. Se corrigió la expectativa y la ejecución final pasó completa; el verificador revierte movimientos de sus intentos previos identificados explícitamente como sintéticos.

Logs privados locales sin subir a Git: `C:/Temp/analiza-billing-production-smoke2.log`; PDF `C:/Temp/analiza-billing-release-quote.pdf`. Release remoto: `/root/analiza-billing-production-release.log`.

## Estado operativo

Web y PostgreSQL saludables; sin servicios systemd fallidos y sin reinicio requerido. Disco alrededor de 12% utilizado y memoria disponible. No se hizo una actualización de Ubuntu, Docker ni containerd durante esta publicación; el lote de paquetes pendiente sigue documentado en la entrega anterior.

Se retiraron los dos contenedores temporales de QA, su red, etiqueta de imagen, túneles SSH y archivos privados efímeros de credenciales. La base activa y los accesos de producción se conservaron. PR #20 abierto y sin fusionar; sin GitHub Actions.

[Informe funcional y pruebas](../feedback/BILLING_REVIEW_2026-11-04.md).
