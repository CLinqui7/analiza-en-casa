# B1 repair handoff

Static B1 gates are green. CR-002 and CR-004 now have focused save/reload/edit coverage, and the contact-document pair is enforced consistently with the database constraint. The video-parity anti-false-EXACT self-test uses an in-memory route/partial-requirement fixture, so it is independent of the current patient-requirement states. The former base commit is not a B1_REPAIR implementation SHA: certification remains explicitly pending until Git metadata writes allow a stable repair commit.

CR-003 and CR-031 remain explicitly partial. Selenium runtime evidence is blocked because neither `py` nor `python` is installed. Commit/push verification is blocked because this environment denies writes to `.git/index.lock` and `.git/FETCH_HEAD`; do not report a commit or remote SHA until that access is restored. The untracked `.npm-cache/` was removed and is not staged.

Next independent batch: **B2**.
