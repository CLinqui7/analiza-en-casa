# CH12 Selenium source repair

CH12-E0004 supports a light-only, read-only `Cuentas por pagar` summary. The new `/payables` route is guarded by `payments:read` and exposes only the factual empty summary, `Resumen` and disabled `Pagos de Servicio` tabs, `Facturas`, `Reclamos`, a local empty-state search, and the four visible but disabled financial controls.

The Selenium source repair targets the actual `tbody .empty-state`, asserts `Sin facturas documentadas` and the query-specific no-record message, then records the search action. Focused Playwright passed 3/3; CH12 parity passed 8/8; traceability mirror, light-mode, and CH01–CH03 protected parity passed. The functional fingerprint is `a5e9bd4c17a6831a16a8534615b2c600109a26420970288bf4d1f6753824979c`.

CH12-F02, F04 and F07 were corrected from inherited unsupported EXACT claims to explicit client-blocked scope. No payment records, financial states, amounts, restrictions, planilla, reports, export, clearing, claims, additions/discounts, or audit/reversal behavior was invented. Selenium source coverage is action-specific but remains `PENDING_RUNTIME` because Python is unavailable.

The repaired Selenium source is pending its own commit. The existing product implementation checkpoint is `c371d47f43096b76b26d2eadc5dbfa48924322a6`; no Selenium runtime PASS is claimed because Python is unavailable.
