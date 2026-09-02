# CH11 patient-agenda precheck checkpoint

CH11-F01 is verified as a safe, factual partial at functional fingerprint `cd8688b74e2004014691eb13b32bff494ddc29bfbe61095ee6f23d349e5e88b0`.

- CH11-E0010/E0015 support the searchable patient criterion, selected-patient context, and colored calendar events. The React implementation filters existing synthetic shifts only; it creates, edits, deletes, or classifies no visit.
- Focused Playwright passed 3/3 for ADMIN filtering, DOCTOR read access, and INVENTORY direct-route denial. Selenium source coverage is action-specific but remains `PENDING_RUNTIME` because Python is unavailable.
- CH11-F04/F05 are now PARTIAL rather than stale EXACT claims. CH11-F07–F09 remain explicitly not testable under their clinical/financial questions.
- CH11 parity self-test (9/9), CH01–CH03 protected parity, typecheck, light-only, traceability mirror, and audit verification passed.

CR-010 and CH11-Q001–Q008 remain explicit. No Puntual entity, clinical visit transition, tariff, payment adjustment, deletion, Pool/link behavior, or availability rule was inferred. Git commit/push/fetch limitations remain pending.
