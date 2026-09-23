# Handoff 09: Footprint and performance

## Status: COMPLETE. STOP 9.4 (Craig plays a stage) and the disk decisions are open as `D-004` to `D-010` in `docs/prompts/DECISIONS.md`; none blocks another prompt.

Run by Claude (Opus 5.5) on 2026-09-22. Part 09a is detailed in `docs/prompts/handoff/09a-footprint-and-performance.md`; this file closes the prompt.

## Branch and final commit

Branch `codex/mega-runtime-and-assets-pass`. 09a: `9390db8`, `773e00d`, `14841ac`, `ee57454`. 09b and 09c: `df30ca8`. Review fixes: `275a3c0` (the exit gates ran on it). Records: the commit that adds this file.

## What changed (by area, with file paths)

- 09a (see its handoff): the production build boots, music on demand, Arcade-only Phaser, no default source maps, render-scale cap, per-stage backgrounds, `GAME_SIZE` layout for 14 sites, per-frame waste, menu row reuse.
- 09b: `src/ui/BakedGraphics.ts` and `src/ui/HUD.ts` (HUD panels and bars baked into textures, rebaked on scale change and WebGL restore); `src/enemy/EnemySpawner.ts` (retired enemies destroyed); `src/enemy/EnemyEntity.ts` (dead per-frame loop removed); `src/projectiles/ProjectileSystem.ts` (writes on change); `src/audio/PlaceholderAudioService.ts` (one AudioContext; late decodes evicted); `src/ui/VictoryModal.ts` (`GAME_SIZE`).
- 09c: `scripts/perf/disk-report.mjs`, `scripts/perf/clean-artifacts.mjs`; `git gc --prune=never` packed the reachable history.
- Harness and budget: `scripts/perf/footprint.mjs` (adds a combat scenario, fails on missing metrics, records dirty paths), `tests/perf-budget.json` (22 ceilings, lowered to achieved plus headroom).
- Tests: `tests/music-residency.test.ts`, `tests/music-service.test.ts`, `tests/settings-cache.test.ts`, `tests/stage-background-loading.test.ts`, `tests/hd-render.test.ts`; smoke `16`, `34`, `38`, `38b`, `40` extended.

## Decisions made (each with the reason and what it forecloses)

- No number, no ship: effect pooling, a save-parse cache, viewport-wide parallax, a baked backdrop and a text-resolution cap were measured and dropped (numbers in the 09 Outcome section). Revisit only with a scenario that shows a cost.
- The HUD is baked rather than redrawn; any new HUD Graphics goes through `BakedGraphics`.
- Nothing is deleted from disk by an agent: pruning, archiving and cleaning are `D-005` to `D-008`.

## Content inventory

| Measure | Before 09 | After 09 | Budget |
| --- | ---: | ---: | ---: |
| `dist/` | 19.98MB | 7.98MB | 9.5MB |
| Download before Title | 6.11MB | about 2.1MB | 2.5MB |
| Time to Title (headless) | 3.6s | about 0.9 to 1.2s | 2.0s |
| Decoded audio at Title / stage / boss | 86 / 86 / 86MB | 16 / 15 / 61MB | 16 / 16 / 64MB |
| Textures in a stage | 22.1MB | 8.8MB | 10.5MB |
| Stage step p50 / p95 (headless) | 5.3 / 10.7ms | 0.4 / 0.8ms | p95 3ms |
| Combat step p95 | 7.0ms | 2.6ms | 5ms |
| Largest canvas | 45MB | 16MB | 4,064,256 px |
| `.git` reachable history | 185MB loose | 106MB packed (73MB unreachable left for `D-006`) | n/a |

## Evidence (every exit-gate eval: command, result line, artifact path, commit)

- EVAL-P9-001 to P9-012 PASS: `docs/prompts/EVAL_LEDGER.md`, prompt 09 section.
- Exit gates on `275a3c0`: `npm run verify` exit 0 -> `agents:check: 0 errors`, `Test summary: 12 passed, 0 failed`, `# pass 286`, `# fail 0`, `✓ built in 3.09s`, smoke 51/51 (`output/phase-9-exit/final-verify.log`, `output/phase-9-exit/final-smoke/summary.json`); `npm run test:visual-sweep` 10/10 (`output/phase-9-exit/final-sweep/summary.json`); `PERF_LABEL=09-exit npm run perf:footprint` -> `footprint: 22/22 within budget, 0 page errors` on a clean tree (`output/perf/footprint-09-exit.md`).
- Before and after reports: `output/perf/footprint-baseline.md`, `footprint-09a.md`, `footprint-09b-before.md`, `footprint-09b-pools.md`, `footprint-09b-hud.md`, `footprint-09-exit.md`.
- Seat review of 09b: `docs/prompts/reviews/2026-09-22-10a/MERGED.md` (the qa-eval and principal-engineer findings on 09b were fixed in `275a3c0`).

## Open risks and known debt

- Headless timings are proxies; real-GPU frame time stays with prompt 08 section 8.5.
- The boss loop holds about 58MB while it plays (`D-009`).
- Evidence folders in `output/` can be overwritten by later runs; the exit runs are copied under `output/phase-9-exit/`.

## Inputs for prompts 05 to 08

- Keep `npm run perf:footprint` green (charter rule 14); lower ceilings when you beat them.
- New music: a `MUSIC_ASSETS` row only. New backgrounds: `STAGE_BACKGROUND_ASSETS` plus the stage's layers. New HUD drawing: `BakedGraphics`. Layout: `GAME_SIZE`.
- 08 section 8.5 extends `tests/perf-budget.json` rather than defining a second budget.
