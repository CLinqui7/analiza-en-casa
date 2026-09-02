# CH04_REPAIR handoff

CH04-F007 now rejects a quote with no selected referral through an accessible error and keeps the draft dialog open without persistence. A selected administrative referral clears the error and persists through reload. No commission, attribution, or commercial rule was introduced.

CH04-F009 now uses the observed green circular `+` control and a bounded, scrollable catalog. Focused quote Playwright passed 5/5 and the Selenium source contains the matching assertion-first flow; Python is unavailable, so runtime Selenium remains pending.

Typecheck, quote declaration coverage (45/45), B4 client self-test, light-only, and CH01–CH04 parity self-tests passed. The shared fingerprint is `815a8943dcc6b962ff630ee3b779539f0edafa04b436b039a2562f9ac78587bf`.

CH04-F003/F008 remain not testable, F005/F010/F011 remain partial, and Git metadata writes still prevent a commit/push/fresh remote verification.

Next batch: CH05.
