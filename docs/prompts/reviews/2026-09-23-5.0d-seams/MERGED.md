# Merged review: 2026-09-23-5.0d-seams

Seats: qa-eval (FIX, mean 3.0)

| Severity | Seat | Finding | Evidence | Fix | Agreed |
| --- | --- | --- | --- | --- | --- |
| MAJOR | qa-eval | The dynamic `import('./GameDebugHooks')` in DevUx makes `window.stageDebug` and `window.bossDebug` populate asynchronously after `create()`, but two scenario files call them directly right after a scene-state wait with no existence check; intermittent "Cannot read properties of undefined", worst in a dist build where the chunk is a network fetch. | `scripts/smoke/classic-campaign.mjs:58`, `scripts/smoke/input-lifecycle.mjs:79`; the safe pattern exists at `scripts/smoke-test.mjs:1183` | Wait for `window.stageDebug?.crossBossGate` and `window.bossDebug?.unlockIntro` before the first call in both files. |  |
| MINOR | qa-eval | `story-surfaces.mjs` uses optional chaining instead of an existence wait, so a race silently no-ops; safe only because the caller retries 40 times. | `scripts/smoke/story-surfaces.mjs:36` | Same explicit wait. |  |

All reviews valid.
