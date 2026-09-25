Seat: qa-eval
Commit: c47fc38
Scope: 5.1 motor truth - verify red/green claims, 13d smoke assertions, and regressions outside the slice (shared gravity, ledge-probe guard, stale floor flags)
Artifacts opened: output/notes/05a-5.1-red.log, output/notes/05a-5.1-green.log, output/smoke-runs/2026-09-23T14-20-33-102Z/13d-movement-feel/dash-traces.json, output/smoke-runs/2026-09-23T14-20-33-102Z/summary.json, src/player/PlayerMotor.ts, src/player/NewPlayerRuntime.ts, src/enemy/EnemyMotor.ts, src/scenes/Game.ts
Tokens: 43531 (5 calls; game-qa-eval subagent)

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | `isSolid` (the ledge and dash-headroom probe) has no guard for a paused physics world or a disabled player body; it only checks that `overlapRect` exists and the rect is not degenerate. `motor.update` runs unconditionally each scene update while Game.ts toggles `body.enable = false` in death, respawn and cutscene freezes that are not gated by `hitstopRemainingFrames`, so the probe can read against a frozen or self-disabled body on the frame play resumes. | `src/player/NewPlayerRuntime.ts:41-46`, `src/scenes/Game.ts:1899,2318` | Gate `motor.update` (or the probe calls) on `body.enable` and `!physics.world.isPaused`; add a smoke frame that lands mid-hitstop or respawn near a ledge. |
| MINOR | `EnemyMotor.setGravityY` hardcodes `800 * gravityScale` while the player now derives its +250 from `movement.gravity - worldGravityY`; the two sources drift silently if world gravity is tuned. | `src/enemy/EnemyMotor.ts:28` vs `src/player/config.ts` (`gravity: 1050`) | Pull both from one named world-gravity constant. |
| MINOR | The stale-floor-flag fix (`launchPending` clears when not grounded or vy is at or above 0) is bounded by the jump's vy sign, so it cannot wedge grounded false forever, but only the 13d trace shows it; no unit test covers a genuine landing after a short hop at 144fps sub-steps. | `src/player/PlayerMotor.ts:71` (launchPending; also lines 173, 190 and 350) | Add a 144fps motor test that a real landing is not swallowed. |

Red log shows tests 7, 8 and 11 failing on -420, apex 129.3px and the dash duration as the new spec requires; green log shows all 17 passing; dash-traces.json shows dragX 0, takeoff vx 320, apex vx 320; summary.json status pass.

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 4 |
| Failing check existed before the fix | 5 |
| Artifacts opened and described | 5 |
| No regression in scenarios outside the slice | 3 |

Verdict: FIX (close or rule out the ledge-probe guard before this ships; red/green and 13d claims check out)
