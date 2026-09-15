# Revisión de la entrega PostgreSQL con registro

Fuente de aplicación e imágenes: `64e47f345b169780c1497a6999aa1b4bb819b729`.
La documentación posterior identifica esa fuente, sin sustituir las imágenes.

El registro y el cuestionario dependían de MongoDB. PostgreSQL ahora implementa
esas operaciones detrás de los mismos contratos y páginas. La creación de cuenta
es transaccional: organización, usuario, membresía, sesión, perfil y auditoría se
confirman juntos. La migración 002 es aditiva; 001 permanece byte por byte intacta.
Las tablas nuevas tienen RLS forzado y el runtime conserva permisos sin DELETE/DDL.

La revisión se centró en SQL parametrizado, organización derivada de sesión,
permisos por rol, CSRF, contraseñas/sesiones como hash, atomicidad, conflictos
concurrentes, secretos y procedencia de las imágenes. No se identificaron P0/P1
pendientes en los cambios de esta entrega. Los límites del Core y las integraciones
cloud pendientes se conservan explícitos en el manifiesto.

La prueba integrada usa una base PostgreSQL 18.6 nueva y un runtime SQL restringido.
Inyecta un fallo SQL después de insertar identidades para comprobar rollback sin
cuentas huérfanas, hace dos guardados concurrentes, rechaza eliminación de fichas,
comprueba RLS/roles/CSRF, corta la base y reinicia la web. Los registros y sesiones
persisten fuera del contenedor. GCS se comprueba mediante su SDK y emulador local.
También se verifican los módulos Core existentes desde la misma imagen.

Resultados: 108 pruebas de dominio, 142 de servidor, 4 de registro en navegador,
la prueba integrada Docker/PostgreSQL, smoke de puertos 8080/9090 y 13 assets,
escaneo de todas las capas de aplicación, carga de archivos tar y descarga pública
de Docker Hub por digest. Un test con importación en frío agotó inicialmente 5 s;
el reintento sin modificar sus límites ni aserciones pasó las 142 pruebas.

Terraform: fmt, validate y cinco pruebas con proveedor simulado aprobadas. Plan
de preparación sobre el proyecto local detectado: 22 altas propuestas, ningún
cambio o destrucción; no se aplicó. Esas propuestas no acreditan la existencia
de recursos ni confirman que sea el proyecto final del ingeniero. La migración
corporativa ya no requiere crear un job/secret de seed sintético. La secuencia
de publicación fue probada con gcloud simulado: si la migración falla, no se
ejecuta la actualización del servicio.

Los gates de cambios del cliente (32), trazabilidad (210) y auditoría estructural
de los 17 capítulos pasaron sin promover nuevos estados de paridad visual.
La entrega no ejecutó transferencia Atlas/GridFS, Terraform apply ni despliegue
en Cloud Run. Los artefactos y resultados detallados están en
[POSTGRESQL_DOCKER_VERIFICATION.json](../release/POSTGRESQL_DOCKER_VERIFICATION.json).
