# GLOBAL_RELEASE_METADATA_REPAIR handoff

The parity generator now emits Prettier-compliant `video-parity-summary.ts`; two consecutive generations at `0e0626fccc8d464b98458c4a40bf185a992f2a90` produced the same SHA-256 (`A421EFF2CB18019D84FA7478777FCE0084F08DBD13E14EE3D66D329FF1819B8B`). Formatting, lint, typecheck, light-mode, 210/210 video parity, traceability-mirror self-test, and the 32/32 client-change self-test pass.

CR-011, CR-012, and CR-017 now carry current functional fingerprints at the quote/agenda implementation SHA. Their previous `DEMO_CERTIFIED` state is deliberately downgraded to `PENDING_RUNTIME_CERTIFICATION`: no completed fresh focused Playwright result exists for the changed behavior, and Selenium remains unavailable because Python is absent.

Release remains unapproved. Fresh-server protected/full Playwright exit evidence, Selenium runtime evidence, and immutable metadata commit/push/fetch provenance remain pending. No clinical, financial, provider, or video-blocked behavior was expanded.
