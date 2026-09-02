# CH14 F04 · Acuses

CH14-F04 implements the evidence-backed, read-only `Inventario / Acuses` surface from CH14-E0029. It shows the Tipo Área control, the five observed tabs, and the observed table anatomy. Only roles that already hold both `patients:read` and `cases:read` see existing synthetic patient/case rows; INVENTORY-only receives an explicit access-scoped empty state.

The Acuses panel does not create acknowledgements, change statuses, reserve stock, expose unscoped patient data, or fabricate resources, availability, requests, or tasks. Those sources remain factual empty states under CH14-Q002. Focused CH14 Playwright passes 5/5; typecheck, CH14/protected parity, traceability generation/mirror, light-only, and audit verification pass against the dirty F04 worktree. Selenium source is executable but remains PENDING_RUNTIME because Python is unavailable. The pre-F04 base checkpoint is `7912d2930007b1cb843b57c88ccc757e34ec126d`.
