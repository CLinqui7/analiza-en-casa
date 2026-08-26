# Test log

## 2026-08-26 · CH16 forensic audit

- Per-chapter Python verifier: PASS (44/44 events, 19/19 crops, 5 event sheets, 6 safety sheets and 9 traceable features).
- Ledger review confirmed 44 concrete observations across the discount matrix, pagination, new profiles and transition to the health report.
- Negotiated category rules and the claimed clinical post-save lock remain VERBAL; no percentage or clinical rule is inferred.

## 2026-08-26 · CH15 forensic audit

- Per-chapter Python verifier: PASS (148/148 events, 56/56 crops, 17 event sheets, 16 safety sheets and 16 traceable features).
- Ledger review confirmed 148 concrete observations across missing-item reconciliation, acknowledgements and item/catalog flows.
- Selectable quote states and the verbal lot/professional linkage rules remain unconfirmed; catalog values are evidence, not business rules.

## 2026-08-26 · CH14 forensic audit

- Per-chapter Python verifier: PASS (152/152 events, 76/76 crops, 17 event sheets, 22 safety sheets and 16 traceable features).
- Ledger review confirmed 152 concrete observations across movements, committed stock, receipts, closures, suppliers, warehouses, lots and kits.
- Inventory-to-quote handling for missing items remains UNCERTAIN; the audit does not infer stock, valuation or approval rules.

## 2026-08-26 · CH04 forensic audit

- Per-chapter Python verifier: PASS (35/35 events, 30/30 crops, all contact sheets and 11 traceable features).
- Ledger review confirmed 35 concrete event observations with distinct patient, referral, invoice and first item-category states.
- Patient-result labels and the heterogeneous referral catalog remain UNCERTAIN; no save, pricing or discount rule is inferred.

## 2026-08-26 · CH10–CH13 forensic audit

- Per-chapter Python verifiers: PASS for CH10, CH11, CH12 and CH13 (328/328 events, 185/185 crops, 38 event sheets, 49 safety sheets and 58 traceable feature evidence references).
- A final semantic cleanup produced readable, normalized observations for all 328 ledger rows; targeted ledger checks confirmed the previously ambiguous treatment, agenda, payment and purchase states.
- Financial, clinical-permission, tax and inventory effects not demonstrated by the recording remain explicit open questions; CH13's inventory relationship remains VERBAL.

## 2026-08-26 · CH03 forensic audit

- Python/npm verifiers: PASS (46/46 events, 10/10 crops, all contact sheets and 13 traceable features).
- Independent visual sample: CH03-E0007, E0030, E0042 and E0046 matched the transient Preadmisión tab, inactive-patient listing, quote/preauthorization tracking columns and initial invoice fields.
- Preadmisión remains UNCERTAIN because it appears only during loading; financial values and state transitions remain evidence-bound open questions.

## 2026-08-26 · CH09 forensic audit

- Python/npm verifiers: PASS (137/137 events, 61/61 crops, 16/16 event sheets, 24/24 safety sheets and 14 traceable features).
- Independent visual sample: CH09-E0009, E0030, E0083 and E0127 matched the hospitalization table, coded diagnosis selector, date-range picker and unexpected exit confirmation after Print.
- The ledger keeps the print result, event gap and final document contents explicitly uncertain instead of claiming an unobserved PDF generation.

## 2026-08-26 · CH02 forensic audit

- Python/npm verifiers: PASS (82/82 events, 48/48 crops, all sheets; 16 features with valid IDs/timestamps/paths).
- Independent visual sample: CH02-E0009, E0022, E0058 and E0082 matched form sections, notification opt-in, anomalous insurer results and unsaved exit actions.
- Eight unresolved business/security questions remain explicit; the video does not demonstrate a successful patient save.

## 2026-08-26 · CH08 forensic audit

- Python/npm verifiers: PASS (95/95 events; 12 features; 14 valid feature evidence references).
- The auditor completed a second per-frame semantic pass, including distinct closed/open payment-menu states.
- Independent visual review corrected F10/F11 from an empty preview crop to CH08-E0087, which visibly contains the four summary totals and negative pending amount.

## 2026-08-26 · CH07 forensic audit

- Python and npm verifiers: PASS (18/18 events, 11/11 crops, all event/safety sheets, 9 valid feature evidence paths).
- Independent visual review returned E0004 and E0012–E0013 for correction because their first notes did not match the referenced frames.
- Corrected ledger and inventory now cite the closed-menu states accurately and use E0014_DETAIL for E-mail/Whatsapp.

## 2026-08-26 · CH06 forensic audit

- Python and npm verifiers: PASS after correcting seven initially invalid inventory evidence paths.
- Coverage: 115/115 events, 75/75 crops, 13/13 event sheets and 12/12 safety sheets.
- Independent visual sample: CH06-E0025, E0069, E0103 and E0109 matched their ledger/inventory observations.
- Structured inventory: 10 features, 12 valid evidence references, zero missing evidence paths after correction.

## 2026-08-26 · CH01 forensic audit

- `python tools/video-audit/scripts/verify_chapter_review.py <CH01 source>`: PASS (24/24 events, 11/11 crops, all contact sheets, complete ledger).
- `npm run audit:status`: CH01 fully receipted and fully noted; remaining chapters pending.
- Independent visual sample: CH01-E0009, E0011, E0018 and E0023 matched their ledger observations.
- Structured inventory: 14 features, 14 valid evidence references, zero missing evidence paths.

## 2026-08-25 · Baseline antes de cambios

| Prueba | Resultado | Detalle |
|---|---|---|
| `npm ci` | PASS | Sin vulnerabilidades reportadas. |
| `npm run codex:preflight` | PASS | 17 capítulos y 1,359 eventos presentes; evidencia íntegra. |
| `npm run check` | PASS | 9/9 dominio, 75/75 QA, build standalone correcto. |
| `npm run audit:status` | EXPECTED INCOMPLETE | 0 eventos con observación y 0 capítulos verificados. |
| Navegación escritorio | PASS | 33/33 rutas; 0 errores de consola/página; 0 overflow. |
| Navegación móvil 390 px | PASS | 33/33 rutas; 0 overflow del documento. |
| Perfiles demo | PASS | 6/6 casos de acceso directo. |
| Portal demo | PASS WITH SAFETY GAP | Render correcto; el mock no solicita segunda verificación. |
| API local | PASS | Root/manifest/health/runtime, notificación segura y errores genéricos. |
| Accesibilidad básica | PASS WITH NOTES | Foco y botones correctos; dos filtros sin etiqueta accesible. |
| Supabase/RLS real | NOT RUN | CLI no disponible y no se proporcionaron credenciales ni base local. |

Capturas del baseline en `docs/overnight/screenshots/`.
