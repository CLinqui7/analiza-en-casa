# Clinical restructure — implementation and verification ledger

Source: client-authorized `analizaencasa31oct_.pdf`, 12 pages, SHA256 `38528620ea90f313a4b4de8ba88c7cba1aeec5a3a0e7f75c087578fd8022c65b`. Source stays outside Git. Screenshot and Nov 3 instruction authorize staff-entered configuration instead of historical blanket blockers. All pages were rendered and inspected. New video review was explicitly withdrawn by the user.

Status: IN PROGRESS. No production completion or new EXACT certification claimed.

| Requirement | Source | Implementation / acceptance |
|---|---|---|
| Clinical navigation: quotes, admissions, agenda, record, orders | p1 | Preserve old deep links; new primary hierarchy |
| Record: summary, medical, nursing, visits, full record | p1 | Patient/case isolation; quotes, new and legacy records; print each tab/one nursing record/all; recent filter |
| Orders: medical/nursing actions; all patients and name/DUI search | p1–2 | Replace disabled selector; explicit forms; no active/inactive KPI cards |
| Indication, evolution, history, background | p2 | Patient, hospitalization, date, manual summary; append-only corrections with author/reason |
| Medication card | p2 | Quote medicines plus manual chronic medicines; versioned edits, view and print |
| Fluid balance | p2–3 | Six day/night rows; 4 intake/5 output columns; manual endogenous/insensible inputs; arithmetic totals |
| Care plans | p3 | Diet/nursing text; labs from selected quote; record feed |
| Administration | p3–4 | Manual dose/presentation/route/time; applied/not applied/reason; stock consumed once; chronic excluded |
| Returns | p4 | Not-applied medicines appear in report and receivables; review revises quote without changing sent versions |
| Vitals | p4 | Time, heart/respiratory rate, oxygen, temperature, pressure, HGT; add rows |
| Nursing notes | p4 | Time, note; JVPE resolved from authenticated user's profile |
| Scales | p5–12 | EVA, Glasgow, Ramsay, ECOG, ESAS, Karnofsky, Downton, Braden, Norton, Barthel; source version snapshot, numeric selection |
| Diagnosis catalog and quote selector | p5 | 22 supplied entries, staff additions and scale associations; unmapped diagnosis shows all scales |
| User-entered missing definitions and discounts | Nov3 message | Staff may configure/upload definitions; no invented rates/doses; tenant-scoped audit |

Implementation decisions:

- Inventory source and units per application belong in the editable medication card. They are not inferred from dose and do not reappear as quantity/warehouse fields in the administration form. Stock is consumed transactionally using released, unexpired lots where applicable.
- The card retains optional manual instructions for dose, schedules, start, duration and dilution seen in CH10. New PDF explicitly replaces old navigation and summary indicators.
- Scale inputs and score arithmetic reproduce the supplied annex. ESAS remains a profile without an invented aggregate. Braden's supplied classification omits scores 12 and 19; classification is not guessed. Staff can version their definitions. These are recorded assessments, not automated treatment recommendations.
- Legacy documents and vitals remain visible with their provenance. Historical signed documents retain their signing/correction workflow. New records are append-only, including corrections.
- Missing JVPE is visibly identified and can be completed in the profile; no number is fabricated or accepted from a note payload.
- UI references: W3C form grouping (https://www.w3.org/WAI/tutorials/forms/grouping/), GOV.UK checkbox guidance (https://design-system.service.gov.uk/components/checkboxes/), W3C reduced motion (https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions).

Baseline: repository preflight PASS; React suite 284 tests / 65 files PASS. Focused legacy evidence reviewed by read-only agent: CH10-E0013, CH10-E0050, CH17-E0038, CH17-E0043 and CH17 safety contact sheet 005. This is not a full video re-audit.

Required verification: persistence after reload; cross-tenant rejection; concurrent/retried consumption; no stock change for non-applied/chronic; versions/correction races; JVPE spoof rejection; scales min/max/incomplete/version; print isolation; mobile/keyboard/reduced motion; existing regression and client/video gates. Verification results and release SHA will be appended after execution.

Phase 1 verification (before isolated PostgreSQL verification): TypeScript, lint, production build, security scan, 299 React/unit tests, 144 Node tests, 76 QA checks and video audit integrity passed. Nine new browser tests passed in demo mode: forms for every action, all ten scale scores, 1440/390px layouts, and authorized configuration access for five staff roles. These browser checks do not prove database persistence. `scripts/verify-clinical-postgres.ts` adds isolated database tests and remains to be executed. Production remains on the previous release.
