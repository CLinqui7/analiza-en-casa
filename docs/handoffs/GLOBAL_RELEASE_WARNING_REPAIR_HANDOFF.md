# GLOBAL_RELEASE_WARNING_REPAIR handoff

All four ESLint warnings are resolved without suppressions. Quote catalog buttons now expose `aria-selected` based on the actual selected concept; Agenda uses `useWatch` for the selected patient; and the provider-boundary test uses a real no-profile fixture. The quote E2E source asserts option selection semantics, and the Agenda E2E source changes the selected patient to prove the read-only context updates.

Static verification is green: lint has no errors or warnings, formatting, typecheck, light mode, CH01-CH03 protected parity, 210/210 video parity, and traceability-mirror self-tests pass. The new fingerprint is recorded as pending Git write, not as an immutable release verification SHA.

Release remains unapproved. The targeted quote case reached its real Playwright path but returned no final runner exit summary due to the inherited server lifecycle. Fresh protected/full Playwright and Selenium runtime evidence remain pending, as do the Git metadata commit/push/fetch operations.
