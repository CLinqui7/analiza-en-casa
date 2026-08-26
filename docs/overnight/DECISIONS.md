# Decisions

## 2026-08-26 · P0 lot 1 authorization and verification boundary

- Supersede the earlier checkpoint-only restriction for the two authorized findings: `SAFE-P0-001` and `SAFE-P0-005` only.
- Keep both findings at `IMPLEMENTED_PARTIAL`: the code, migration and contract tests are present, but no local Supabase runtime exists to demonstrate persisted RLS and RPC behavior.
- The patient portal releases no local quote or patient data before the server validates a hashed link token and single-use OTP. Its default delivery transport is a safe simulated provider; the delivery message contains no clinical or financial content.
- Organization membership is created from a trusted invitation, while role assignment is confined to an authorized database function that derives the caller organization and appends audit evidence. Browser-originated `organization_id` is ignored by the persistence path.
- Do not begin another P0 lot after committing and pushing this change.

## 2026-08-26 · Audit checkpoint and quota boundary

- Freeze this checkpoint at evidence audit, canonical requirements, feature/gap matrices, P0 classification, one final baseline run, commit and push.
- Do not implement P0 gaps, re-audit accepted chapters, refactor the architecture, migrate Supabase, deploy Vercel or open a new investigation in this checkpoint.
- Treat each `chapter_event_id` as reviewed exactly once by its assigned auditor; contact sheets are primary evidence and individual frames/crops/clips are used only for unique or ambiguous states.
- Keep `docs/MASTER_VIDEO_REQUIREMENTS.json` as the canonical requirement, gap and open-question source; generate the Markdown and CSV derivatives deterministically with `npm run audit:master`.
- Use conservative platform classifications: visible parity is `IMPLEMENTED_PARTIAL` unless exact behavior is proven; ambiguous/verbal requirements remain `NEEDS_CLIENT_CONFIRMATION` or `NOT_TESTABLE`.
- Record P0 safety/integrity findings without changing production behavior. Static Supabase findings remain unverified against a live/local database because the CLI and database runtime are unavailable.
- Run the complete automated baseline only once, after all 17 receipts and generated matrices validate.

## 2026-08-25 · Baseline and execution boundaries

- Reused the healthy process already listening on port 4173 after verifying its command and page title; no unrelated process was terminated.
- Used the bundled Playwright runtime and installed Edge, avoiding a new production or development dependency.
- Preserved four pre-existing generated-report timestamp modifications when creating the branch.
- Treat the existing chapter ledgers and receipts as empty templates because `audit:status` reports zero reviewed IDs and zero completed notes.
- Do not treat the mock portal as proof of production portal security; production acceptance requires token hashing, expiry, secondary verification and anti-enumeration.
- Do not use real patient data or invent client financial, insurance, clinical, tax or legal rules.
