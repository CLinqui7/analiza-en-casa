# B3 handoff

CR-009 now labels the primary date as **Fecha de ingreso** and permits independently validated administrative ingreso/egreso periods that persist after demo reload. CR-017 creates an auditable shift per selected date and rejects repeated dates or resource collisions. Provider-side `agenda:write` enforcement allows ADMIN/NURSE persistence and prevents DOCTOR, INVENTORY, FINANCE and AUDITOR from changing shifts or audit entries. CR-018 implements 6h and 8h presets only, including exact durations across midnight.

CR-008 remains safely blocked: hospital attachment bytes, downloads, private Storage/RLS and integrated audit evidence are not simulated. CR-010 keeps **Puntual** disabled because its entity, duration, fields, states and relation are unspecified.

Selenium source declares focused real persistence tests, but no execution is claimed because Python is unavailable. Git metadata writes remain denied, leaving all SHA/push/remote verification fields pending.

`npm run audit:verify` passed for all 17 chapters.

The CH01–CH03 protected regression gates and their deterministic self-tests passed after refreshing the shared functional fingerprint. CR-010, CR-017 and CR-018 no longer cite the unrelated CH11-F01 patient-filtered calendar requirement.

The B3 evidence repair adds two periods/dates, removes one, then saves and reloads to prove that only the retained period/shift persists. Selenium contains assertion-backed records for every B3 required agenda action; execution remains pending Python availability.

Next independent batch: **B4**.
