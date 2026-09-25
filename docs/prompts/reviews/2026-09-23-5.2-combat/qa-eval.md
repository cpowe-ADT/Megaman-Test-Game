Seat: qa-eval
Commit: 9f3497c
Scope: 5.2 combat feel - test existence and validity, smoke pass status, regression hunt outside the slice
Artifacts opened: output/smoke-runs/2026-09-23T15-20-36-509Z/summary.json, tests/player-combat.test.ts, tests/player-motor.test.ts, tests/death-sequence.test.ts, tests/game-host-seams.test.ts, tests/input-blur.test.ts, tests/upgrades.test.ts, scripts/smoke-test.mjs (sections), src/scenes/game/CameraDirector.ts (diff), src/player/hitFeel.ts (diff)
Tokens: 61267 (5 calls; game-qa-eval subagent)

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | The kill-plane seam test can pass with zero assertions: it returns before any assert when the fixture's stage does not allow fall-off, and the default fixture stage may take that branch. | `tests/game-host-seams.test.ts:367` (early return when the stage does not allow fall-off) | Use a stage id known to allow fall-off, or assert which branch ran so a green run cannot be a silent no-op. |
| MINOR | `assertPelletHitEvidence`'s shot-count expectation for scenario 29 (two presses now give two pellets) was not confirmed in budget. | `scripts/smoke-test.mjs:3211` (`runPelletHitsShortEnemyScenario`) | Confirm the shot-count check matches press-fires-pellet semantics (the full smoke run covers it). |
| MINOR | Scenarios 23 and 27 bodies were not opened to confirm each asserts the death sequence or hit-stop independently; aggregate pass status only. | `scripts/smoke-test.mjs:2718`, `scripts/smoke-test.mjs:3584` | Open both bodies in the follow-up. |
| MINOR | The death capture was not opened (budget spent on tests and regressions). | `output/notes/05a-death.png` | Visual judgement is the director seat's. |

Positive: the six scenarios pass in the run; the `5.2-N` tests exist (13 in player-combat and death-sequence, 8 in player-motor) and would fail against the old rules; the three rewritten older tests still assert real outcomes; scenario 12's special-weapon path still expects one shot per press, consistent with the buster-only dual behaviour; the WORLD_GRAVITY_Y consolidation in EnemyMotor is clean.

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 3 |
| Failing check existed before the fix | 4 |
| Artifacts opened and described | 3 |
| No regression in scenarios outside the slice | 3 |

Verdict: FIX (the kill-plane test's silent early return is a real coverage gap on a fatal-damage path; everything else checked is consistent)
