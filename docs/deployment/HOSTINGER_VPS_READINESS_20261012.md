# Preparación de migración a Hostinger VPS · 12 de octubre de 2026

## Estado y decisión de arquitectura

La aplicación y su API se ejecutarán juntas en Docker sobre un VPS Ubuntu. PostgreSQL 18 y Nginx vivirán en el host; la aplicación se conectará por `/var/run/postgresql` y los archivos privados se guardarán fuera de la imagen en `/opt/analiza/files`. Sólo Nginx publicará HTTP/HTTPS. El contenedor seguirá escuchando en `127.0.0.1:8080` y PostgreSQL no tendrá un puerto público. La base de este diseño ya existe en [`deploy/ubuntu/`](../../deploy/ubuntu/README.md).

El VPS y el dominio **todavía no están definidos**. No se ha contratado infraestructura, creado una base de producción, transferido información ni cambiado DNS. Los informes de octubre describen Vercel con PostgreSQL en producción; antes de preparar una exportación hay que confirmar el proveedor y la base de origen actuales mediante acceso de operador. El README general también conserva referencias históricas a un preview MongoDB; no debe confundirse ese preview con el origen de la migración.

La variante Ubuntu ahora selecciona `NEXT_PUBLIC_RELEASE_PROFILE=full` tanto al compilar como al arrancar. El perfil anterior `core` excluía Compras, Inventario y Cotizaciones, de modo que no conservaba la navegación productiva. La imagen general mantiene `core` como valor predeterminado; la variante Ubuntu declara `full` explícitamente. El perfil completo requiere su propia regresión conectada sobre PostgreSQL antes del corte.

## Preparación sin acceso a producción

1. Elegir VPS y dominio a partir del uso concurrente, almacenamiento de base/adjuntos y necesidades de recuperación acordadas; no hay una capacidad aprobada que permita fijar tamaño o presupuesto. Hostinger documenta una [plantilla Ubuntu 24.04 con Docker y Compose](https://www.hostinger.com/support/8306612-how-to-use-the-docker-vps-template-at-hostinger/). PostgreSQL 18 y Nginx deben instalarse y administrarse de forma separada siguiendo la guía Ubuntu del repositorio.
2. Inventariar en origen, sin copiar datos al repositorio: versión PostgreSQL, base, rol runtime, extensiones, tabla `analiza.schema_migrations` con los 28 hashes esperados, RLS/FORCE RLS, tamaño, cantidad de adjuntos y proveedor de archivos. Confirmar que el rol de aplicación del destino coincida con los `GRANT` del origen; el ejemplo `analiza_app` de una instalación nueva no debe usarse a ciegas al restaurar una base existente que tenga otro rol.
3. Construir web y operator desde **el mismo SHA** en un entorno Linux `amd64`, con `DATA_MODE=postgresql` y `RELEASE_PROFILE=full`. Registrar digest de ambas imágenes. `npm run db:plan` enumera las migraciones sin conectarse ni modificar la base. Nunca usar el seed sintético contra producción.
4. Ensayar con datos **sintéticos** en una base aislada: migraciones explícitas, rol runtime sin superusuario ni `BYPASSRLS`, organización A/B, login, pacientes, adjuntos, compras de varias líneas, recepción/cuarentena, anulación documental de factura, inventario, cotizaciones y honorarios, PDF, pagos, perfil y portal. Probar reinicio, respaldo y restauración de **base y archivos juntos**. La prueba `npm run test:ubuntu:selfhosted` requiere Docker Linux y las dos imágenes construidas.
5. Resolver los gates de feedback y paridad indicados en [la revisión del commit](../release/FEEDBACK_HOSTINGER_REVIEW_20261012.md) antes de considerar el despliegue listo.

## Migración de datos cuando exista el VPS

1. Registrar el origen definitivo y autorizar una ventana de mantenimiento. Hacer un respaldo verificable previo de PostgreSQL y del almacén privado; conservar los metadatos de archivos y los bytes correspondientes en la misma instantánea lógica. Cifrar el traslado y no copiar volcados, adjuntos, contraseñas ni variables privadas a Git o a equipos de QA.
2. Preparar un destino vacío, con el rol migrador y el **mismo rol runtime autorizado por las ACL restauradas**. Restaurar el volcado con un método compatible con los propietarios y `GRANT` del origen. Una restauración que omita ACL exige un plan explícito de reaplicación y comprobación de permisos; ejecutar simplemente el operator sobre migraciones ya marcadas como aplicadas no recreará esos `GRANT`.
3. Comparar cantidades y sumas de control por colección/tabla relevante, hashes de migraciones, organizaciones, usuarios, roles, auditoría, pagos, cotizaciones y metadatos/bytes de adjuntos. Comprobar en PostgreSQL que las tablas sensibles mantienen RLS y FORCE RLS, y que el rol runtime no puede cruzar organizaciones ni omitir RLS. Aplicar sólo migraciones nuevas con el operator después de verificar el historial; detenerse ante cualquier hash distinto.
4. Levantar la imagen verificada con secretos locales fuera de Git. Probar `/api/health/live`, `/api/health`, rechazo anónimo y flujos autenticados de todos los roles en un host de ensayo con TLS, sin habilitar aún el dominio final. Repetir una restauración desde el respaldo del destino y medir el tiempo real de recuperación.
5. Congelar escrituras en el origen, tomar la copia final, restaurarla y repetir las conciliaciones. Registrar el último identificador/hora de escritura antes de abrir el destino. Si la comprobación falla, mantener el origen como único escritor y posponer DNS. Tras abrir el destino, un retorno al origen exige un plan explícito para las escrituras nuevas: cambiar sólo el registro DNS puede perderlas.

## Dominio, HTTPS y operación

El dominio puede permanecer con su registrador actual. Una vez conocidos dominio e IP, preparar el certificado y probar el sitio antes del corte; luego cambiar los registros A pertinentes en el proveedor DNS efectivo, conservando MX/TXT y cualquier registro de correo. Hostinger documenta [cómo apuntar un dominio al VPS](https://www.hostinger.com/support/1583227-how-to-point-a-domain-to-your-vps-at-hostinger/) y advierte que la propagación puede tardar hasta 24 horas. No cambiar nameservers si bastan registros A. Abrir únicamente los puertos necesarios para SSH administrado y HTTPS/HTTP; Hostinger ofrece [firewall del VPS](https://www.hostinger.com/support/4805502-how-to-set-up-a-firewall-at-vps/).

Los [respaldos automáticos de Hostinger](https://www.hostinger.com/support/1583232-how-to-back-up-or-restore-a-vps-at-hostinger/) son del VPS completo, con frecuencia semanal predeterminada y una instantánea manual temporal. No sustituyen un respaldo independiente y comprobado de PostgreSQL junto con los adjuntos privados. La frecuencia, retención y tiempo objetivo de recuperación quedan pendientes de definición institucional.

## Información necesaria antes de ejecutar

- VPS contratado, región, capacidad y acceso de operador; dominio, titular, proveedor DNS e IP pública.
- Origen PostgreSQL y almacenamiento privado efectivos; roles/ACL, extensiones, tamaño y método autorizado de exportación.
- Inventario de registros DNS existentes, certificado/TLS, ventana de corte, responsable de operación y decisión sobre recuperación y respaldos.
- Aprobación de la definición documental de anulación de factura y fuente vigente de honorarios para cerrar el feedback correspondiente; no se infieren reglas fiscales ni precios.
