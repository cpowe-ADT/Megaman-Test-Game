Seat: qa-eval
Commit: a15d18e
Scope: 5.1b input replay - three-in-a-row 13d claim, script headers and tolerance, TESTING.md coverage, automation-held clearing and gating
Artifacts opened: output/packets/2026-09-231457-qa-eval.md; output/smoke-runs/*/summary.json (15 latest runs); src/input/InputActions.ts; src/scenes/game/GameDebugHooks.ts; scripts/smoke-test.mjs (tolerance line); scripts/smoke/inputs/dash-basic.json and dash-jump.json (via packet diff); TESTING.md (via packet excerpt)
Tokens: 49528 (4 calls; game-qa-eval subagent)

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MINOR | Of the 12 consecutive 13d passes leading up to HEAD, only the last carries commit a15d18e; the other 11 are labelled with the parent 8791f37 (working-tree runs before the commit landed). The ledger should say "n passes on the working tree, 1 post-commit". | `output/smoke-runs/2026-09-23T14-52-50-591Z/summary.json` through `2026-09-23T14-57-30-045Z/summary.json` (12 pass rows); 4 earlier fails at 14:48-14:51 predate the fix | Note the commit-label nuance in the ledger row. |
| MINOR | `recordInputs()` registers a `preupdate` listener with no `shutdown` cleanup, unlike SceneInputActions' own shutdown handler; a scene shutting down mid-recording never removes it. | `src/scenes/game/GameDebugHooks.ts:373` (no matching shutdown removal; compare `src/input/InputActions.ts:78`) | Add `host.events.once('shutdown', () => host.events.off('preupdate', recordingHandler))`. |

Verified: `adapters.delete(scene)` on shutdown drops the SceneInputActions instance, so `automationHeld` cannot leak into a later scene life; both hook installers early-return without AUTOMATION.enabled; tolerance 2 at `scripts/smoke-test.mjs:1897` matches the scripts' meta; both scripts carry stage, spawn and purpose; TESTING.md:146-149 documents the hooks and the script shape.

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 4 |
| Failing check existed before the fix | 4 |
| Artifacts opened and described | 4 |
| No regression in scenarios outside the slice | 3 |

Verdict: SHIP (two MINORs worth a handoff line; no BLOCK or MAJOR)
