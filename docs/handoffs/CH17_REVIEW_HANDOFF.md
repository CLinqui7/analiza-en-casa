# CH17 review

Opened evidence confirms that CH17-F04 through F13 are not independently safe implementations: the visible date range changes a report with sensitive data, and the other frames expose patient identity, insurance, clinical history, allergies, vital signs, nursing notes, or correction controls. F07/F14–F17 remain explicitly blocked.

F01–F03 remain the only safe local surfaces: empty anatomy only, with no patient, case, insurance, clinical, audit, document, range, print, navigation, or mutation data path. The focused six-case Playwright suite completed at `fec4aef2d984afc95e4f54c2703d20651116c8c9`; certification remains `UNVERIFIED` because it does not establish the separate report-source, role/permission, or performance contracts.

F04 was reconciled at `98840f19538f15efa4ee6f85e8f864ba753478fc`: CH17-E0012 is only the double-calendar anatomy with example dates, CH17-E0017 is the processing overlay, and CH17-E0019 shows the sensitive result. It remains `MISSING` under CH16-Q008 and CH17-Q008; no calendar or report query exists.

Next: `CH17_F05_EVIDENCE_AND_DATA_BOUNDARY_PRECHECK`; it may document the patient-information source and access boundary from CH17-E0019 but must not render report fields or retrieve report data.
