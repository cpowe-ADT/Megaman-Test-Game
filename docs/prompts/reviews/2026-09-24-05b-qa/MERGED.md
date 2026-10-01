# Merged review: 2026-09-24-05b-qa

Seats: qa-eval (SHIP, mean 4.5)

| Severity | Seat | Finding | Evidence | Fix | Agreed |
| --- | --- | --- | --- | --- | --- |
| MINOR | qa-eval | Scenario 18's final lead and bounds assertions (past the mid-stage teleport) were not opened, so the exact pass thresholds of the rewritten trace are unverified by this seat; the setup (mid-stage teleport via `boundsWidth`, `camera` block read) matches the reviewed fix and 40's parallel assertion (`hdLead >= 24 && hdLead <= 48`) is confirmed live at 37. | `scripts/smoke-test.mjs:2873-2887` (read through the replay, not the asserts after) | None for this review; flag if a future slice touches 18. |  |

All reviews valid.
