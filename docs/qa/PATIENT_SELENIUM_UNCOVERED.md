# Pacientes: evidencia Selenium pendiente

El verificador estricto se ejecutó sobre `8138a679ba3d2d13b1a3cf3f3a13f4cde6c71fba` y encontró estas acciones sin evidencia runtime `PASS` asociada al SHA actual:

- `PATIENT-IMPORT`
- `PATIENT-IMPORT-FILE`
- `PATIENT-IMPORT-PREVIEW`
- `PATIENT-IMPORT-CONFIRM`
- `PATIENT-IMPORT-CANCEL`
- `PATIENT-EXPORT`

Estas seis acciones permanecen pendientes porque corresponden exclusivamente a Import/Export, fuera del alcance del lote D. Las acciones de búsqueda, paginación, transición de estado y edición de pacientes tienen evidencia runtime `PASS` individual.
