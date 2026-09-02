# CH12 precheck and first safe requirement

CH12-E0004 supports a light-only, read-only `Cuentas por pagar` summary. The new `/payables` route is guarded by `payments:read` and exposes only the factual empty summary, `Resumen` and disabled `Pagos de Servicio` tabs, `Facturas`, `Reclamos`, a local empty-state search, and the four visible but disabled financial controls.

Focused Playwright passed 3/3: ADMIN and FINANCE can read the surface; INVENTORY is denied directly; reload leaves audit storage unchanged. CH12 parity passed 8/8, CH11 focused Playwright passed 8/8, CH11 parity passed 9/9, CH01–CH03 protected parity, traceability generation/mirror, light-mode, typecheck and audit verification passed. The functional fingerprint is `a5e9bd4c17a6831a16a8534615b2c600109a26420970288bf4d1f6753824979c`.

CH12-F02, F04 and F07 were corrected from inherited unsupported EXACT claims to explicit client-blocked scope. No payment records, financial states, amounts, restrictions, planilla, reports, export, clearing, claims, additions/discounts, or audit/reversal behavior was invented. Selenium source coverage is action-specific but remains `PENDING_RUNTIME` because Python is unavailable.

The source/base checkpoint is `9ba208fd7faafca628743d3f50fe37f4ece09d1a`. Git metadata writes are denied in this environment, so commit/final/remote SHA remain pending rather than being misrepresented.
