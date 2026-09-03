# CH17 F06 evidence and data-boundary precheck

Opened `CH17-E0021`. It visibly shows a health-report insurance table with row-level `Imprimir` selection and the columns Seguro, Póliza, Certificado, Fecha efectiva, Titular and DUI/NIT.

`CH17-F06` is `MISSING` under `CH16-Q008` and `CH17-Q001`. The application deliberately does not render, query, copy, select or print insurance identifiers. `/clinical/hospitalizations` is not an authorization bridge into `/clinical/reports`; `CH09-F03` remains its independent hospitalization requirement.
