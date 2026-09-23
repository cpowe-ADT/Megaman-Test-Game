Seat: qa-eval
Commit: 99d6b16
Scope: 5.0d - plain-value replacements for Phaser (clamp, SHUTDOWN_EVENT, Vec2), dynamic import of GameDebugHooks, seam tests
Artifacts opened: output/packets/2026-09-231439-qa-eval.md, node_modules/phaser/src/scene/events/SHUTDOWN_EVENT.js, scripts/smoke/classic-campaign.mjs, scripts/smoke/input-lifecycle.mjs, scripts/smoke-test.mjs, scripts/smoke/story-surfaces.mjs, package.json (test script)
Tokens: 40686 (4 calls; game-qa-eval subagent)

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | The dynamic `import('./GameDebugHooks')` in DevUx makes `window.stageDebug` and `window.bossDebug` populate asynchronously after `create()`, but two scenario files call them directly right after a scene-state wait with no existence check; intermittent "Cannot read properties of undefined", worst in a dist build where the chunk is a network fetch. | `scripts/smoke/classic-campaign.mjs:58`, `scripts/smoke/input-lifecycle.mjs:79`; the safe pattern exists at `scripts/smoke-test.mjs:1183` | Wait for `window.stageDebug?.crossBossGate` and `window.bossDebug?.unlockIntro` before the first call in both files. |
| MINOR | `story-surfaces.mjs` uses optional chaining instead of an existence wait, so a race silently no-ops; safe only because the caller retries 40 times. | `scripts/smoke/story-surfaces.mjs:36` | Same explicit wait. |

Verified behaviour-identical: SHUTDOWN_EVENT.js dispatches the literal 'shutdown'; clampNumber matches Phaser.Math.Clamp; no consumer of respawnPoint outside DeathSequence and RunState relies on Vector2 methods.

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 3 |
| Failing check existed before the fix | 3 |
| Artifacts opened and described | 4 |
| No regression in scenarios outside the slice | 2 |

Verdict: FIX (the classic-campaign and input-lifecycle race gets an explicit readiness wait before this ships; everything else checked out)
