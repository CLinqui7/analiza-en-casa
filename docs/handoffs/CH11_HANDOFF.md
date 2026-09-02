# CH11 review checkpoint

CH11-F01–F06 are verified only as safe, factual partials at functional fingerprint `6ded7888bb0fcb02d2793027c01e03a50bf0f6ebad826776decc92005226fbf8`.

- CH11-E0010/E0015 support the searchable patient criterion, selected-patient context, and colored calendar events. The React implementation filters existing synthetic shifts only; it creates, edits, deletes, or classifies no visit.
- CH11-E0022 supports the observed patient-turn form. The authorized dialog shows only document and company already held by the selected synthetic patient as read-only factual context; Cerrar leaves shifts and audit entries unchanged, while Guardar persists and reloads only the existing B3 synthetic shift with its selected patient linkage. No visit, frequency, classification, type, discount, availability, or financial behavior is introduced.
- CH11-E0050 supports the observed Agenda/Actualizaciones detail layout. The React detail is limited to factual timing, patient and assigned-resource values from an existing synthetic shift; DOCTOR opens/closes it without mutation and the Actualizaciones tab remains visibly disabled under CH11-Q002/Q006. It does not label a visit final, collect clinical observations, or expose deletion, payments, or availability behavior.
- CH11-E0026/E0027 show only the `Puntual` and `Turno` labels; CH11-E0040 shows six readable type labels. The authorized dialog now presents them solely as observed, non-selectable text/disclosure. Focused Playwright opens that disclosure and proves close/reload leaves shifts and audit entries unchanged. It does not enable Puntual, select a service, or give either label clinical, financial, availability, discount, state, or persistence semantics.
- CH11-E0010 supports previous/today/next and Mes, Semana, Lista por semana and Lista por día. These now project only existing synthetic shifts; focused Playwright passed 4/4 for patient filtering, DOCTOR view access, INVENTORY direct-route denial, and every F02 view/navigation control without mutation after reload.
- Eliminar visitas is visible but disabled with an accessible CH11-Q004/Q006 explanation. No deletion, clinical classification, availability, settlement, billing, or Puntual behavior was created.
- Selenium source coverage is action-specific but remains `PENDING_RUNTIME` because Python is unavailable.
- CH11-F04/F05 remain PARTIAL: only the literal labels seen in the opened frames are verified. CH11-F07–F09 remain explicitly not testable under their clinical/financial questions.
- CH11 parity self-test (9/9), CH01–CH03 protected parity, typecheck, B3 client gate, light-only, traceability mirror, and audit verification passed. Focused CH11 Playwright passed 8/8.
- CR-017 is restored as `IMPLEMENTED_DEMO_ONLY` / `DEMO_CERTIFIED`: multi-date shift creation, duplicate/collision validation and demo-local reload are covered by unit, Playwright and assertion-specific Selenium source evidence.
- CR-018 is restored as `PARTIAL_CLIENT_DEFINITION`: only the 6h/8h presets, including overnight duration, are certified. Its tested disabled `AGENDA-SHIFT-PRESET-PUNTUAL` action is explicitly registered; Puntual remains blocked by CR-010.
- CR-010, CR-017, and CR-018 have no CH11-F01 mapping: they are client-originated agenda behavior, not evidence of the CH11 patient-filter calendar.

The prior implementation checkpoint `772286245bc8290fbe553b592101d3829c66337b` remains verified; this CH11-F03 review checkpoint is awaiting its own commit and remote verification.

CR-010 and CH11-Q001–Q008 remain explicit. No Puntual entity, clinical visit transition, tariff, payment adjustment, deletion, Pool/link behavior, or availability rule was inferred. Selenium remains `PENDING_RUNTIME` because Python is unavailable.
