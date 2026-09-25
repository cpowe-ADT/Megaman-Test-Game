Seat: qa-eval
Commit: 55c22d6
Scope: 5.0c extraction (Game.ts 3,639 to 2,930; DevUx/DeathSequence/CameraDirector/RunState split), automation contract, removed-field safety, cited smoke evidence
Artifacts opened: output/packets/2026-09-231403-qa-eval.md; output/smoke-runs/2026-09-23T14-03-41-897Z/summary.json; docs/prompts/EVAL_LEDGER.md (grep); scripts/smoke-test.mjs, scripts/smoke/input-lifecycle.mjs (grep)
Tokens: 37193 (5 calls; game-qa-eval subagent)

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | No ledger row cites commit 55c22d6 or this slice yet; `EVAL-P5-010` is still `PENDING`, so the "no behaviour change" claim is not recorded with command, result, artifact and commit as AGENTS.md rule 13 requires. | `docs/prompts/EVAL_LEDGER.md:25` (P5-010 row `PENDING`); `grep -n "5.0c\|part 2\|55c22d6" docs/prompts/EVAL_LEDGER.md` returned nothing | File the ledger row for 55c22d6 with the gate commands, result lines, the smoke run path and the commit before treating the slice as closed. |
| MINOR | The most recent smoke run for this commit (`2026-09-23T14-03-41-897Z`) had top-level `"status": "running"` at read time (17/17 captured scenarios pass, 0 fails); completion unconfirmed. | `output/smoke-runs/2026-09-23T14-03-41-897Z/summary.json` | Confirm the run reached a terminal status before citing it. |

No BLOCK. Automation contract checks out: `scripts/smoke-test.mjs` sets `scene.hitstopRemainingFrames = 0` and calls `scene?.disableProjectileGroups?.()`; `scripts/smoke/input-lifecycle.mjs` reads `getScene('Game')._dev.on`; Game.ts keeps `hitstopRemainingFrames` as its own field and `get _dev()` preserves the shape. `freezeCombatWorld`, `killPlayer`, `playerDeathAndRespawn`, `autosaveActiveRun` are not referenced under scripts/. The nine dropped fields have no references tied to Game.ts (same-named private fields on other classes only). Moved bodies match the old code verbatim.

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 2 |
| Failing check existed before the fix | 3 |
| Artifacts opened and described | 4 |
| No regression in scenarios outside the slice | 3 |

Verdict: FIX (no BLOCK; the extraction reads as behaviour-preserving and automation-safe; ship the ledger row for 55c22d6 and confirm the cited smoke run's terminal status before closing the slice)
