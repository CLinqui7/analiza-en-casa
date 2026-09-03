# CH17 review

Opened evidence confirms that CH17-F04 through F13 are not independently safe implementations: the visible date range changes a report with sensitive data, and the other frames expose patient identity, insurance, clinical history, allergies, vital signs, nursing notes, or correction controls. F07/F14–F17 remain explicitly blocked.

F01–F03 remain the only safe local surfaces: empty anatomy only, with no patient, case, insurance, clinical, audit, document, range, print, navigation, or mutation data path. The focused six-case Playwright suite completed at `fec4aef2d984afc95e4f54c2703d20651116c8c9`; certification remains `UNVERIFIED` because it does not establish the separate report-source, role/permission, or performance contracts.

Next: `CH17_F04_EVIDENCE_AND_DATA_BOUNDARY_PRECHECK`; it may document the source/role/range boundary but must not add a date-range control or retrieve report data.
