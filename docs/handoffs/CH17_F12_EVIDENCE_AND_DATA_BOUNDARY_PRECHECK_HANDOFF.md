# CH17 F12 evidence and data-boundary precheck

Opened `CH17-E0043` and `CH17-E0046`. They show Notas de enfermería table anatomy, print selection, actions, date, time/shift/resource context, search/paging, and sensitive clinical narrative.

`CH17-F12` is `MISSING` under `CH16-Q008`, `CH17-Q001`, and `CH17-Q010`. React does not expose nursing-note content, resource/shift data, table/search/paging/selection/actions, print/export, queries, persistence, or clinical writes. `CH09-F03` remains independently mapped to `/clinical/hospitalizations`; CR-020 remains a separate fluid-balance clinical-approval blocker.

The evidence checkpoint is `740b6bde8177d078fda24602a7c1e9e2d980b638`. Traceability generation, mirror self-test, CH17 parity (17/17), light mode (92 files), and audit verification (17/17 chapters) passed. Manual Git writes/fetch remain environment-blocked; cached local and origin refs both identify that checkpoint.
