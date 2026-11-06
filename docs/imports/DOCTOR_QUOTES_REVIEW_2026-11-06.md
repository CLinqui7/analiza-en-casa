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

TypeScript también aprobó al finalizar el servidor de pruebas. Se revisaron los cambios de UI, proyección por rol, validación de referencias y persistencia; no quedaron hallazgos P0/P1 dentro del alcance.

## PostgreSQL desde código publicado

Commit publicado y verificado en GitHub antes de ejecutar: `db001857ebeb8ed1b73e764254738ba809ef1a47`. Bundle local/remoto SHA-256 `02a1c8d4fe03a1a6acc522a5bfa68db77fcbb97090aef3582f822c44caca0cf3`.

Diez grupos aprobaron en un contenedor desechable con 701 filas fuente / 700 médicos sintéticos: permisos y RLS, reintentos concurrentes, enriquecimiento/versiones, snapshot obsoleto, rollback de lote, lectura limitada por rol, guardado/recarga/edición de ambos médicos, rechazo de referencias inexistentes o extranjeras y selección inmutable al enviar. La base desechable fue eliminada; no hubo escrituras de prueba en producción.

No se crean cotizaciones ni se editan médicos reales para probar. No se declara una nueva auditoría completa de los 17 videos ni un ensayo de MongoDB en producción.

## Primera comprobación pública y ajuste visual

Se desplegó `47f4c3f88417b742b589ab528d29f64309290d8d` después de confirmar su presencia en GitHub. El script de revisión autenticada se corrigió en `de376cce65f11d2ed80cc3c9faebe4ac1868bcf8` para esperar la carga del workspace: inicialmente inspeccionaba las opciones antes de que llegaran por red. No se relajó el requisito de 633 opciones distintas.

La ejecución posterior aprobó: 633 médicos, los 623 IDs importados en ambos selectores, búsquedas sin tildes/por identificador/clínica adicional, selección de principal y secundario, conservación al cambiar el filtro, anchos 1440/768/390 y cero errores JavaScript. Se interceptaron dos intentos de autoguardado de formulario y se comprobó que el borrador original del usuario permaneciera idéntico. Cero escrituras de negocio. La autenticación conserva su auditoría normal.

La organización sintética completó 59 rutas públicas en tres anchos, una restricción esperada y cero errores JavaScript. No se ejercitó «Ver devoluciones», pues esa organización no tenía devoluciones. La inspección visual detectó el recorte normal de un nombre largo dentro del selector nativo móvil; se añadió la etiqueta completa debajo, con ajuste de línea y descripción accesible. Ese ajuste `5ce9431f1ae6e643c0df111c399c8b4a04b0b968` aprobó 11/11 escenarios afectados de navegador, TypeScript y ESLint. No modifica persistencia ni permisos.

## Cierre verificado

- Release final activo: `ac44496b0bd05561c51ea06db978e8ebd5e19a24`, confirmado en GitHub antes del despliegue y en la etiqueta de la imagen activa después. Imagen `sha256:eb82a4372bcdd51a61c14091b2e27c1084135d5caead1747215354e5d9270b81`.
- Se repitió la prueba autenticada en ese release: los 623 importados siguen disponibles entre 633 opciones únicas; búsqueda, ambos selectores, nombre completo legible y tres anchos aprobados. Borrador original intacto, cero escrituras de negocio y cero errores JavaScript. Capturas finales inspeccionadas y conservadas sólo en la carpeta privada.
- Snapshot de lectura posterior al despliegue: 633 médicos; los 623 del archivo coinciden exactamente con el plan, sin campos ni clínicas alterados. Persisten los dos grupos antiguos de nombre repetido, ninguno creado por el lote, y ningún JVPM/CONADEM repetido entre perfiles. Las identidades dudosas continúan documentadas, no resueltas por suposición.
- Respaldo previo al release final: `1db45cbdc945a1933bea72b44ce575842040aa4aea1fb909b0e14f579a7d5a86`; el primer despliegue de esta revisión creó `6952b0bf3a8a9b93bf6b11927950b46646a6fe2f1a440665ec7fc514b46e9179`. No se certifica restauración ni copia externa de estos dos nuevos snapshots; la restauración posterior a la importación está documentada en el informe anterior.
- Web y PostgreSQL saludables y salud pública HTTP 200. El despliegue pausa brevemente la web para respaldar, y se observó una conexión reiniciada durante el arranque; no se afirma disponibilidad ininterrumpida. No hay DDL nuevo ni actualización de Ubuntu.
- Los gates de 32 solicitudes, 210 requisitos, espejo, auditoría documental, formato y seguridad pasaron. No se promovieron estados históricos a EXACT. La cuenta temporal local utilizada por la prueba se eliminó al finalizar; las credenciales originales no cambiaron.

Para revertir sólo la interfaz, se conserva la imagen `47f4c3f`; el release anterior al lote de correcciones es `14ef0d1`. No eliminar perfiles con referencias para simular una reversión. La rama y el PR siguen abiertos sin fusionar `main` ni ejecutar GitHub Actions.
