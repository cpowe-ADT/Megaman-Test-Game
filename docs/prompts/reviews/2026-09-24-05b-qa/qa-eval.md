Seat: qa-eval
Commit: 6bf42af
Scope: verify the EVAL-P5-004 and EVAL-P5-009 ledger rows against their artifacts; hunt regressions in the 05b diff (88a882e..df941b3), camera follow and tutorial locks
Artifacts opened: output/packets/05b-qa-qa-eval.md; output/smoke-runs/2026-09-24T17-28-43-801Z/summary.json; output/sweep-runs/2026-09-24T17-33-03-299Z/summary.json; output/perf/footprint-latest.json; output/smoke-runs/2026-09-24T17-16-17-443Z/40-hd-render/camera-2x.json and pixel-compare.json; output/smoke-runs/2026-09-24T17-28-43-801Z/49-tutorial-verbs/shot-shaft-coach.png and shot-wall-kick.png; scripts/smoke-test.mjs:2500-2560,2850-2895; git log 88a882e..HEAD; `npm run -s gate -- agents:check test build`
Tokens: 55012

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MINOR | Scenario 18's final lead and bounds assertions (past the mid-stage teleport) were not opened, so the exact pass thresholds of the rewritten trace are unverified by this seat; the setup (mid-stage teleport via `boundsWidth`, `camera` block read) matches the reviewed fix and 40's parallel assertion (`hdLead >= 24 && hdLead <= 48`) is confirmed live at 37. | `scripts/smoke-test.mjs:2873-2887` (read through the replay, not the asserts after) | None for this review; flag if a future slice touches 18. |

No BLOCK or MAJOR. All checked ledger claims match their artifacts:

- P5-004: `output/smoke-runs/2026-09-24T17-16-17-443Z/40-hd-render/camera-2x.json` gives `hdLead: 37` (in [24,48]) and `hdHeroScreenX: 187`; `pixel-compare.json` gives `ratio: 1` on 280/280 points. Full smoke summary: `status: pass`, `commit: df941b3`, `dirty: 0`, 52 scenarios, 52 pass. Sweep summary: `status: pass`, `commit: df941b3`, `dirty: 0`. Footprint: 22 checks, 0 failing. The cited fix commits 4eff688, 1b7be84 and 9e76329 exist in `git log 88a882e..HEAD` and their messages match the MERGED.md findings they claim to fix.
- P5-009: the cited fix commits bf3b51a and 44f6c51 exist and map onto the review's BLOCKs and MAJORs. `shot-shaft-coach.png` shows Rook's line "Step three. Two wall faces, one shaft..." tied to the wall-kick lock, the exact bug the first pass flagged, now fixed. `shot-wall-kick.png` shows "HOLD X TO CHARGE", the correct next-room hint after the climb, not the Iona line the first pass saw. `scripts/smoke/tutorial-verbs.mjs:125-149` confirms `warp(900)` then a single `replay('wall-kick')` with no further warp before capture. The 49-tutorial-verbs folder of the full run holds the named captures.

Regression hunt: the gate now reads `PASS agents:check (0 errors, Game.ts 2920)`, `PASS test (377 pass, 0 fail)`, `PASS build`; 377 matches progress.md. Scenario 20's settle wait (`scripts/smoke-test.mjs:2533-2541`) is not vacuous: `grounded`, `|vx| < 1` and `hitstunMs === 0` cannot all hold right after `damagePlayer(3)`. Scenario 40 (`scripts/smoke/hd-render.mjs:190-223`) documents the regression it guards and its live values sit inside the asserted range; removing the look-ahead would drop the lead toward 0 and fail. No claim without an artifact; the deferred items are recorded as deferred to 06 in the ledger row and MERGED.md.

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 5 |
| Failing check existed before the fix | 5 |
| Artifacts opened and described | 4 |
| No regression in scenarios outside the slice | 4 |

Verdict: SHIP (no BLOCK or MAJOR; one MINOR gap in what this seat re-verified, not a defect)
