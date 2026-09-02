# CH15 F10 safe honorarios catalog

`CH15-E0094` supports the visible Items / Honorarios list anatomy. `/catalogs/fees` implements that anatomy as a permission-gated factual empty list with local search and disabled Excel, Nuevo, Registros, and pagination controls. It does not load or create honorario rows, associate a resource, or derive price, tax, discount, Giftcard, settlement, clinical, or audit behavior.

`CH15-E0097` was opened separately and shows the creation form; `CH15-Q004` and `CH15-Q006` leave its source, flag effects, resource eligibility, roles, validation, audit, fees, and settlement undefined. Playwright exercised the F10 flows on isolated port 4181 without reported failure. The verified implementation checkpoint is `c01635eb06286d41a8bd7985d8c151731d0bec7d`; Selenium source remains `PENDING_RUNTIME` because Python is unavailable.
