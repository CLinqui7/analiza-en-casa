# CH08 Supabase-boundary repair checkpoint

CH08 administrative profiles are now explicitly demo-local at functional fingerprint `dbebb0a835f5c6a5b4e2845247238f165dc3c1758d7fe105ac1ef1a08eacf544`.

- ADMIN and DOCTOR can open the mock-local profile; NURSE, FINANCE, and AUDITOR remain read-only; INVENTORY is denied the direct route.
- In Supabase mode the detail shows an accessible secure-integration pending explanation and does not expose profile open, save, or dialog controls.
- The Supabase provider rejects a hospitalization carrying `administrativeProfile` before any raw `hospitalizations` upsert. The required audited RPC integration remains pending because it needs linked quote/version identifiers and validated inputs absent from this safe UI.

Focused Vitest tests cover the UI and provider boundary. Selenium runtime remains `PENDING_RUNTIME` because Python is unavailable. Git metadata writes, push credentials, and fresh fetch remain unavailable, so no commit or remote SHA is claimed. CH08-F01–F03 are `BLOCKED_INTEGRATION`; F04–F12 retain their documented scopes.
