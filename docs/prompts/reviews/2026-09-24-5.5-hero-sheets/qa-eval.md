Seat: qa-eval
Commit: 38514b7
Scope: 5.5 hero sheets (WREN, C2) and the end of the ripped skin, EVAL-P5-006 and EVAL-P5-007
Artifacts opened: output/packets/2026-09-241949-qa-eval.md, output/notes/05c-5.5.md, output/gates/05c-sprites-validate.log, output/smoke-runs/2026-09-24T19-28-08-359Z/summary.json, output/smoke-runs/2026-09-24T19-35-48-431Z/summary.json, output/smoke-runs/2026-09-24T19-42-14-177Z/summary.json, src/assets/playerFrameAudit.ts, scripts/check-dist-runtime-assets.mjs, scripts/smoke-test.mjs:909-915, tests/story-surfaces.test.ts:89-94
Tokens: 44564

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | The note attributes scenario 24's failure to load on one isolated pass; a later run the note does not cite fails it again, and the slice touched the sword VFX, so pure load is not yet proven. | `output/smoke-runs/2026-09-24T19-35-48-431Z/summary.json` 24 pass; `output/smoke-runs/2026-09-24T19-42-14-177Z/summary.json` 24 fail | Rerun 24 isolated two or three times on a quiet machine; if it fails isolated, check the amber trail against the sword-VFX diff. |
| MINOR | Scenario 40 is red in the newest capture as well (0 for 3 across 19:28, 19:35, 19:42), so "not yet rerun green" understates it. | `output/smoke-runs/2026-09-24T19-42-14-177Z/summary.json` 40 fail | State the third run before the STOP. |

Verified: the validate log numbers (45 groups, 96 frames); no DEV_SKIN, private manifest or override builder left in src, scripts, tools or types; the dist guard fails on dist/assets/private; smoke 4 asserts WREN; the audit exemptions are exactly slash, respawn and death for the edge rule and death and respawn for height; the credits test is consistent. Not checked: the contact sheet and captures, the Python test output. Full smoke and sweep are unproven, as the note says.

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 4 |
| Failing check existed before the fix | 4 |
| Artifacts opened and described | 4 |
| No regression in scenarios outside the slice | 3 |

Verdict: FIX (confirm scenario 24 isolated before treating it as load noise; the coverage, audit and retirement claims check out)
