# Progress

The rolling handoff log for every agent (Claude, Codex, ChatGPT). Read **Now** and the last three entries; nothing older is needed by default. Older entries are verbatim in `docs/archive/progress/`. Write one entry per session with the template below; `npm run agents:check` enforces this file's budget (`tests/agent-budget.json`) and `npm run agents:rotate-progress` moves the oldest entries to the archive when it grows. Live numbers (test counts, `Game.ts` lines, budgets) come from `npm run agents:facts`; do not copy them into prose where they go stale.

## Now

- Branch `codex/mega-runtime-and-assets-pass`. Prompt 09 is complete; prompt 10 part 10a is complete and seat-reviewed. No prompt is mid-run.
- Next: prompt 05 part 05a (`docs/prompts/START.md` block A). It is blocked until Craig answers `D-001`, `D-002` and `D-003` in `docs/prompts/DECISIONS.md`; `npm run agents:check -- --entry 5` shows it. Also waiting on Craig: `D-004` (play Pyro Maw) and the disk and Docker decisions `D-005` to `D-008`.
- After that, 10b (one session: CI, evidence snapshots, pack test, retro) once `D-011` is answered.
- Standing gates: `npm run verify` (starts with `agents:check`), `npm run test:visual-sweep`, and after `npm run build`, `npm run perf:footprint`.

## Entry template (1.5KB at most)

```
- YYYY-MM-DD, <prompt part or task>, <agent and model> (e.g. Codex gpt-5, Claude Opus 5.5)
  - Changed: <what, with paths; one line per area>
  - Gates: <command> -> <result line> (<artifact path>)
  - Decisions: <D-ids raised or answered at STOPs; ledger ids moved>
  - Open: <what the next session must know>
```

## Log (oldest first, newest at the bottom)

- Session 01c, Phase 1.5 pause menu, options, autosave and death economy, completed on 2026-09-10 (Claude):
  - `SystemMenu` is now the pause menu for `Game` (one linear cursor: Weapon cycle row that equips as it cycles, Sub Tank row that selects with left/right and drinks with Enter, then Resume, Controls, Options, Quit To Warden Select, with a hearts/armor/chips status line) and stays the route console for Stage Select (Controls, Options, New Campaign, Back; Progression only in automation). `save_game`/`load_game` handlers remain for the automation scenarios that call them directly.
  - New `OptionsScene` (music and sound volume steps applied live by the audio service, screen shake gated in `Game.onCameraShake`, story replay, difficulty written to the save with the boss-HP note, Controls, Delete All Data by typing DELETE, Back), reachable from Title (`O`), the route console and the pause menu.
  - Autosave: the active run is written on fresh stage entry, at every checkpoint and after every respawn; quitting to Warden Select clears it; boss clear and game over already cleared it. Title reads `CONTINUE  WARDENS n/8  1H 12M` when a campaign exists and resumes the active run on Enter.
  - Death economy: three lives per stage entry, HUD `RETRY x03`; `GameOverScene` offers Continue (last checkpoint on Assist and Normal, stage start on Veteran; `resolveContinueCheckpoint`) and Quit, with a five-second auto-continue.
  - Sub tanks: `subTankFill` in the save; health collected at full HP fills the first non-full tank; drinking heals its fill of max HP over 900ms.
  - Automation: `stageDebug.setSubTanks`, `setLives`; payloads `systemMenu`, `options`, `gameOver`; scenarios `38-options-persist`, `38b-pause-weapon-select`, `38c-title-continue-autosave`; `13e-input-source-lifecycle` and `4b` now select menu rows by id and length; `33b` enables story replay before its same-session restart because a seen boss intro does not replay by default.
  - Validation: `npm run test` 12 boss + 248 scene tests green; `npm run build` green; focused smoke over every menu, autosave, pickup and title scenario green. `Game.ts` is 3,700 lines (3,805 at the prompt-01 entry).
- Session 09a, footprint and performance (phases 9.0 to 9.4), completed on 2026-09-22 (Claude, planning session; nothing committed):
  - Craig asked for a lighter, faster-loading game that holds less while running, with a plan, evals, prompts and a persona. Plan: `docs/prompts/09-footprint-and-performance.md` (Performance Engineer seat, budgets, phases 9.0 to 9.7, STOPs, kickoff). Handoff: `docs/prompts/handoff/09a-footprint-and-performance.md`. Ledger `EVAL-P9-001` to `P9-008` PASS.
  - Found while measuring: the production `dist/` did not boot (`ReferenceError: Cannot access 'b' before initialization`; the folder `manualChunks` split was a chunk cycle; smoke runs on the dev server). Fixed by keeping Phaser as the only manual chunk.
  - Found while verifying: thirteen menu and overlay sites laid out with `scene.scale` (canvas pixels), so Title, Options, pause menu, Stage Select, dialogue, toasts and the stage card drew off centre at 2x and mostly off screen at 6x; the stage parallax canvases were `252 x scale` tall. All use `GAME_SIZE` / `GAME_HEIGHT` now; smoke `40-hd-render` checks menu text stays in frame at 2x.
  - Load and memory: music decodes per cue and is evicted when idle (`src/audio/MusicTrackLoader.ts`, `musicResidency.ts`); stage backgrounds load in `Game.preload()` per stage (`src/scenes/game/stageBackgroundLoading.ts`); Arcade-only Phaser; source maps only with `BUILD_SOURCEMAP=1`; render scale capped at 6 with `cssZoom`.
  - Per frame: Arcade debug drawing off (Phaser's `createDebugGraphic` had switched it on), debug labels only while the overlay shows, collision log only under automation, HUD bars redraw on change, settings parsed once per stored string, dead boss-animation rebuild removed, Options and pause-menu row arrays reset per visit (a second Options visit updated destroyed text, so values did not change on screen). `Game.ts` 3,704 -> 3,639.
  - Numbers (`output/perf/footprint-baseline.md` -> `footprint-09a.md`, headless): `dist/` 19.98 -> 7.98MB; download before Title 6.11 -> about 2MB; Title 3.6s -> 1.1s; decoded audio 86MB -> 15.6MB at Title and in a stage, 61MB at the boss; textures in a stage 22.1 -> 8.3MB; largest canvas 45 -> 16MB; step p95 10.7 -> 6.8ms; revisit growth flat.
  - Gates: `npm run test` 12 boss + 268 scene tests, 0 fail; `npm run verify` exit 0 with smoke 51/51 (`output/phase-9a/verify.log`, `full-smoke/`); visual sweep 10/10 (`output/phase-9a/sweep.log`, `visual-sweep/`); `npm run perf:footprint` 20/20, 0 page errors. Automation state gained `audio.musicPlayingCue`, `musicLoading`, `residentMusicKeys`, `options.rowObjects`, `shownValues`, `systemMenu.rowBackplates` (documented in `TESTING.md`); `musicCue` still reports the requested cue.
  - Open: STOP 9.4 (Craig plays a stage, pauses twice, opens Options twice); 09b pools, HUD and text cost, second `AudioContext`; 09c disk (`.git` 185MB loose, about 111MB packed; `assets/sprites/source` 115MB). Charter gained rule 14: keep `npm run perf:footprint` green.
- 2026-09-22, prompt 09 parts 09b and 09c and the exit, Claude Code (Opus 5.5)
  - Changed: HUD panels and bars baked into textures (`src/ui/BakedGraphics.ts`, `src/ui/HUD.ts`; a stage frame 4.6ms to 0.4ms headless, HUD pixel-identical); retired enemies destroyed; dead per-frame enemy loop removed; projectile data writes on change; one AudioContext; late music decodes evicted; `VictoryModal` on `GAME_SIZE`; `disk:report` and `clean:artifacts`; `git gc --prune=never`; budgets lowered. Pooling, a save cache, parallax and text-resolution changes measured and dropped (no gain).
  - Gates on `275a3c0`: `npm run verify` exit 0 (`# pass 286`, smoke 51/51), sweep 10/10, `footprint: 22/22 within budget, 0 page errors` (`output/phase-9-exit/`, `output/perf/footprint-09-exit.md`).
  - Decisions: `D-004` to `D-010` raised. Ledger P9-009 to P9-012 PASS. Handoff `docs/prompts/handoff/09-footprint-and-performance.md`.
  - Open: smoke `34-prologue-flow` had a latent 160ms dialogue-debounce race the faster frames exposed; fixed by waiting 12 frames.
- 2026-09-22, prompt 10 part 10a (the agent system), Claude Code (Opus 5.5)
  - Changed: `npm run agents:check` / `agents:context` / `agents:facts` / `agents:reviews` / `agents:rotate-progress` (`scripts/agents/`), `docs/prompts/DECISIONS.md`, `docs/prompts/seats/` and `.claude/agents/game-*.md`, `AGENTS.md` rewritten, `CLAUDE.md`, `START.md` blocks A to G, this log archived and restarted, ledger 01 to 04 archived, charter amendments and rule 15, `docs/prompts/10-agent-system.md`.
  - Gates: same exit run as 09; `tests/agents-checks.test.ts` 16 fixtures; seat review `npm run agents:reviews -- docs/prompts/reviews/2026-09-22-10a --expect docs-steward,qa-eval,principal-engineer` -> `3 reviews, 31 evidenced findings (2 BLOCK), 0 format problems`, all acted on in `275a3c0`.
  - Decisions: `D-001` to `D-003` block entry 5; `D-011`, `D-012` for 10b. Ledger P10-001 to P10-005 PASS. Handoff `docs/prompts/handoff/10a-agent-system.md`.
  - Open: the Codex CLI on this Mac is broken (missing binary), so `scripts/agents/run-seats.sh` has not run; CI does not run `agents:check` yet.
