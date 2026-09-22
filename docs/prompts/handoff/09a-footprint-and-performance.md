# Handoff 09a: Footprint and performance (phases 9.0 to 9.4)

## Status: COMPLETE for 09a (9.0 to 9.4). 09b (9.5, 9.6) and 09c (9.7, exit gate) are not started.

Run by Claude in the planning session on 2026-09-22, at Craig's request to make the game lighter, faster to load and cheaper to run, with a plan, evals, prompts and a persona. The plan is `docs/prompts/09-footprint-and-performance.md`. STOP 9.4 (Craig plays one stage, pauses twice, opens Options twice) is still owed.

## Branch and final commit

Branch `codex/mega-runtime-and-assets-pass`, on top of `7b9ff8e`. Committed as `9390db8` (harness), `773e00d` (build), `14841ac` (runtime), `ee57454` (docs). 09b and 09c follow in `df30ca8`; the prompt's exit handoff is `docs/prompts/handoff/09-footprint-and-performance.md`.

## What changed (by area, with file paths)

### 9.0 Harness and budget (EVAL-P9-001)
- `scripts/perf/footprint.mjs` (`npm run perf:footprint`): static, boot, stage, boss, revisit and hi-DPI scenarios against `dist/` under `vite preview`; `output/perf/footprint-<label>.{json,md}`; fails on a budget breach or any page error; `PERF_REPORT_ONLY=1`, `PERF_LABEL`, `PERF_PORT`.
- `tests/perf-budget.json`: 20 ceilings.

### 9.1 The production build boots (EVAL-P9-002)
- `vite.config.ts`: `manualChunks` keeps only the Phaser chunk. The old folder split (`boss`, `content`, `gameplay`) made chunks import each other in a cycle; `dist/` threw `ReferenceError: Cannot access 'b' before initialization` at `boss-*.js` and never reached the Title. Smoke runs on the dev server, so nothing had caught it.

### 9.2 Load less at boot (EVAL-P9-003, EVAL-P9-004)
- Music on demand: `src/audio/musicResidency.ts` (pure eviction rule), `src/audio/MusicTrackLoader.ts` (fetch plus `decodeAudioData` into Phaser's audio cache, one job per key, `evict`), `src/audio/PlaceholderAudioService.ts` (decode on request even while locked, previous track plays on until the new one is ready, evict idle tracks after a cue starts; debug state adds `musicPlayingCue`, `musicLoading`, `residentMusicKeys`; `musicCue` is the requested cue). `src/scenes/Preload.ts` no longer loads music.
- `vite.config.ts`: `build.sourcemap` only with `BUILD_SOURCEMAP=1`; `phaser` aliased to `phaser/dist/phaser-arcade-physics.min.js` for builds and the unminified Arcade build for dev (the game never uses Matter).

### 9.3 Hold less while running (EVAL-P9-005, EVAL-P9-006)
- `src/config/hdRenderMath.ts`: `MAX_RENDER_SCALE = 6`, `cssZoom`; `src/config/hdRender.ts` and `src/main.ts` use `cssZoom`.
- `src/scenes/game/stageBackgroundLoading.ts`: `Game.preload()` loads only the stage's layers and drops the previous stage's; `Preload` keeps `bg_dock_0` (the prologue draws it).
- `src/scenes/Game.ts` `renderStageBackground`: parallax TileSprites sized with `GAME_HEIGHT`, not `this.scale.height` (canvas pixels); they were `252 x scale` tall, about 32MB of canvases at scale 6.
- `src/config/renderPolicy.ts` `GAME_SIZE`; thirteen layout sites switched from `this.scale`/`scene.scale` to it: `Title`, `OptionsScene`, `SystemMenu`, `ControlsScene`, `GameOverScene`, `StageSelect`, `PrologueScene`, `EndingScene` (two), `ProgressionSummaryScene`, `ui/ToastLane`, `ui/DialogueOverlayController`, `ui/StageIntroPresenter`, `ui/menu/menuTheme`. Found while measuring: at 2x the Title and Options drew off centre (screenshot evidence in `output/perf/hd-check/`), at 6x mostly off screen, and the menu backdrop drew about 450 lines per frame instead of about 75.

### 9.4 Do less every frame (EVAL-P9-007, EVAL-P9-008)
- `Game.ts` `devInit`: `drawDebug` switched off after `createDebugGraphic()` (Phaser turns it on, so every body was drawn into a hidden Graphics each frame; the `\` toggle was also inverted). Debug labels are created in `devUpdate` only while the overlay is on (up to 132 Text objects per stage before). `devLogOverlap` logs only under automation.
- `Game.ts`: dead per-stage boss animation rebuild removed (`bossArt` is never assigned); `prepareBossArtVisuals` keeps only the missing-atlas guard. `Game.ts` 3,704 to 3,639 lines.
- `src/ui/HUD.ts` `drawBar`: skips the redraw when position, size, fill and colour are unchanged (the boss bar was rebuilt every frame).
- `src/systems/Settings.ts`: `get()` still reads storage (smoke fixtures write `settings.v1` directly) but parses only when the stored string changed; `update()` primes the cache.
- `src/scenes/OptionsScene.ts`, `src/scenes/SystemMenu.ts`: row arrays reset in `create()`. On a second Options visit the value changes went to the first visit's destroyed Text objects, so the visible numbers did not update.

### Tests and smoke
- New: `tests/music-residency.test.ts` (4), `tests/settings-cache.test.ts` (3), `tests/stage-background-loading.test.ts` (4); `tests/hd-render.test.ts` gains the cap test and `cssZoom`.
- Smoke: `38-options-persist` opens Options twice more in one page and checks one set of rows and the visible value; `38b-pause-weapon-select` pauses a second time and checks one set of backplates; `40-hd-render` checks every visible Text on Title, Options and Stage Select stays inside the frame at 2x (`menus-2x.json`, `menu-*-2x.png`).

### Docs
- `docs/prompts/09-footprint-and-performance.md` (plan, persona, budgets, phases, STOPs, kickoff), charter amendment row and hard rule 14, `docs/prompts/README.md`, `START.md`, `EVAL_LEDGER.md` (P9 rows), `TESTING.md`, `docs/testing/quality-gates.md`, `docs/architecture/rendering.md`, `ARCHITECTURE.md`, `README.md`, `progress.md`.

## Decisions made (each with the reason and what it forecloses)
- Music decodes per cue rather than streaming through a media element: it keeps Phaser's sound path, loop points and volume handling unchanged and leaves sample-accurate stems possible for 08's adaptive boss music. It forecloses nothing; a 152s boss loop still holds about 58MB while it plays (Audio Director question for 08: shorten or stream it).
- Render scale capped at 6, the number 08 §8.5 had already chosen. Above it text is resampled by the browser; game pixels stay exact. The Art Director check at a 5K display is 9.6's STOP.
- One game chunk: splitting game code needs dynamic `import()` per scene, not folder chunks.
- Source maps off by default: `dist/` drops 11.6MB; debugging uses the dev server or `BUILD_SOURCEMAP=1`.

## Content inventory

| Measure | Baseline | After 09a | Budget |
| --- | ---: | ---: | ---: |
| `dist/` total | 19.98MB | 7.98MB | 12 |
| Source maps in `dist/` | 11.61MB | 0 | 0.5 |
| JS gzip (all chunks) | 482.8KB | 440.3KB | 520 |
| Phaser chunk gzip | 337.3KB | 294.2KB | 300 |
| Download before Title | 6.11MB | 1.19 to 2.11MB (the Title's own track may land before the state flips) | 3.0 |
| Time to Title (headless, local) | 3,583ms | 1,065ms | 2,500 |
| Decoded audio at Title | 86.3MB | 15.6MB | 16 |
| Decoded audio in a stage | 86.3MB | 15.1MB | 16 |
| Decoded audio at the boss | 86.3MB | 61.2MB | 64 |
| Textures at Title | 13.5MB | 4.7MB | 12 |
| Textures in a stage (scale 2) | 22.1MB | 8.3MB | 12 |
| Step CPU p50 / p95 in a stage (SwiftShader proxy) | 5.3 / 10.7ms | 4.9 / 6.8ms | p95 12 |
| Revisit growth: heap, textures, listeners | +1.36MB, 0, 0 | -1.65MB, 0, 0 | 4, 0, 0 |
| Largest canvas (2560x1440 at 2x) | 4480x2520, 45.2MB | 2688x1512, 16.3MB | 4,064,256 px |
| `Game.ts` lines | 3,704 | 3,639 | lower than entry |

Artifacts: `output/perf/footprint-baseline.{json,md}`, `output/perf/footprint-09a.{json,md}`.

## Evidence (every exit-gate eval: command, result line, artifact path, commit)
- EVAL-P9-001 to P9-008 PASS: rows in `docs/prompts/EVAL_LEDGER.md`, prompt 09 section. Gates run on the uncommitted 09a tree.
- `npm run verify` exit 0: `Manifest valid (25 entries, 25 ready, 0 planned)`, `Coverage valid (23 required manifest entries, 12 enemy source sheets, 10 boss source sheets)`, `Test summary: 12 passed, 0 failed`, `# pass 268`, `# fail 0`, `✓ built in 2.67s`, `Checked 153 runtime asset files and 2 emitted build refs in dist/.`, smoke 51/51 pass (`output/phase-9a/verify.log`, `output/phase-9a/full-smoke/summary.json`).
- `npm run test:visual-sweep` exit 0: `Mission visual sweep complete.`, 10/10 missions pass (`output/phase-9a/sweep.log`, `output/phase-9a/visual-sweep/summary.json`).
- `PERF_LABEL=09a npm run perf:footprint`: `footprint: 20/20 within budget, 0 page errors` (`output/perf/footprint-09a.{json,md}`); baseline `8/20` (`output/perf/footprint-baseline.{json,md}`).
- Screenshots opened: `output/phase-9a/full-smoke/40-hd-render/menu-title-2x.png` and `menu-options-2x.png` (centred, HD text); `output/perf/hd-check/title-2x.png` and `options-2x.png` (the off-centre red state); sweep `pyro_maw/mid.png`, `glacier_ronin/boss-room.png`, `omega_fortress/start.png` (backgrounds per stage render as before).

## Open risks and known debt
- Headless numbers are proxies; real-GPU frame time is 08 §8.5.
- The boss loop is long (152s, about 58MB decoded while it plays).
- Vite's 500KB chunk warning remains: Phaser's Arcade build is 1.09MB minified.
- Still per frame (09b): VFX emitters and sprites created per shot, enemy sprites hidden not destroyed, the save parsed and written several times per checkpoint, HUD rounded-rect Graphics re-tessellated every frame, parallax TileSprites world-wide, a second `AudioContext`.
- Disk (09c): `.git` is 185MB of loose objects (about 111MB packed), `assets/sprites/source` 115MB, `output/` 77MB, `tmp/` 28MB.

## Inputs for 09b, 09c and prompts 05 to 08
- Read `docs/prompts/09-footprint-and-performance.md` and this file; run `npm run build` and `PERF_REPORT_ONLY=1 PERF_LABEL=entry npm run perf:footprint` first.
- A new music track needs only a `MUSIC_ASSETS` row; do not add music to `Preload`.
- New biome backgrounds (06) go in `STAGE_BACKGROUND_ASSETS` and a stage's `arena.background.layers`; `Game.preload()` loads them. Anything drawn outside a stage joins `RESIDENT_BACKGROUND_KEYS`.
- Layout uses `GAME_SIZE` / `GAME_WIDTH` / `GAME_HEIGHT`, never `scene.scale`.
- 08 §8.5 extends `tests/perf-budget.json`; it does not define a second budget.
- Suggested commits: (1) `fix: production build boots (drop folder manualChunks)`; (2) `perf: music on demand, arcade-only Phaser, no default source maps`; (3) `perf: render-scale cap, per-stage backgrounds, GAME_SIZE layout`; (4) `perf: per-frame waste and menu row reuse`; (5) `docs: 09 footprint plan, harness, ledger, handoff`.
