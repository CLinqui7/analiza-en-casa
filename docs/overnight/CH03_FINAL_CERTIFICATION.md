# CH03 final certification

Implementation SHA: `4349523df4750720308de9059a4e6c5ec2624675`

CH03 has 13 traced requirements: 10 `EXACT`, 1 `BLOCKED_CLIENT`
(CH03-Q002), 1 `NOT_TESTABLE` (CH03-Q001), and 1 `NOT_APPLICABLE`
(the contradictory loading/empty paint). There are no `PARTIAL` or `MISSING`
requirements.

The implementation provides the financial navigation group; the administrative
hospitalization board with staged filters, tabs, administrative duration and
safe count; a re-used inactive-patient destination; quote tracking with safe
non-delivery states; and backwards-compatible invoice metadata that does not
change financial totals.

Evidence gates passed: `audit:verify`; video-parity chapters CH01, CH02, and
CH03; and Playwright CH01–CH03 (18 tests). The inherited Selenium
hospitalization fixture remains under repair for its v2-to-v3 local-storage
migration and is not represented as passing certification evidence.
