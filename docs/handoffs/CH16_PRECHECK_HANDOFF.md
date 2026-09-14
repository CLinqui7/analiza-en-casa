# CH16 F01 factual discount matrix

`CH16-E0001` and `CH16-E0018` support the visible Descuentos table anatomy. `/catalogs/discounts` is certified only as a permission-gated, factual empty matrix: its observed family columns, local empty-state search, and disabled controls are covered by Playwright. No source profile rows or percentages are copied or applied.

`CH16-Q001`, `CH16-Q002`, `CH16-Q003`, and `CH16-Q005` leave assignment, source data, values, calculation, precedence, authorization, validation, and audit undefined. Selenium source is action-specific and remains `PENDING_RUNTIME` because Python is unavailable. The verified implementation checkpoint is `02c901a522e3bc0603c1b3c34501836928acf5ff`; the current functional fingerprint is `69952f5801bd6a6a7d0324a0d32241308faf0e6f2fc69b7bb69f842a6d30fdb1`.

## CH16 F08 report access boundary

`CH16-E0041`–`CH16-E0044` establish only the Reporte de salud navigation and visible sensitive-column anatomy. `CH16-Q008` requires the approved organization-scoped source, permitted roles, field minimization, filters, access audit, and retention before any report fields are exposed. The existing clinical route and CH09 data are not treated as authorization.
