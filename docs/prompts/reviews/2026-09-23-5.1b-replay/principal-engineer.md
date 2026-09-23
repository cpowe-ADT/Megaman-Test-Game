Seat: principal-engineer
Commit: a15d18e
Scope: 5.1b input replay: stepFrames loop fix, automation-held input source, replayInputs and recordInputs, 13d migration
Artifacts opened: output/packets/2026-09-231457-principal-engineer.md, src/main.ts:80-140, node_modules/phaser/src/core/TimeStep.js (resetDelta, smoothDelta, step, tick, sleep, wake), node_modules/phaser/src/core/Game.js:474-500, node_modules/phaser/src/time/Clock.js, src/input/InputActions.ts:20-135, src/input/ActionState.ts, scripts/smoke-test.mjs (diff and 1878-1890), tests/ (grep)
Tokens: 59171 (6 calls; game-code-reviewer subagent, opus)

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | replayInputs is frame-exact only if the loop is already asleep: it does not sleep the loop itself, so with the loop running every row's stepFrames ends in `loop.wake()`, whose `tick()` runs one real step at wall time, increments `loop.frame` (a fresh input sample that can consume a latched press), sends `Clock.now` back to wall time (lengthening jump suppression and fire cooldowns) and overwrites the `lastTime` the fix wrote. Failure scenario: run dash-jump.json with the loop awake; its 5 rows add 4 uncontrolled steps and the x=265.33 reference is not reproduced. TESTING.md:149 misattributes the stray step to requestAnimationFrame between calls. | `node_modules/phaser/src/core/TimeStep.js:792`, `node_modules/phaser/src/time/Clock.js:360`, `src/main.ts:117`, `src/scenes/game/GameDebugHooks.ts:258` | replayInputs sleeps the loop once, steps every row, wakes once (or a no-wake flag on stepGameFrames); correct TESTING.md. |
| MINOR | The 13d dash-jump no longer checks that the player left the ground and takeoff is not sampled: `apex.vy < 0` passes for a grounded body and takeoff and apex are one read after 47 frames; only the hard-coded y shows a jump. No "second dash inside 100ms" assertion exists at 8791f37 or a15d18e, so nothing was migrated. | `scripts/smoke-test.mjs:1961`, `scripts/smoke-test.mjs:1992`, `scripts/smoke-test.mjs:1883` | Optional per-step trace in replayInputs; restore separate takeoff and apex checks with `!grounded`; add the second-dash assertion. |
| MINOR | recordInputs leaks its preupdate handler: a second call replaces `recordingHandler` without `off`, and teardown never removes it; Phaser reuses the scene instance, so the orphan runs every frame after re-entry. | `src/scenes/game/GameDebugHooks.ts:272`, `src/scenes/game/GameDebugHooks.ts:300` | `off` at the start of recordInputs and in teardown. |
| MINOR | The automation-held set stays pressed after a replay (the trailing row leaves moveRight and dash held); blur clears only `hub.held`. Cannot leak into normal play (only the gated hooks set it) but the player keeps dashing after `advanceTime`. | `scripts/smoke/inputs/dash-jump.json:12`, `src/input/InputActions.ts:26`, `src/input/InputActions.ts:78` | Release the source when the replay ends unless the caller opts out; clear it in cancelPendingInput. |
| MINOR | replayInputs fails silently: unknown action names are dropped by the INPUT_ACTIONS filter, a missing `stepFrames` returns frames 0, a paused game makes `Game#step` a no-op while `stepped` still counts. | `src/scenes/game/GameDebugHooks.ts:261`, `node_modules/phaser/src/core/Game.js:474` | Validate action names; throw when stepFrames is missing or the game is paused. |
| MINOR | No unit test for `setAutomationHeld` latching or for stepGameFrames advancing `lastTime` and `frame`; only 13d exercises them. | `tests/player-motor.test.ts:1` is the only motor-adjacent suite; `grep -rln "setAutomationHeld\|stepGameFrames" tests` returns nothing | A pure test that latches a press and release through `captureSourceChange`; a fake-game test for the stepper. |

| Rubric | Score |
| --- | --- |
| Correctness: no path produces a wrong result or crash | 3 |
| Tests: each new branch has a failing-first test or smoke assertion | 2 |
| Contracts: automation hooks, save format and scene flow unchanged or updated with docs | 4 |
| Size: Game.ts shrinks or holds; logic in typed modules | 5 |

Verdict: FIX (replayInputs is frame-exact only because 13d sleeps the loop first, and the hook neither enforces nor documents it)
