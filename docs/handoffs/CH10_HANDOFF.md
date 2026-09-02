# CH10 factual-list review checkpoint

CH10-F01 is verified only as a safe factual list at functional fingerprint `232ba542e48e2f2bd9c8989f20ec480d236e9334fb5445dc2a982ec5f704b010`.

- CH10-E0008/E0009 are covered by the synthetic patient list, search, factual Active/Inactive tabs, pagination, row menu, and six-role route/control assertions. The page does not derive triage, treatments, order states, or workflow transitions.
- CH10-F02 is partial: the observed two-choice dialog is visible but both clinical-document choices remain disabled under CH10-Q001.
- CH10-F03 is partial, not exact: the video shows a medication-card form, but the React flow does not implement or certify that clinical form.
- Focused Playwright passed 7/7. CH10 parity self-test passed 10/10; protected CH01-CH04 parity, typecheck, light-only, traceability-mirror and audit verification passed.

CH10-Q001-Q013 remain explicit where applicable. Selenium runtime, Git writes/push, and fresh fetch remain environment blockers; no remote commit is claimed.
