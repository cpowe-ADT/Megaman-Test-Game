Seat: game-director
Commit: 610fe2c
Scope: 05b 5.3 camera (EVAL-P5-004): does the camera lead the hero and stay steady on flat ground; judge the look-ahead capture and the numbers (deadzone 64x40, look-ahead 40px, lerp 0.12/0.08)
Artifacts opened: output/smoke-runs/2026-09-24T16-20-04-271Z/18-extended-stage-scroll/state-lookahead.json, output/smoke-runs/2026-09-24T16-20-04-271Z/18-extended-stage-scroll/shot-lookahead.png
Tokens: 36611

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| BLOCK | The "look-ahead lead at least 24px" assertion is vacuous: `midPointX` is 224 (GAME_WIDTH/2, so `scrollX` clamped to 0) both before and after the 60-frame run, unchanged by 100+px of player motion. The camera never moved; the "lead" of 103.28px is `224 - finalPlayer.x`, a fact about the left world-bound clamp and the player's absolute position near stage start, not about the tweened look-ahead offset, the 0.12/0.08 lerp, or the deadzone. A camera with no look-ahead at all (or a broken one) produces the identical trace as long as the player stays this close to x=0. | `output/smoke-runs/2026-09-24T16-20-04-271Z/18-extended-stage-scroll/state-lookahead.json:4,16` (`midPointX: 224` in both `beforeLookAhead` and `afterLookAhead`) | Run the trace after the hero has passed screen centre and is clear of the left bound (for example `stageDebug.crossNextCheckpoint()` or a seek to a mid-stage x before the 60-frame replay), then assert the offset converges toward the expected deadzone_x/2 plus look-ahead value, not a floor of 24 that a clamp satisfies for free. |
| MINOR | The charge-aura reduced-flash period (126ms) is about 7.9Hz, still above the conventional 3-flashes-per-second photosensitivity guidance that "reduced flashing" settings usually target; no capture confirms the on-screen effect under the setting. | `src/player/VfxSfxRouter.ts:173-176` (`CHARGE_AURA_REDUCED_FREQUENCY_MS = 126`) | If the intent is accessibility rather than "less busy", lower the reduced rate to at least 333ms (3Hz at most), or say in the doc comment that this is a feel reduction, not a seizure-safety guarantee, and capture the visual before calling it done. |
| MINOR | Vertical follow mode's "scrolling" branch (`CAMERA_FOLLOW_DEADZONE_Y_SCROLLING = 24`, taller-than-one-screen stages) has a unit test on the pure decision function but no smoke capture, because no such stage exists yet. The "locked" branch (40px) is confirmed on flat ground (0px vertical drift). | `output/smoke-runs/2026-09-24T16-20-04-271Z/18-extended-stage-scroll/state-lookahead.json:19` (`lookAheadVerticalDriftPx: 0`); `src/scenes/game/CameraDirector.ts:27-30` | Ship now since no taller stage exists; flag in the prompt 06 handoff that the scrolling branch needs its own capture once a multi-screen-tall stage lands (5.7's shaft may be that stage). |

| Rubric | Score |
| --- | --- |
| A new player reads the screen in two seconds | 4 |
| Controls respond the way the genre expects | 3 |
| Difficulty rises, and deaths are fair and legible | 4 |
| Combat: every hit, weakness and phase change is felt and seen | 4 |

Verdict: FIX (the BLOCK's scenario does not isolate the world-edge clamp from the look-ahead tween, so the eval's central claim, "camera leads the hero", is unproven by this evidence; the code itself reads correctly, so this is a test fix, not a revert)
