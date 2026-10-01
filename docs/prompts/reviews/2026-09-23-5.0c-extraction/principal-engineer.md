Seat: principal-engineer
Commit: 55c22d6
Scope: 5.0c extraction of dev UX, death sequence, camera director and run state from Game.ts, checked for behaviour drift in the move
Artifacts opened: output/packets/2026-09-231403-principal-engineer.md, `git diff aa4f34f..55c22d6 -- src/scenes/Game.ts`, `git show 55c22d6:src/scenes/game/{DeathSequence,RunState,DevUx}.ts`, output/gates/test.log and build.log (result lines only)
Tokens: 67281 (7 calls; game-code-reviewer subagent, opus)

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MAJOR | The four host interfaces are never checked by the compiler and no test builds any of the modules: Game.ts is `@ts-nocheck` and its members are `private`, so the constructors are never matched against their interfaces. Failure scenario (plausible, future): a later slice renames `fallingToDeath` or `respawnPoint` in Game; it still compiles; `DeathSequence` reads `undefined`; the `killPlayer` guard never trips (two lives lost for one fall) or the respawn `delayedCall` exits early (soft-lock). | `src/scenes/Game.ts:1` `// @ts-nocheck`; `git grep -lE "CameraDirector|DeathSequence|RunState|DevUx" 55c22d6 -- tests scripts` returns nothing | Add `tests/game-host-seams.test.ts` with fake hosts covering `tickHitstop` pause and resume, the step order in `updateRespawnCheckpoint`, the re-entry guard in `killPlayer`, and a capture/apply round trip of the run snapshot. |
| MINOR | Nine imports in Game.ts are now unused (`DebugOverlay`, `DEBUG_UI`, `makeGameCombatSnapshot`, `STRICT_PIXEL_RENDER_POLICY`, `drinkSubTank`, `getBossRoomCameraBounds`, `installGameDebugHooks`, `uninstallGameDebugHooks`, `Settings`); `@ts-nocheck` hides them. | `src/scenes/Game.ts:1-40` (the import block); `git show 55c22d6:src/scenes/Game.ts | grep -c "\b<name>\b"` gives 1 for each | Delete them and lower `gameTsMaxLines`. |
| MINOR | A blanket `this` to `host` replace also changed two comments in DevUx ("into host hidden graphic", "the overlay shows host entry"). Cosmetic. | `src/scenes/game/DevUx.ts:79` and the comment inside `register` | Put "this" back in both comments. |
| MINOR | Latent bug carried over verbatim: `(host as any).stageId` where Game has no `stageId` field, so GameOver always gets `'unknown'` and the snapshot falls back to `activeStageId`. | `src/scenes/game/DeathSequence.ts:159`, `src/scenes/game/RunState.ts:163` | Use `host.activeStageId` in a slice allowed to change behaviour. |

Drift checks, all confirmed: every moved body matches line for line (`this.` to `host.`); `onHitstop`/`onCameraShake` stay arrow fields so on/off use the same function; `tickHitstop()` runs at the same point; create order unchanged; timers capture the stable Game instance; checkpoint and respawn order unchanged; removed members have no references in src, scripts or tests; `_dev` is a getter and nothing assigns it; no `any` in the interfaces. Gates: `PASS test (9s): # pass 292 | # fail 0`, `PASS build (5s)`. Not checked: smoke 9, 23, 13c, the sweep, browser behaviour.

| Rubric | Score |
| --- | --- |
| Correctness: no path produces a wrong result or crash | 5 |
| Tests: each new branch has a failing-first test or smoke assertion | 3 |
| Contracts: automation hooks, save format and scene flow unchanged or updated with docs | 5 |
| Size: Game.ts shrinks or holds; logic in typed modules | 4 |

Verdict: FIX (no behaviour drift found; add the seam tests before 05a edits CameraDirector, and drop the dead imports)
