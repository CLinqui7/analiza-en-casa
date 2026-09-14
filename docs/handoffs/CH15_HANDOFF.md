# CH15 precheck

CH15-F01–F04 require tenant-scoped patient/acuse, warehouse, stock, template or quote-state rules under CH15-Q001/Q002/Q003. They remain blocked and no operational behavior was added.

CH15-F06 is the first safe independent subset. `CH15-E0046` supports the Items / Medicamentos list anatomy; `CH15-E0047` supports only the observed form anatomy, not an approved medication model. The implementation at `/catalogs/medications` is a permission-gated factual empty list with search and visible disabled Excel/Nuevo/pagination controls. It creates no rows, clinical attributes, prices, lots, status changes, export, or audit mutation.

Focused Playwright passed 6/6 at port 4176, including ADMIN/INVENTORY/AUDITOR access and direct DOCTOR/NURSE/FINANCE denials. Selenium source is executable but remains `PENDING_RUNTIME` because Python is unavailable. The implementation and cached tracking ref are `e89a734e92c8fddcbe651f4ee6066dd619095df6`; fresh push/fetch are blocked by unavailable HTTPS credentials and denied Git metadata writes, including the metadata-only follow-up commit.
