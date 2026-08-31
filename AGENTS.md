# AGENTS.md · Analiza en Casa

## Mission

Turn this synthetic QA baseline into a production-grade, testable and traceable application without losing any functionality evidenced in the 17 video chapters.

The repository contains three different things. Never confuse them:

1. **Current application baseline:** `index.html`, `app/`, `api/`, `supabase/`, `tests/`.
2. **Immutable source evidence:** `references/video-audit/`.
3. **Review outputs:** `video-audit-reviews/` and `docs/overnight/`.

## Non-negotiable safety and data rules

- Use synthetic data only. Never add real patient, clinician, insurer or payment data.
- Never invent prices, coverage rules, clinical rules, medical dosage rules, taxes, retention periods or legal requirements.
- When business information is missing, record it in `docs/OPEN_QUESTIONS.md`, create a safe configurable placeholder, and continue on unblocked work.
- Never commit `.env`, `.env.local`, tokens, API keys, service-role keys, passwords or private credentials.
- Never expose a Supabase service-role key to browser code.
- Never disable Row Level Security to make a test pass.
- Never send diagnosis, treatment, medication details or other sensitive clinical content in WhatsApp, SMS or email previews.
- Patient portal access may not rely on DUI alone. Preserve token hashing, expiry, secondary verification and anti-enumeration behavior.
- Sent quote versions are immutable. Changes create a new version.
- Payments, messages and external jobs require idempotency.
- Signed clinical documents cannot be silently edited. Corrections require authorization, reason, new audit evidence and preservation of the signed version.
- Financial, insurance, inventory and clinical state transitions must be auditable.

## Evidence rules

- Treat `references/video-audit/` as read-only. Do not rename, regenerate, compress, delete or edit evidence files.
- Review all 17 chapters before claiming full video parity.
- For every chapter, review the chapter README, coverage file, event manifest, transcript, event contact sheets, safety contact sheets, individual event frames, detail crops and exact chapter clip when ambiguity remains.
- Record one non-empty observation for every `chapter_event_id` in the chapter ledger under `video-audit-reviews/<chapter>/event_review_notes.csv`.
- Every extracted feature must cite chapter ID, event ID, timestamp and evidence path.
- Never mark an event as reviewed without opening its referenced image.
- Use only these gap statuses: `IMPLEMENTED_EXACT`, `IMPLEMENTED_PARTIAL`, `MISSING`, `CONFLICTS_WITH_VIDEO`, `NOT_TESTABLE`, `NEEDS_CLIENT_CONFIRMATION`.
- Run `npm run audit:verify` after each completed chapter and before final delivery.

## Required order of work

1. Run baseline and repository preflight.
2. Audit all video chapters and produce a feature-level gap matrix.
3. Prioritize P0 operational and safety gaps.
4. Implement missing or partial behavior using small, reversible changes.
5. Run automated and browser regression tests.
6. Re-audit all 17 chapters against the changed application.
7. Fix residual gaps.
8. Improve UX, accessibility, performance, observability and security without removing required behavior.
9. Run final review, commit, push a branch and open a pull request. Do not merge to `main` automatically.

Do not stop after writing a plan. Execute the work. If a business decision blocks one item, document it and continue with the rest.

## Parallel work

- Delegate independent read-only video chapter groups to subagents.
- Do not allow two implementation agents to edit the same files concurrently.
- Audit subagents must not change application code.
- The lead agent consolidates findings, owns the final gap matrix and performs integration.
- Prefer dedicated branches or worktrees for independent implementation streams.

## Commands

```bash
npm ci
npm run codex:preflight
npm test
npm run qa
npm run build:standalone
npm run check
npm run audit:status
npm run audit:verify
```

When production dependencies are added, also run the applicable lint, typecheck, unit, integration and E2E commands and document them in `package.json` and `README.md`.

## Git discipline

- Work on `codex/overnight-audit-hardening` or another `codex/*` branch.
- Keep `main` unchanged.
- Commit after each stable phase with descriptive messages.
- Do not force-push.
- Do not rewrite or squash the original baseline commit.
- Do not commit generated secrets, local caches, `node_modules`, `.vercel`, coverage output or temporary recordings.
- Before opening a PR, run `/review` or an equivalent review against `main` and resolve all P0/P1 findings that are within scope.

## Definition of done

## FULL VIDEO PARITY CONTRACT

Every subsequent agent must read `docs/qa/VIDEO_TO_REACT_TRACEABILITY.json`, work the first unclosed requirement in its assigned batch, and never mark a requirement `EXACT` without a passing video-parity gate. Each change must run focused tests, update the matrices, register its verification SHA, preserve safe blocked-integration states, avoid GitHub Actions and merges, and run regression coverage before changing a certified module.

The overnight task is complete only when all of the following are true:

- Baseline behavior still works.
- All 17 chapter ledgers are complete and `npm run audit:verify` passes.
- `docs/VIDEO_VS_PLATFORM_GAP_MATRIX.csv` exists at feature level.
- P0 gaps that do not require missing client rules are implemented.
- Blocked items are explicit in `docs/OPEN_QUESTIONS.md` and `docs/overnight/FINAL_REPORT.md`.
- Tests pass and results are recorded.
- Browser flows are checked for all six demo roles and the patient portal.
- Mobile widths have no unintended horizontal overflow.
- Supabase migrations remain ordered, repeatable and RLS-safe.
- Vercel configuration contains no secret values.
- A final re-audit finds no undocumented regression.
- A PR is opened with a factual summary, test evidence, residual risks and screenshots.

## Code review rules

### Data boundaries

- Flag any path that can cross organizations, bypass RLS, expose service-role credentials or reveal whether a patient/DUI exists.
- Safe path: server-side authorization plus organization scoping, generic public responses and audited access.

### Clinical records

- Flag silent edits to signed documents, missing correction reason, overwritten versions or clinical content in unsecured notifications.
- Safe path: immutable signed version, authorized correction workflow and secure links.

### Financial integrity

- Flag mutable sent quotes, duplicate payment application, non-idempotent jobs, inconsistent totals or unaudited state changes.
- Safe path: versions, unique keys, transactions and append-only audit evidence.

### Video parity

- Flag removal or simplification of a behavior that appears in the verified video inventory unless the gap matrix contains an approved exclusion.
