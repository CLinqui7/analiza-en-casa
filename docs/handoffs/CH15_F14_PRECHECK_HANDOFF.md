# CH15 F14 safe discount matrix

`CH15-E0144` and the `CH15-E0148` detail crop support the visible Descuentos matrix anatomy. `/catalogs/discounts` implements it as a permission-gated factual empty matrix with local search and disabled Excel, Nuevo, Registros, and pagination controls. It does not load or create profiles or derive category, percentage, calculation, price, tax, clinical, financial, or audit behavior.

`CH15-Q004` leaves the authoritative source, profile/category taxonomy, percentages, calculations, pricing effects, write roles, fields, validation, audit, and clinical or financial consequences undefined. Focused Playwright passed 6/6 on isolated port 4182. Selenium source is action-specific and remains `PENDING_RUNTIME` because Python is unavailable. The implementation is awaiting its immutable commit SHA.
