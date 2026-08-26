# Decisions

## 2026-08-25 · Baseline and execution boundaries

- Reused the healthy process already listening on port 4173 after verifying its command and page title; no unrelated process was terminated.
- Used the bundled Playwright runtime and installed Edge, avoiding a new production or development dependency.
- Preserved four pre-existing generated-report timestamp modifications when creating the branch.
- Treat the existing chapter ledgers and receipts as empty templates because `audit:status` reports zero reviewed IDs and zero completed notes.
- Do not treat the mock portal as proof of production portal security; production acceptance requires token hashing, expiry, secondary verification and anti-enumeration.
- Do not use real patient data or invent client financial, insurance, clinical, tax or legal rules.
