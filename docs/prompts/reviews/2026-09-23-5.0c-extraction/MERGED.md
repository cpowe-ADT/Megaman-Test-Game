# Merged review: 2026-09-23-5.0c-extraction

Seats: principal-engineer (FIX, mean 4.3), qa-eval (FIX, mean 3.0)

| Severity | Seat | Finding | Evidence | Fix | Agreed |
| --- | --- | --- | --- | --- | --- |
| MAJOR | principal-engineer | The four host interfaces are never checked by the compiler and no test builds any of the modules: Game.ts is `@ts-nocheck` and its members are `private`, so the constructors are never matched against their interfaces. Failure scenario (plausible, future): a later slice renames `fallingToDeath` or `respawnPoint` in Game; it still compiles; `DeathSequence` reads `undefined`; the `killPlayer` guard never trips (two lives lost for one fall) or the respawn `delayedCall` exits early (soft-lock). | `src/scenes/Game.ts:1` `// @ts-nocheck`; `git grep -lE "CameraDirector | DeathSequence |  |
| MAJOR | qa-eval | No ledger row cites commit 55c22d6 or this slice yet; `EVAL-P5-010` is still `PENDING`, so the "no behaviour change" claim is not recorded with command, result, artifact and commit as AGENTS.md rule 13 requires. | `docs/prompts/EVAL_LEDGER.md:25` (P5-010 row `PENDING`); `grep -n "5.0c\ | part 2\ |  |
| MINOR | principal-engineer | Nine imports in Game.ts are now unused (`DebugOverlay`, `DEBUG_UI`, `makeGameCombatSnapshot`, `STRICT_PIXEL_RENDER_POLICY`, `drinkSubTank`, `getBossRoomCameraBounds`, `installGameDebugHooks`, `uninstallGameDebugHooks`, `Settings`); `@ts-nocheck` hides them. | `src/scenes/Game.ts:1-40` (the import block); `git show 55c22d6:src/scenes/Game.ts | grep -c "\b<name>\b"` gives 1 for each |  |
| MINOR | principal-engineer | A blanket `this` to `host` replace also changed two comments in DevUx ("into host hidden graphic", "the overlay shows host entry"). Cosmetic. | `src/scenes/game/DevUx.ts:79` and the comment inside `register` | Put "this" back in both comments. |  |
| MINOR | principal-engineer | Latent bug carried over verbatim: `(host as any).stageId` where Game has no `stageId` field, so GameOver always gets `'unknown'` and the snapshot falls back to `activeStageId`. | `src/scenes/game/DeathSequence.ts:159`, `src/scenes/game/RunState.ts:163` | Use `host.activeStageId` in a slice allowed to change behaviour. |  |
| MINOR | qa-eval | The most recent smoke run for this commit (`2026-09-23T14-03-41-897Z`) had top-level `"status": "running"` at read time (17/17 captured scenarios pass, 0 fails); completion unconfirmed. | `output/smoke-runs/2026-09-23T14-03-41-897Z/summary.json` | Confirm the run reached a terminal status before citing it. |  |

All reviews valid.
