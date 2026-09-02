# CH15 F09 safe diagnostic-studies catalog

`CH15-E0084` supports the visible Items / Estudios Dx list anatomy. `/catalogs/studies` implements that anatomy as a permission-gated factual empty list with local search and disabled Excel, Nuevo, Registros, and pagination controls. It does not load or create study rows or derive source, price, tax, discount, state, clinical, inventory, or audit behavior.

The frame’s loaded source rows are not copied. `CH15-Q004` leaves the source, effects of Impuesto/Descuento, write roles, fields, validation, audit, prices, and clinical rules undefined. Playwright passed 18/18 on isolated port 4176; executable Selenium source remains `PENDING_RUNTIME` because Python is unavailable.
