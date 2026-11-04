# Uso de los cambios clínicos del PDF del 31 de octubre

## Registrar y consultar

En **Clínico → Órdenes médicas**, seleccione **Acciones médicas** o **Acciones de enfermería**, busque al paciente por nombre o DUI y abra la acción correspondiente. Cada registro pide el paciente, su hospitalización y la fecha. Al guardar, queda disponible en **Expediente clínico**.

El expediente reúne cinco secciones: **Resumen**, **Acciones médicas**, **Acciones de enfermería**, **Visitas** y **Expediente completo**. Puede filtrar por hospitalización, consultar versiones anteriores e imprimir una sección o el expediente completo. En enfermería también puede imprimir un solo registro. Los documentos firmados anteriores conservan su flujo de versiones en **Documentos clínicos anteriores**.

## Completar la información que falta

- **Administración → Diagnósticos y escalas:** agregue un diagnóstico y seleccione las escalas que corresponden. Sin una asociación se muestran todas. Las definiciones de escalas se pueden editar mediante campos o cargar desde un archivo JSON; una definición modificada necesita una nueva versión. Las evaluaciones previas conservan la definición con la que se guardaron.
- **Administración → Descuentos:** registre los porcentajes por categoría que el equipo haya definido. Seleccione el perfil en la cotización y revise sus importes antes de guardarla. Si la cotización ya se envió, cree una revisión; el documento enviado se conserva.
- **JVPE:** complete el número propio en el perfil o desde el formulario de notas. La nota usa el número vinculado a la cuenta que la guarda.

Los usuarios operativos pueden completar los catálogos autorizados, incluidas las enfermeras. Los permisos clínicos y el aislamiento entre organizaciones se conservan.

## Medicamentos e inventario

La **Tarjeta de medicamentos** reúne los medicamentos cotizados de la hospitalización y permite escribir los crónicos. Para que una aplicación descuente existencias, complete en la tarjeta el artículo de inventario, la bodega y las unidades por aplicación. Estos valores se capturan expresamente; el sistema no los deduce de una dosis.

En **Administración de medicamentos**, registre hora, dosis, presentación y vía. Para cada medicamento marque **Se aplicó**, **No se aplicó** o déjelo **Sin registrar**. La opción de no aplicación pide un motivo. Los crónicos y los medicamentos no aplicados no descuentan inventario. El sistema verifica existencias y, cuando hay lotes, su disponibilidad y vencimiento para la fecha registrada.

Los medicamentos no aplicados de una cotización aparecen en **Devoluciones de medicamentos** y en Cuentas por cobrar para su revisión. La revisión financiera crea una nueva versión de la cotización; no modifica automáticamente un documento enviado ni inventa una nota de crédito.

## Correcciones y escalas

Una corrección conserva el original, registra quién la hizo y exige un motivo. Las administraciones no se sobrescriben: una aclaración se registra en notas de enfermería y cualquier ajuste de existencias sigue el proceso auditado de inventario.

Las diez escalas del anexo muestran opciones numéricas y conservan sus resultados. ESAS se presenta por síntoma. No se completan con suposiciones los intervalos de clasificación ausentes del documento ni se calculan tratamientos a partir de una escala.

El balance hídrico suma ingresos, egresos y su diferencia. El equipo registra agua endógena, pérdidas insensibles y las horas del período. Un período parcial no se extrapola automáticamente a 24 horas.

Al registrar planes, antecedentes, notas, dosis, descuentos o definiciones, el equipo aporta los datos: la aplicación los organiza, valida y conserva, sin decidirlos por el personal.
