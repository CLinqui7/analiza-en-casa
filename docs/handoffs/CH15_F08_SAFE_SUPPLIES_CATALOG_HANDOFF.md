# CH15 F08 safe supplies catalog

`CH15-E0067` supports the visible Items / Insumos table anatomy. `/catalogs/supplies` now provides that anatomy as a permission-gated, factual empty list with local search and disabled Excel, Nuevo, Registros, and pagination controls. It does not load or create supply rows or derive type, manufacturer, tax, discount, lot, state, clinical, inventory, or audit behavior.

`CH15-E0068` was opened as well, but its new-supply form does not establish a safe source, write roles, fields, validation, audit, or clinical rules, so no form is exposed. Playwright passed 12/12; executable Selenium source remains `PENDING_RUNTIME` because Python is unavailable.
