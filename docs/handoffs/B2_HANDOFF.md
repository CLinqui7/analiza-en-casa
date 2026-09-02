# B2 handoff

CR-005 separates **Nuevo recurso** from **Nuevo médico**. CR-006 adds a demo-persistent doctor form with JVPM, DUI, address, edit/reload coverage, and file metadata only. CR-007 adds the eight requested searchable specialty/profession options and persists the selected option in demo mode.

CR-006 remains partial: file bytes and private downloads are not implemented without an organization-scoped Supabase Storage bucket and RLS policies. Selenium remains unexecuted because neither `py` nor `python` is available. B1_REPAIR certification remains pending unchanged.

B2 authorization repair: `/doctors` and its sidebar navigation require `settings:write`, which is granted only to ADMIN. Focused unit coverage and six Playwright scenarios verify the ADMIN lifecycle and direct-route denial with no doctor data or controls for DOCTOR, NURSE, INVENTORY, FINANCE and AUDITOR.

Git metadata writes are denied, so this worktree has no commit, push, or refreshed remote verification SHA.

Next independent batch: **B3**.
