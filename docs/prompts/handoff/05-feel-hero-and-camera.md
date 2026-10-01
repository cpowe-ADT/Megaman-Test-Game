# Handoff 05: Feel, hero and camera

## Status: COMPLETE (2026-09-25). Every Exit Gate check is green on the exit commit `04bd3b8`: every `EVAL-P5` row PASS (P5-008 after the qa-eval review), `npm run verify` PASS, the sweep complete, no franchise strings, `assets/private/` absent, Game.ts 1930 lines.

## Branch and final commit

Branch `codex/05a-feel-hero-camera`. Exit commit `04bd3b8` (the last code change is the smoke-timeout commit; the profiles work landed in `e9781ef`, the prompt 12 lanes before it). This handoff and the ledger rows land in the commit after it. D-015: the orchestrator pushes and updates PR #58 to `main`; CI's browser gates run on the pull request (EVAL-P12-001).

## What changed (by area, with file paths)

- Harness (5.0, P5-010): smoke and sweep keep going and keep evidence, `window.stepFrames`, pinned loader; `src/scenes/Game.ts` shed dev UX, death sequence, camera director and run state into `src/scenes/game/` (2,920 lines at 05c entry, 1,930 now).
- Motor (5.1, P5-001, P5-002): `src/player/PlayerMotor.ts`, `src/player/config.ts`: no drag, dash-jump, wall-kick grace, jump cut, ledge forgiveness; frame-exact `stageDebug.replayInputs` and `recordInputs`.
- Combat feel (5.2, P5-003): hit-stop on contact only, hurt lock, charge on press, landing squash, death sequence, shake budget.
- Camera (5.3, P5-004): `src/scenes/game/cameraFollow.ts` (`stepCameraFollow`), constants in `src/config/gameplayLayout.ts`.
- Hero (5.4, 5.5, P5-005 to P5-007): `docs/art/style-sheet.md`, `docs/art/hero-brief.md`, the WREN atlas (design C2); the developer skin is retired and `assets/private/` is gone.
- Tutorial (5.7, P5-009) and playtest fixes (5.8, P5-011): teach locks, coach lines, lane key hints; HUD under WebGL, overlays hang from the HUD band.
- Profiles (5.6, P5-008) and save migration (P12-002): `src/progression/profiles.ts` (pure rules, name grid), `src/systems/Save.ts` (per-slot keys, the `Profiles` adapter, `migrateSave`, `SAVE_VERSION` 5), `src/content/identity.ts` (`HERO_CALLSIGN` is a getter; `setHeroCallsignResolver`), `src/scenes/ProfileScene.ts` (new, key `Profiles`), `src/scenes/Title.ts`, `src/scenes/NewCampaignScene.ts`, `src/scenes/ControlsScene.ts` (first-run page), `src/scenes/StageSelect.ts` (best time), `src/main.ts` (scene registration, payload `profiles`), `src/scenes/game/ProgressionDebugHooks.ts` (`stageDebug.setProfile`), `scripts/smoke/profiles.mjs` (41), `scripts/smoke/pause-options.mjs` (38c), `tests/save-profiles.test.ts`, `tests/save-migration.test.ts`.
- Shipping (12a): browser gates on pull requests to `main` (`.github/workflows/ci.yml`, P12-001), version 0.5.0 and `CHANGELOG.md` (P12-003).

## Decisions made (each with the reason and what it forecloses)

- D-013 to D-017 (`docs/prompts/DECISIONS.md`): feel sign-off, hero C2 with the fin shortened, push permission at the 05 exit, the overhaul before 5.6, the finish plan.
- Slot 1 keeps the key `save.v1`; slots 2 and 3 are `save.v1.slot2` and `save.v1.slot3`; `profiles.v1` holds metadata only. Reason: every old save and smoke seed loads without a copy. Forecloses reading `save.v1` directly for "the" save.
- CONTINUE is chosen from the profile's `campaignStarted`, never `Save.exists()` (an Options visit writes a save key).
- The pilot name reaches `{hero}` and the HUD through the identity getter, which `Save` resolves from the active profile, so `Game.ts` gained no profile code. Forecloses caching `HERO_CALLSIGN` at module load.
- A named pilot is committed only when NEW CAMPAIGN starts; backing out leaves the slot as it was. A used card offers LOAD (the default), OVERWRITE and BACK: no destructive default.
- Export (E) and import (I) sit on the slot picker, not in Options (Options was outside the lane and smoke 38 indexes its rows). Import only into an EMPTY slot; the envelope carries difficulty, which the progression transport does not.
- Under automation the slot picker, name entry and first-run page show only with `?profiles=on`, as `storyIntro` gates story, so other scenarios keep Title then New Campaign.
- Saves migrate on every read and are stamped with `saveVersion` on the next write (no write on read); a newer build's save loads with the fields this build knows; an unversioned active run becomes version 2, a version 3 run is still refused.
- The typed DELETE in Options empties the active slot only (its save and pilot).

## Content inventory (tables: stages, bosses, dialogue sequences, assets, audio cues; counts, not prose)

| Item | Count |
| --- | --- |
| Campaign stages | 10 (tutorial, eight wardens, Omega) |
| Bosses | 10 |
| Dialogue sequences | 63: prologue 1, briefings 10, tutorial coach 1, radio 10, mini-boss callouts 8, boss intros 10, finale phases 3, boss defeats 10, districts restored 8, epilogue 1, credits 1 (12 speakers) |
| Hero atlas | 96 frames in 45 groups, 48px cells |
| Audio files | 4 music, 26 sfx |
| Profile slots | 3; historical save shapes migrated: 5 |
| Smoke scenarios / sweep missions | 58 / 10 |

## Evidence (every exit-gate eval: command, result line, artifact path, commit)

| Eval or check | Result | Where |
| --- | --- | --- |
| EVAL-P5-001 to P5-007, P5-009 to P5-011 | PASS | `docs/prompts/EVAL_LEDGER.md` rows (each cites its commit) |
| EVAL-P5-008 profiles | PASS on `e9781ef`: `tests/save-profiles.test.ts`, smoke `41-profiles` and `38c-title-continue-autosave` pass; qa-eval review SHIP (`docs/prompts/reviews/2026-09-25-5.6-profiles/qa-eval.md`) | `output/gates/test.log`, `output/smoke-runs/2026-09-25T01-52-34-789Z/`, uncommitted |
| `npm run verify` on `04bd3b8` | `PASS verify (352s)`: agents:check `0 errors`, sprites `Manifest valid (32 entries)`, `# pass 538` `# fail 0`, `built in 2.46s`, `Smoke test complete: 58 ran, 0 skipped`, 58 pass | `output/evidence/05-exit/verify.log`, `output/evidence/05-exit/verify-smoke-summary.json` |
| `npm run test:visual-sweep` on `04bd3b8` | `Mission visual sweep complete`, exit 0 | `output/sweep-runs/2026-09-25T04-16-40-311Z/` |
| `git grep -i "mega man\|mmx4\|spriters-resource" -- src scripts assets` | prints nothing | `04bd3b8` |
| `assets/private/` | does not exist | `04bd3b8` |
| `wc -l src/scenes/Game.ts` | 1930 (ceiling 3,400) | `04bd3b8` |

## Open risks and known debt

- P5-008 is "gate + review": no seat has reviewed 5.6 yet.
- `package-lock.json` still says 0.1.0 (the lane could edit `package.json` only); the next `npm install` rewrites it.
- Stage bests are the save shape only: prompt 08 writes them at stage results; Stage Select shows `BEST m:ss` under a cleared warden once one exists.
- There is no gamepad API in the input hub; the name grid is driven by the arrows, the touch pad and typed keys.
- `src/scenes/Game.ts` is still the one `@ts-nocheck` file.

## Inputs for prompt 06 (an explicit list: files to read, decisions to honor, numbers to keep)

- Movement constants as tuned (`PLAYER_GAMEPLAY_CONFIG` in `src/player/config.ts`; levels are built against them): run 220 px/s, accel 1700, decel 2100, air accel 1050, gravity 1050 (world 800), terminal 550, jump -400, jump cut -140, hold gravity scale 0.55, coyote 100 ms, buffer 100 ms, wall slide 95, wall jump 240 and -355 (boost 1.28, lock 140 ms), wall-kick grace 80 ms, wall stick 60 ms, corner nudge 3 px, step-up 3 px, dash 320 px/s for 280 ms (cooldown 60 ms), minimum jump hold 3 frames, hard landing at 400 px/s costs 80 ms.
- Hero cell contract: 48px cells, feet on row 46, sheets authored facing left (`shouldFlipPlayerSpriteForFacing` flips when facing right); `npm run sprites:audit-player` and `sprites:coverage` guard it.
- Camera vertical follow: `stepCameraFollow(state, input, constants)` in `src/scenes/game/cameraFollow.ts`, input `{ heroX, heroY, facing, dtMs, viewWidth, viewHeight, bounds }`; vertical is locked to `bounds.y` while the stage is one screen tall and becomes a symmetric 24px window with a time-based lerp once `bounds` are taller; constants in `src/config/gameplayLayout.ts` (trailing 64, look-ahead 40 over 250 ms, flip 0.5 px/ms, bounds ease 1.5 px/ms). Layout in game pixels (448x252).
- Style sheet: `docs/art/style-sheet.md`, with `docs/art/hero-brief.md`.
- Input replay format: `scripts/smoke/inputs/*.json` is `{ meta: { stage, spawn, purpose }, rows: [{ frame, held: [action, ...] }] }`, played by `stageDebug.replayInputs(script, { trace, keepHeld })` and captured by `recordInputs()` and `stopRecording()`; action names from `ACTION_NAMES` in `src/input/ActionState.ts`; details in `TESTING.md` (automation-only gameplay hooks).
- Profiles: stage results write `Profiles.recordStageBest(stageId, { timeMs, deaths, secretsFound, rank })`; read the pilot through `Profiles.active()` or `IDENTITY.HERO_CALLSIGN`; a new save field bumps `SAVE_VERSION` with a `SAVE_MIGRATIONS` step and a fixture in `tests/save-migration.test.ts`.
- Keep: `Game.ts` only shrinks (ceiling in `tests/agent-budget.json`); decisions D-013 to D-017.
