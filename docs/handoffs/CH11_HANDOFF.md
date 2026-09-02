# CH11 certification-SHA repair checkpoint

CH11-F01/F02 are verified as safe, factual partials at functional fingerprint `f9a3323f58e660129b22033e5ad3b6e00e0b1ae383f021612f5d436459b95424`.

- CH11-E0010/E0015 support the searchable patient criterion, selected-patient context, and colored calendar events. The React implementation filters existing synthetic shifts only; it creates, edits, deletes, or classifies no visit.
- CH11-E0010 supports previous/today/next and Mes, Semana, Lista por semana and Lista por día. These now project only existing synthetic shifts; focused Playwright passed 4/4 for patient filtering, DOCTOR view access, INVENTORY direct-route denial, and every F02 view/navigation control without mutation after reload.
- Eliminar visitas is visible but disabled with an accessible CH11-Q004/Q006 explanation. No deletion, clinical classification, availability, settlement, billing, or Puntual behavior was created.
- Selenium source coverage is action-specific but remains `PENDING_RUNTIME` because Python is unavailable.
- CH11-F04/F05 are now PARTIAL rather than stale EXACT claims. CH11-F07–F09 remain explicitly not testable under their clinical/financial questions.
- CH11 parity self-test (9/9), CH01–CH03 protected parity, typecheck, light-only, traceability mirror, and audit verification passed.
- CR-017 is restored as `IMPLEMENTED_DEMO_ONLY` / `DEMO_CERTIFIED`: multi-date shift creation, duplicate/collision validation and demo-local reload are covered by unit, Playwright and assertion-specific Selenium source evidence.
- CR-018 is restored as `PARTIAL_CLIENT_DEFINITION`: only the 6h/8h presets, including overnight duration, are certified. Its tested disabled `AGENDA-SHIFT-PRESET-PUNTUAL` action is explicitly registered; Puntual remains blocked by CR-010.
- CR-010, CR-017, and CR-018 have no CH11-F01 mapping: they are client-originated agenda behavior, not evidence of the CH11 patient-filter calendar.

The implementation checkpoint `772286245bc8290fbe553b592101d3829c66337b` is committed and matches `origin/codex/react-full-parity-selenium-100`; `b19fb3371e2886c796f5abde32a45de6f597492f` remains the pre-batch base SHA. This metadata repair is separate from the implementation checkpoint.

CR-010 and CH11-Q001–Q008 remain explicit. No Puntual entity, clinical visit transition, tariff, payment adjustment, deletion, Pool/link behavior, or availability rule was inferred. Selenium remains `PENDING_RUNTIME` because Python is unavailable.
