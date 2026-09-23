# 09. Footprint and Performance

Active seats: Orchestrator, **Performance Engineer (lead, new seat, persona below)**, Principal Game Engineer (writes), QA / Eval Lead, Release Engineer, Audio Director (signs off music residency), Art Director (signs off render-scale and text sharpness).

Three sessions: `09a` (9.0 to 9.4), `09b` (9.5 and 9.6), `09c` (9.7 and the exit gate). All three ran on 2026-09-22 in the planning session; results are under "Outcome" at the end and in the ledger. 09 runs beside the v2 order, not in it: 09a lands before 05; 09b and 09c can run after any v2 prompt. From the moment 09a lands, `npm run perf:footprint` is a standing gate: every later prompt keeps it green or records why at a STOP.

| Part | Phase | Lead | Player-facing result | Evals | STOP asks Craig for |
| --- | --- | --- | --- | --- | --- |
| 09a | 9.0 Harness and budget | Perf | none (every later claim about weight has a number) | P9-001 | none |
| 09a | 9.1 The production build boots | Release | the built game starts at all | P9-002 | none |
| 09a | 9.2 Load less at boot | Perf | title appears sooner, a smaller download | P9-003, P9-004 | none |
| 09a | 9.3 Hold less while running | Perf | less RAM and GPU memory, same picture | P9-005, P9-006 | none |
| 09a | 9.4 Do less every frame | Engineer | steadier frames, pause and options menus fixed | P9-007, P9-008 | play one stage and the pause menu |
| 09b | 9.5 Pools and batching | Engineer | no hitches on shots, kills and checkpoints | P9-009 | approve effects look unchanged |
| 09b | 9.6 Text and HUD cost | Perf, Art | same HUD, cheaper to draw | P9-010 | approve text sharpness on a big screen |
| 09c | 9.7 Disk footprint | Release | the repo takes less space | P9-011 | archive the old source sheets? |
| 09c | Exit | QA | none | P9-012 | ship the budget as a standing gate |

## The Performance Engineer (the efficient person)

A seat with one job: make the game cost less, with numbers to show it, and change nothing a player can see unless Craig approves it at a STOP.

How they think:

- **Measure, change one thing, measure again.** Every claim is a before/after pair from the same command on the same machine (`npm run perf:footprint`). A change with no number is a style preference and does not ship under this prompt.
- **Cost the right unit.** Files on disk are not what a running game holds. Decoded audio costs `seconds x sampleRate x channels x 4` bytes (about 384KB per second of stereo music at 48kHz; the 152s boss loop alone is about 58MB). A texture costs `width x height x 4` whatever its PNG weighs (a 7KB background layer is 0.33MB decoded). A canvas costs `width x height x 4` per buffer, and at render scale `s` the canvas is `448s x 252s`. A Text object at resolution `s` costs `s squared` times its 1x canvas and re-rasterises on every `setText`.
- **The cheapest byte is the one never loaded; the cheapest frame is the one that does nothing.** Load per scene, not per game. Redraw on change, not per frame. Allocate once and reuse.
- **Every cache names its eviction rule.** Anything loaded on demand says when it leaves memory, in the same commit.
- **Leaks are growth, not size.** A number that goes up across stage revisits is a leak even when it is small; a big number that stays flat is a budget question.
- **Headless numbers are proxies.** SwiftShader frame times say whether the CPU work went up or down; they are never the verdict on a real GPU. Real frame time on Craig's Mac stays with prompt 08 §8.5.

Never does: trade visible quality (music, text sharpness, effects) for a number without a STOP; add a cache with no eviction rule; micro-optimise code that the harness cannot see; delete source art or history (disk work proposes, Craig decides); raise a budget ceiling without a ledger row that says why.

## Entry conditions

- Charter pasted. Read: `tests/perf-budget.json`, `scripts/perf/footprint.mjs`, `vite.config.ts`, `src/main.ts`, `src/scenes/Preload.ts`, `src/audio/PlaceholderAudioService.ts`, `src/audio/musicLibrary.ts`, `src/config/hdRender.ts`, `src/config/hdRenderMath.ts`, `src/scenes/game/` and the dev block, stage builder and boss HP wiring in `src/scenes/Game.ts`, `src/ui/HUD.ts`, `src/player/VfxSfxRouter.ts`, `src/enemy/EnemySpawner.ts`, `src/systems/Settings.ts`, `src/systems/Save.ts`.
- Run and paste: `npm run build`, then `PERF_REPORT_ONLY=1 PERF_LABEL=entry npm run perf:footprint`.

## Ground truth (measured 2026-09-22 on commit `7b9ff8e`)

The production build at `7b9ff8e` did not boot (see 9.1), so these numbers are from the same commit with only the chunk fix applied. Headless Chromium, SwiftShader WebGL, 896x504 viewport, cold cache. Artifact: `output/perf/footprint-baseline.json`.

| Measure | Baseline | Where it comes from |
| --- | --- | --- |
| Production boot | `ReferenceError: Cannot access 'b' before initialization` in `boss-*.js` | `manualChunks` split `src/boss`, `src/content`, `src/player` into chunks that import each other in a cycle; smoke runs on the dev server, so nothing caught it |
| `dist/` on disk | 19.98MB, of which source maps 11.61MB | `build.sourcemap: true`; Phaser's own map is 10.2MB |
| JS shipped (gzip) | 482.8KB, Phaser 337.3KB | full Phaser build including Matter physics, which the game never uses (`Phaser.Physics.Arcade` only) |
| Download before Title | 6.11MB, 5.62MB of it audio | `Preload` loads all four music files (4.6MB) before the Title can show |
| Time to Title | 3,583ms (headless, local server) | fetch plus decode of 228s of music |
| Decoded audio held | 86.3MB at boot, in a stage and at the boss | every track stays decoded for the whole session; `boss_loop.ogg` is 152s |
| Textures held | 13.5MB at Title, 22.1MB in a stage | all 10 boss atlases, 12 enemy atlases and all 30 background layers (9.2MB decoded) load at boot whatever the stage |
| Canvas on a big screen | 16.3MB at 1512x860@2x, 28.9MB at 1920x1080@2x, 45.2MB at 2560x1440@2x | render scale is `zoom x dpr` with no cap (scale 10 at 2560x1440@2x) |
| Per-frame waste (code reading, verified) | Arcade debug drawing of every body into a hidden Graphics; boss HP bar redrawn every frame; `Settings.get()` parses localStorage on every input snapshot (about 5 per frame); up to 132 debug Text labels created per stage; a `console.log` per bullet hit | `Game.ts` `devInit` (Phaser's `createDebugGraphic` sets `drawDebug = true`), `BossUIBinder.update`, `SettingsStore.get`, `devRegister`, `devLogOverlap` |
| Growth across revisits | heap +1.4MB over three revisits, textures +0, Phaser listeners +0 | clean; the pause menu and Options keep stale objects (`SystemMenu.rowBackplates`, `OptionsScene.labels/values/backplates` never reset) |
| Repo on disk | 686MB: `.git` 185MB (3,739 loose objects, never packed), `node_modules` 220MB (Phaser 146MB), `assets/sprites/source` 115MB (tracked, referenced by manifests), `output/` 77MB, `tmp/` 28MB, `.venv` 27MB | `du -sh` |

There is no Docker image in this repository. "Space when running" is the browser tab: decoded audio, textures, canvases and the JS heap, which is what the harness measures.

## Budgets

`tests/perf-budget.json` holds the ceilings; `npm run perf:footprint` fails on any breach or any page error. Relation to prompt 08 §8.5: this prompt pulls forward the memory and load parts of that budget; 08 keeps real-hardware frame time (p95 16.7ms, p99 25ms), `window.perfDebug()` and smoke `51-perf-budget`. When 08 lands, it reads this file rather than defining a second one.

## Phase 9.0: Harness and budget

Perf leads. `scripts/perf/footprint.mjs` serves `dist/` with `vite preview`, drives headless Chromium through five scenarios and writes `output/perf/footprint-<label>.{json,md}`:

1. **static**: `dist/` size, source-map bytes, JS raw and gzip, Phaser chunk gzip, runtime asset folders.
2. **boot**: cold cache; bytes and requests until the Title scene is active; then decoded audio (sum of `AudioBuffer` length x channels x 4 in `game.cache.audio`), texture bytes (every texture source), Text canvases, JS heap after a forced GC.
3. **stage and boss**: Pyro Maw entered from Stage Select the way the sweep does; the same snapshot after 90 frames, CPU time per Phaser step (`prestep` to `postrender`) over 180 frames; then the boss room forced open and measured again once the boss cue has loaded.
4. **revisit**: Game to Stage Select to Game four times; heap, texture count, Phaser listener count, sound instances; growth from cycle 1 to cycle 3.
5. **hiDpi**: canvas size at 1512x860, 1920x1080 and 2560x1440, all at `deviceScaleFactor` 2, without `automation=1` (which pins dpr to 1).

`PERF_REPORT_ONLY=1` records without failing (baselines); `PERF_LABEL` names the output. Ledger: `EVAL-P9-001`.

## Phase 9.1: The production build boots

Release leads. Keep Phaser as the only manual chunk (it changes rarely and stays cached across releases); let Rollup order game code. The harness fails on any page error, so a broken `dist/` can no longer pass a perf run. Recommend at the STOP that `test:smoke:preview` joins `verify` before release (08 §8.5 owns the public build). Ledger: `EVAL-P9-002`.

## Phase 9.2: Load less at boot

Perf leads, Audio Director signs off.

1. **Music on demand.** `Preload` stops loading music. `src/audio/musicResidency.ts` (pure, tested) decides which decoded tracks stay; `src/audio/MusicTrackLoader.ts` fetches and decodes one track into Phaser's audio cache when its cue is requested, and evicts every other music key once the new cue is playing. While a track loads, the previous one keeps playing, so a cue change is never silence. Sound effects stay preloaded (0.2MB, short). The debug state keeps `musicCue` and gains `musicLoading` and `residentMusicKeys`.
2. **Source maps off by default.** `build.sourcemap` follows `BUILD_SOURCEMAP=1`; debugging uses the dev server, and a release that needs maps sets the flag.
3. **Arcade-only Phaser.** Alias `phaser` to `phaser/dist/phaser-arcade-physics.min.js` for the build (types still come from the package). The game never touches Matter.

Evals: `EVAL-P9-003` (boot: download at or under 3MB, Title at or under 2.5s headless, decoded audio at boot at or under 16MB), `EVAL-P9-004` (static: `dist/` at or under 12MB, maps at or under 0.5MB, Phaser gzip at or under 300KB).

## Phase 9.3: Hold less while running

Perf leads, Art Director signs off the scale cap.

1. **Music residency** from 9.2 holds at most one decoded track at rest (two during a switch): Title and Stage Select about 13MB, a stage about 12MB, the boss room about 58MB (the boss loop is long; shortening it is an Audio Director decision for 08, recorded as a question).
2. **Render-scale cap at 6** (the figure 08 §8.5 already chose). `resolveRenderScale` returns `cssZoom` so the page keeps the same size on screen; above 6, the browser scales the canvas up with `image-rendering: pixelated`. Game-pixel edges stay exact because 6 canvas pixels map to a whole number of device pixels at every integer zoom; only the anti-aliased edge of text is scaled. 2560x1440@2x drops from 45MB to 16MB of canvas.
3. **Stage backgrounds per stage** (09b if 9.3 runs long): `Game.preload()` loads only the layers the stage uses (four or five); `Preload` stops loading all 30 and keeps only `bg_dock_0`, which the prologue draws. The loader skips keys already present, so a revisit costs nothing.

Evals: `EVAL-P9-005` (stage decoded audio at or under 16MB, boss at or under 64MB, textures at or under 12MB once item 3 lands), `EVAL-P9-006` (hi-DPI canvas at or under 4,064,256 pixels; `tests/hd-render.test.ts` covers the cap; smoke `40-hd-render` green).

## Phase 9.4: Do less every frame

Engineer writes, Perf reviews every diff.

1. `devInit`: create the Arcade debug graphic hidden and switch `drawDebug` back off (Phaser turns it on); the `\` toggle then shows it. Create the dev panel and per-object labels only when automation or `?debug` is on.
2. `BossUIBinder.update`: redraw only when the shown value or the max changed.
3. `SettingsStore.get`: parse storage once, then serve the in-memory copy; `update` writes through. External writes (the smoke `addInitScript` fixtures) happen before boot, so they are still read.
4. `devLogOverlap`: log only under automation debug.
5. `SystemMenu` and `OptionsScene`: reset `rowBackplates`, `labels`, `values`, `backplates` in `create()`; today every visit keeps the destroyed objects and the cursor highlight indexes the stale ones.
6. Remove dead per-stage work the audit found (boss-art animation rebuild with no consumer) where it is provably dead; `Game.ts` must end the phase shorter than it started.

Evals: `EVAL-P9-007` (unit tests for the settings cache and the boss-bar guard; `stage.stepP95Ms` at or under budget; smoke subset `4-title-controls,38-options-persist,38b-pause-weapon-select,8-boss-room-activation,40-hd-render` green), `EVAL-P9-008` (revisit growth: heap at or under 4MB, textures 0, listeners 0; a test that opening Options twice leaves one set of rows).

```
### STOP 9.4: Play one stage
Show: footprint before and after (output/perf/footprint-baseline.md, footprint-09a.md), the smoke subset line, Game.ts line count.
Ask Craig to play Pyro Maw to the boss, pause twice, open Options twice. Question: does anything look or sound different? Recommended: no; continue to 9.5.
```

## Phase 9.5: Pools and batching

Engineer writes. From the audit (`progress.md` 2026-09-22 entry lists file and line for each):

- `VfxSfxRouter`: one particle emitter per effect type, reused with `explode()`; pooled flash, ghost and slash sprites instead of a new emitter or Graphics per shot, charge level, wall-slide tick, dash ghost and slash. Same for the boss-bullet trail emitter and the hit and kill one-offs in `Game.ts`.
- `EnemySpawner`: destroy (or pool) retired enemies instead of hiding them in the group until shutdown.
- `Save`: keep the save in memory and write once per frame at most (debounced); a checkpoint today parses the save five times and writes it four times in one frame.
- `ProjectileSystem`: plain fields for per-frame bookkeeping (`stalledSince` fires two data events per bullet per frame).
- `EnemyEntity` / `EnemyAnimator`: remove the per-frame frame-name search whose result is unused.
- `Game.ts` shutdown: drop references to the finished run's HUD, player and systems.
- `PlaceholderAudioService.ensureContext` creates a second `AudioContext` beside Phaser's (for the synthesized fallback blips and the unlock state), so two audio render threads run for the whole session. Use Phaser's context (`game.sound.context`) and keep the unlock semantics; smoke `15-menu-audio-and-input-stability` and `4-title-controls` must stay green.

Evals: `EVAL-P9-009` (object counts flat over 600 frames of firing in a new footprint scenario; step p95 down against the 09a number; smoke `24-ground-sword-enemy`, `9-checkpoint-respawn`, `12-weapon-switch-energy` green; sweep 10/10 with the effects screenshots opened).

## Phase 9.6: Text and HUD cost

Perf and Art. Coordinate with 08 §8.2 (bitmap font), which may replace part of this.

- HUD rounded-rect Graphics re-tessellate every frame (each corner arc is about 100 points). Draw the static chrome once into a texture at the render scale, and bars as plain rectangles, redrawn on value change.
- Text resolution: measure Text canvas bytes per scene at scale 6 (the harness reports `textCanvasMB`); cap text resolution if dialogue and menus exceed 8MB, or move the HUD to the bitmap font.
- Stage backdrop and parallax: the backdrop Graphics spans the world width and redraws every frame; bake it per stage. Background TileSprites are world-width and allocate a world-width canvas each; make them viewport-width with `scrollFactor 0` and drive `tilePositionX` from the camera.

Evals: `EVAL-P9-010` (HUD and backdrop draw calls and step p95 down against 9.5; 2x screenshots of HUD, dialogue and Stage Select at scale 4 and 6 approved by Craig).

## Phase 9.7: Disk footprint

Release proposes, Craig decides. Nothing here deletes without his word.

- `npm run disk:report` prints the table above from the live tree.
- `npm run clean:artifacts` removes `output/` runs older than the newest per scenario and all of `tmp/`, after listing what it will remove and asking for `--yes`.
- `git gc --prune=never` packs the 3,739 loose objects without deleting anything unreachable. Measured without writing (`git rev-list --objects --all | git pack-objects --stdout | wc -c`, 2026-09-22): 111MB packed against 185MB loose, about 74MB back. Record the before and after `.git` size.
- Question for Craig: the February ChatGPT source sheets in `assets/sprites/source/` (about 110MB, still referenced by `source-images.manifest.json`) become obsolete once 05 and 06 regenerate every family through Higgsfield. Recommended: after 06 closes, move them to a release asset or an external archive, keep the manifests pointing at the archive, and drop them from the tree (history keeps them unless Craig asks for a rewrite, which is out of scope).

Ledger: `EVAL-P9-011`.

```
### STOP 9.7: Disk
Show: disk:report before and after, the clean list, the git gc numbers.
Question for Craig: archive the superseded source sheets after 06? Recommended: yes, after 06.
```

## Exit Gate

- `EVAL-P9-001` to `EVAL-P9-011` `PASS` (or `SKIPPED` with a reason Craig accepted); `EVAL-P9-012`: `npm run verify`, `npm run test:visual-sweep` and `npm run perf:footprint` result lines on the exit commit with artifact paths.
- `tests/perf-budget.json` ceilings lowered to the achieved numbers plus 15% headroom, so the next prompt cannot quietly give the savings back.
- Charter section 2 gains a Footprint row; section 8 gains the rule "keep `npm run perf:footprint` green before any STOP that touches assets, loading or the render loop".
- `wc -l src/scenes/Game.ts` lower than at entry.
- Handoff `docs/prompts/handoff/09-footprint-and-performance.md` per charter section 6, with `Inputs for 05 to 08`: music is loaded per cue (a new track needs only a `MUSIC_ASSETS` row), backgrounds load per stage, the scale cap is 6, the budget file is the one 08 extends.

## Kickoff (paste for 09b or 09c)

```
You are the Orchestrator for this repository. Read docs/prompts/00-orchestrator-charter.md, then docs/prompts/09-footprint-and-performance.md, then docs/prompts/EVAL_LEDGER.md (the P9 rows) and docs/prompts/handoff/09a-footprint-and-performance.md.
You are also the Performance Engineer seat described in 09: measure, change one thing, measure again, and never trade visible quality for a number without a STOP.
Run `npm run build` and `PERF_REPORT_ONLY=1 PERF_LABEL=entry npm run perf:footprint` and paste the table.
This session is part 09b: phases 9.5 and 9.6. Stop at every STOP block. Record a ledger row per eval with the command, the result line and the artifact path.
```

## Outcome (2026-09-22)

Measured with `npm run perf:footprint` before and after each change; the numbers are in the ledger rows and `output/perf/`.

| Phase | Shipped | Measured and not shipped (the rule: no number, no ship) |
| --- | --- | --- |
| 9.5 | Retired enemies destroyed; the per-frame frame-marker loop removed; projectile DataManager writes only on change; one AudioContext instead of two; a late music decode is evicted | Effect pooling (combat step p95 7.0 vs 7.1ms, and 18 more objects held); a save-parse cache (`save.v1` is 3.8KB) |
| 9.6 | The HUD's rounded panels and bars baked into textures (`src/ui/BakedGraphics.ts`): a stage frame 4.6ms to 0.4ms p50, 6.2 to 0.8ms p95, pixel-identical HUD; rebaked on resize and on a WebGL context restore | Viewport-wide parallax and a baked backdrop (hiding them changed nothing); a text-resolution cap (text canvases 0.6MB at 2x, about 5MB at 6x) |
| 9.7 | `npm run disk:report`; `npm run clean:artifacts` (dry run by default, Trash not delete, keeps anything cited or under three days old); `git gc --prune=never` packed the reachable history (106MB pack) | Pruning 73MB of unreachable objects, archiving the source sheets, `clean:artifacts -- --yes`, Docker cleanup: Craig's decisions `D-005` to `D-008` |

A seat review of 09b and 10a (`docs/prompts/reviews/2026-09-22-10a/MERGED.md`) caught a ceiling raised without a row (Phaser gzip 300 to 305, put back) and a smoke race the faster frames exposed (`34-prologue-flow` advanced dialogue inside its 160ms debounce; it now waits 12 frames).

