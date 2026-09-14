# CH17 F01 safe health-report anatomy

`CH17-E0001` and `CH17-E0003` support the visible Reporte de salud table columns. `/clinical/reports` is now only a light, factual empty table with disabled search and pagination. It does not read or render patients, hospitalizations, vital readings, or audit entries.

`CH16-Q008` controls the required organization-scoped source, roles, sensitive-field minimization, filtering, access audit, retention, and redaction. The existing clinical route and CH09 data are not authorization for report data. Selenium remains `PENDING_RUNTIME` because Python is unavailable.
