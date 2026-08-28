# Pacientes: evidencia Selenium pendiente

El verificador estricto se ejecutó sobre `89e82088d479d69c4bc3e19d3cf4410f247ddc76` y encontró estas acciones sin evidencia runtime `PASS` asociada al SHA actual:

- `PATIENT-NAVIGATE`
- `PATIENT-DOCUMENT-TYPE`
- `PATIENT-INSURANCE-TOGGLE`
- `PATIENT-CONTACT-PRIMARY`
- `PATIENT-ADDRESS-CLEAR`
- `PATIENT-EDIT-SUBMIT`
- `PATIENT-IMPORT-FILE`
- `PATIENT-IMPORT-PREVIEW`
- `PATIENT-IMPORT-CONFIRM`
- `PATIENT-SEARCH`
- `PATIENT-PAGE-SIZE`
- `PATIENT-INACTIVATE`
- `PATIENT-REACTIVATE`

Estas 13 acciones deben conservarse como pendientes hasta que cada una sea ejecutada, afirmada y registrada individualmente por la suite Selenium.
