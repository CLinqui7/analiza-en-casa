# CH09 traceability generator and mirror repair checkpoint

CH09-F02 restores the evidenced row-menu layout at functional fingerprint `7e255a0f3b152209528a060a4c123bf5649dafdde2c8576930bd64e31e6a7853`.

- CH04-F004 is restored to its own CH04-E0005 evidence: selecting the synthetic patient shows associated DUI/NIT, Teléfono and Correo as read-only fields. Its trace now cites QUOTE-PATIENT-SELECT and CH04 quote tests only.
- The adjacent CH04-F003 trace is again NOT_TESTABLE under CH04-Q001, with no browser tests or CH09 evidence. The traceability, certification and CSV mirror audit found no CH09 references in any CH04 requirement record.
- Focused CH04 Playwright passed 1/1 and the CH04 parity self-test passed 11/11. CH09 Playwright remains 5/5; CH09 and protected CH01–CH03 parity gates remain green.

- The list shows patient, DUI/NIT, hospitalización, triage, empresa, clínico, inicio, fin and duración without deriving clinical values that do not exist in the record.
- Search has a real local effect. Estado clínico, activado por, tipo de servicio and tipo de atención are visible but disabled with an accessible CH09-Q002/Q004 explanation.
- Focused Playwright and Selenium source tests are discrete and assertion-backed. Selenium runtime remains pending because Python is unavailable.
- The nine factual fields occupy the second table-header row. Playwright covers a field-specific match and non-match for every field; Aplicar and Activos are visible but disabled with the CH09-Q002/Q004 explanation.
- Nine visible per-column fields now perform case-insensitive factual matching over the corresponding displayed values. Playwright verifies a patient-column match and a non-match empty state. Aplicar and Activos remain blocked by CH09-Q002/Q004; pagination remains partial because ordering and page size are undefined.

- CH09-E0016 now has an accessible green row-menu toggle in the left Acciones column, including its matching blank filter cell. Ver cotizaciones opens only the existing case-scoped quote for roles with both clinical:read and quotes:read; NURSE keeps factual-list access but cannot expose that link.
- Perfil clínico, Doc de Relevos, Reingresos, Reinfecciones, Ulceraciones and Near miss are visible, disabled CH09-Q006 boundaries. They do not create a profile, document, or clinical event without an approved model, source, authorization, audit trail, and workflow definition.
- Focused Playwright passes 5/5, including the direct menu-to-quote URL and NURSE guard. Selenium source matches those assertion-backed flows but runtime remains pending because Python is unavailable.

- CH09-F01 and CH09-F02 now have a complete CSV mirror, including action and test IDs, statuses, blockers, reasons, notes, and the current functional fingerprint. The new read-only mirror verifier compares every CSV field to reviewed JSON and certifications; its in-memory anti-drift self-test passes.

- `qa:video-parity:generate` now overlays reviewed metadata before emission, so it preserves route/file evidence, action/component IDs, statuses, test IDs, blockers, notes, and verification SHA. A real regeneration keeps CH04-F004 EXACT with QUOTE-PATIENT-SELECT and retains both CH09 records. The mirror verifier also covers CH04-F004 and proves action/status plus CSV drift detection.

CH09-F02 remains partial for the disabled clinical workflows; F03–F11 stay partial and F12–F14 remain not testable. Git metadata writes, push credentials and fresh fetch are unavailable, so no commit or remote SHA is claimed.
