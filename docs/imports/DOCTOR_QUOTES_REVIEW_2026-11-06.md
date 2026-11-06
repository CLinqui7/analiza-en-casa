# Revisión de médicos importados y selección en cotizaciones · 6 de noviembre

## Alcance y conciliación

Se revisaron las 633 fichas actuales de la organización principal frente al plan autorizado del Excel: los 623 perfiles procedentes del archivo conservan exactamente sus datos y ubicaciones. La revisión inicial fue de sólo lectura. Los datos reales, capturas y conciliaciones permanecen fuera del repositorio, en la carpeta privada del operador.

No hay JVPM ni CONADEM repetidos entre perfiles, ni grupos de nombres normalizados idénticos que involucren altas del lote. Esto no prueba por sí solo identidad única. Se amplió la comparación a nombres sin tildes, palabras en diferente orden y nombres abreviados. Un par de nombres abreviados dentro de la fuente tiene JVPM, teléfonos, correos y especialidades distintos; se conserva separado.

Existen dos grupos de nombres repetidos anteriores a la carga, con cinco fichas en total. Una sexta ficha comparte un DUI con uno de esos grupos pese a tener otro nombre. Dos perfiles completos del Excel tienen nombres compatibles con esos grupos antiguos, pero no existe identificador profesional o contacto compartido que permita conciliarlos inequívocamente. Se revisaron además fechas, auditoría y referencias actuales en pacientes, ingresos, cotizaciones, borradores y visitas. Las fichas antiguas ya tienen referencias operativas; documentos, direcciones y honorarios históricos presentan contradicciones.

El cliente pidió que revisáramos esas coincidencias. La evidencia disponible no determina el DUI correcto ni autoriza inferir que todos los homónimos son una persona. No se borran fichas ni se reescriben cotizaciones enviadas para ocultar el problema. El detalle queda en `fichas-anteriores-por-revisar.csv` e `identity-source-review.json`, en la carpeta privada `C:/Temp/analiza-doctor-review-private-20261106/`. No se declara que el directorio completo carezca de duplicados.

## Errores corregidos

- Búsqueda compartida para directorio y cotizaciones: admite tildes omitidas, espacios, palabras en otro orden, nombre parcial, JVPM, CONADEM, especialidad y clínicas adicionales. Conserva las selecciones al cambiar el filtro.
- Los homónimos muestran identificador profesional o documento y especialidad; si aún coinciden, un número de ficha estable permite distinguir las opciones. No se fusionan identidades por su nombre.
- La tabla muestra teléfono fijo y celular disponibles; ya no aparenta ausencia de contacto cuando sólo falta el fijo.
- Finanzas, Médico y Gerencia pueden consultar los datos mínimos de selección de médicos de su organización. Antes podían escribir cotizaciones pero recibían un directorio vacío porque la lectura requería administrar la configuración. Se mantienen restringidas la edición del directorio, información personal y archivos privados.
- Crear, editar o enviar una cotización valida que el médico principal y secundario pertenezcan a la organización. Antes se validaban sólo los médicos de líneas de honorarios. No se cambian las reglas de versiones enviadas ni los campos históricos pendientes.

## Evidencia local

- 356/356 pruebas unitarias y de servidor aprobadas, incluyendo búsqueda con 700 perfiles, homónimos, roles, proyección de datos privados y referencias inválidas de cotizaciones.
- 35/35 escenarios de navegador aprobados: CH01–CH03, B4, cotizaciones, clínicas adicionales y selección/guardado/recarga con 700 médicos históricos; anchos 1440/768/390 sin desbordamiento del diálogo.
- 144/144 pruebas del sistema anterior y 76/76 controles QA aprobados. ESLint y escaneo de secretos aprobados.
- Incidencias de verificación corregidas: el contador de búsqueda ya no compite con el mensaje de estado de guardado; el nuevo escenario sigue el enlace real de edición y sale de `?create=1` antes de recargar. TypeScript se repite después de detener el servidor de pruebas, que regeneraba tipos simultáneamente.

Las pruebas de PostgreSQL se ejecutarán en una base desechable desde código publicado en GitHub antes de desplegar. La comprobación real posterior debe verificar ambos selectores, todos los IDs importados, búsqueda, conservación de selección y el borrador previo del usuario. No se crean cotizaciones ni se editan médicos reales para probar. No se declara una nueva auditoría completa de los 17 videos ni un ensayo de MongoDB en producción.
