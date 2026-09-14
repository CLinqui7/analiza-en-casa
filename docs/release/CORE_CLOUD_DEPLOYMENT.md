# Edición Core con MongoDB — preparación cloud

> Documento histórico de la entrega Mongo. La configuración Docker, compose y
> Cloud Build actual lo sustituye por PostgreSQL 18. Para comandos vigentes use
> [Cloud Run](../deployment/CLOUD_RUN.md) y [contrato SQL](../deployment/POSTGRESQL.md).
> Los resultados anteriores no acreditan la entrega PostgreSQL actual.

Esta edición reduce temporalmente la superficie siguiendo la nueva orden del cliente.
No sustituye el inventario de video/Excel ni declara completadas sus funciones pendientes.
No hay conversión a HTML estático: React/Next y sus endpoints de servidor se conservan.

## Contrato de datos

- `NEXT_PUBLIC_RELEASE_PROFILE=core`, `NEXT_PUBLIC_DATA_MODE=mongodb` y
  `ANALIZA_DATA_MODE=mongodb`. El build rechaza configuraciones Core inconsistentes.
- `MONGODB_URI` y `MONGODB_DB=analiza_en_casa` son exclusivamente del servidor.
  Nunca usar variables `NEXT_PUBLIC` para credenciales.
- Atlas existente: proyecto `6aa160fb84024a21784cb906`, clúster `analiza-cluster`.
- Sin fallback local. Un error de servidor conserva el formulario y no declara éxito.
- Autenticación de servidor, cookies HttpOnly/Secure, CSRF y filtros por organización.
- `/api/health/live` comprueba proceso; `/api/health` comprueba Atlas y devuelve 503
  si no está disponible. Ni un build verde ni liveness acreditan persistencia.
- Los documentos se guardan en GridFS privado en Atlas, no en el disco efímero.
- Datos ficticios únicamente durante esta prueba. Catálogos manuales no constituyen reglas clínicas.

## Superficie reducida

Disponibles para verificación: Login, Dashboard operativo, Pacientes (crear/editar/
adjuntos/búsqueda/exportación), Hospitalizaciones (crear/editar/asignar enfermeras),
Agenda (programar/consultar), Equipo de enfermería, Médicos y Catálogos operativos.
Cada rol mantiene sus permisos anteriores. No hay una elevación de acceso por mostrar una ruta.

Fuera de esta edición: cotizaciones, seguros/preautorizaciones, pagos/cuentas,
compras, inventario, reportes, pantallas clínicas y escalas, portal/QR/WhatsApp,
auditoría visual, ayuda/cambios y catálogos heredados incompletos. También se ocultan
importación masiva Mongo, recuperación de clave no integrada, PIC y controles de
Agenda pendientes. El código y los 210 requisitos/32 solicitudes no se eliminan.
El proxy cierra rutas y endpoints fuera del alcance; `/api/operations` permite sólo
catálogos y alta de enfermeras en Core. Volver a habilitar requiere pruebas específicas.

## Docker

`npm run docker:build` crea frontend y API en una sola imagen con Next standalone.
La imagen usa Node 24, usuario sin privilegios y puerto 8080; copia assets y funciones.
No incluye `.env`, `.local`, `.git`, credenciales ni evidencia de video.

El contenedor recibe las variables privadas en runtime desde el proveedor cloud.
`compose.yaml` sirve para pruebas del contenedor y exige una URI Atlas externa.
No crea una base local. La prueba local no es el entregable cloud.

Para el esquema se usa **el bootstrap existente** mediante el target `operator`:

```sh
npm run docker:bootstrap:build
docker run --rm --env-file /ruta/privada/operator.env analiza-operator --dry-run
# Aplicación explícita, desde un origen autorizado en Atlas:
docker run --rm --env-file /ruta/privada/operator.env analiza-operator --seed-synthetic
```

Las variables privadas del operador incluyen las documentadas por `mongo-bootstrap-command.ts`.
No se reinicializa el administrador si ya existe. La semilla usa `$setOnInsert` y no reemplaza
registros existentes. El target operador no es el servicio web desplegado.

## Prueba sin contratar pagos: Vercel + Render Free + Atlas

1. Completar registro/verificación de una cuenta Render del cliente, sin método de pago.
2. Conectar sólo este repositorio y rama. `render.yaml` fija explícitamente `plan: free`
   y despliegues manuales; omitir el plan podría seleccionar uno de pago.
3. Configurar `MONGODB_URI` como secreto runtime en Render. No enviar por chat.
4. Leer los rangos **efectivos del servicio creado** en Connect → Outbound. Añadir sólo
   esos rangos a Atlas con descripción. No usar `0.0.0.0/0`, rangos supuestos ni automatizar
   cambios de allowlist con credenciales administrativas en el servidor web.
5. Confirmar `/api/health` 200 en Render y ejecutar pruebas de sesión/tenant/guardado.
6. En Preview de Vercel, configurar los tres modos Core y `ANALIZA_API_ORIGIN` con
   el origen HTTPS exacto de Render. No se expone como variable pública. Los rewrites
   `beforeFiles` enrutan `/api/*` al contenedor; la web y sus cookies siguen siendo same-origin.
7. Mantener Deployment Protection y `VERCEL_PREVIEW_FEEDBACK_ENABLED=0`. Publicar sólo Preview.
8. Repetir `npm run test:core:mongo` contra esa URL, con credenciales de operador privadas
   y bypass de QA temporal, si lo necesita la protección. Revocar el bypass al terminar.
   Capturar URL, deployment ID, SHA, imágenes y resultado real. Sin esta prueba NO está listo.

Render Free se suspende tras 15 minutos inactivo; despertar tarda aproximadamente un minuto.
Tiene cuotas y no es una recomendación para producción clínica. No se usarán pings artificiales
para evadir los límites. Vercel Hobby tampoco da salida fija gratuita hacia Atlas.
Fuentes: [Render Free](https://render.com/docs/free),
[salida de red](https://render.com/docs/outbound-ip-addresses),
[Blueprint](https://render.com/docs/blueprint-spec).

## Google Cloud: preparado, NO provisionado

Cloud Run ejecutará la misma imagen; Cloud SQL no reemplaza MongoDB y no se necesita para este flujo.
`cloudbuild.yaml` prepara pruebas → imagen → Artifact Registry → Cloud Run Preview protegido por IAM.
Debe asociarse a un trigger de repositorio con **aprobación requerida**; no a `main` ni a producción.
Los valores `REQUIRED` deben sustituirse por recursos reales antes de habilitarlo.

Prerequisitos futuros: proyecto del cliente, Artifact Registry, cuenta de ejecución limitada,
Secret Manager (acceso sólo a la versión de URI necesaria), red/subred, salida VPC completa
y Cloud NAT con IP reservada autorizada en Atlas. Cuenta de build con Artifact Registry Writer,
Cloud Run Developer y Service Account User sobre la identidad de ejecución; sin roles Owner/Editor.
El acceso `run.invoker` es explícito. No retirar IAM para resolver un error.

**No ejecutar Cloud Build, crear dominios, NAT ni activar servicios facturables bajo la instrucción
actual de coste cero.** Las cuotas gratuitas no garantizan coste cero para la red, builds y dominios.
Esto es preparación del repositorio, no un deployment Google Cloud completado.
Fuentes: [Cloud Build → Cloud Run](https://docs.cloud.google.com/build/docs/deploying-builds/deploy-cloud-run),
[salida IP estática](https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip).

## Prueba reproducible

Cargar por canal privado las variables de operador y `ANALIZA_VERIFY_URL` antes de
`npm run test:core:mongo`. El script crea únicamente identidades/registros QA, comprueba
el navegador y la base real, niega accesos cruzados, comprueba errores de guardado,
versiones y colisiones, y escribe evidencias bajo `.local/core-verification/` (no se commitean secretos).
Un informe cuyo origen sea `localhost` sólo acredita el contenedor contra Atlas, no Vercel.
