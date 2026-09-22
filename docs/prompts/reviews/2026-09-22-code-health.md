# Code health and delivery risk, 2026-09-22 (input to phases 5.0, 6.0, 7.0, 8.5)

Baseline: `npm run test` 256 pass in 10.7s; `npm run build` green (166 modules, 20s); `Game.ts` 3,704 lines with `@ts-nocheck` on line 1; full smoke 51 in 5.6 minutes; sweep 10 in 4.5 minutes.

## Game.ts decomposition map (line ranges as of ca9f149)

| Block | Lines | Goes to |
| --- | --- | --- |
| `create()` wiring | 1419 to 1869 (450) | shrinks with every extraction below |
| Stage build, camera bounds, boss gate barrier, platform colliders, backgrounds | 409 to 677, 1010 to 1085 (340) | 06 `StageBuilder.ts` |
| Progression pickups, checkpoints, consumables; enemy drops, pickups, restore | 677 to 893, 2937 to 3204 (480) | 06 `PickupSystem.ts` |
| Boss defeated and victory flow | 2443 to 2507 | 07 `BossBeats.ts` |
| Disable and freeze combat | 2507 to 2582 | 05 `RunState.ts` |
| System menu, sub-tank, pause inventory | 2582 to 2691 | 08 presenters |
| Active-run snapshot, autosave, return | 2691 to 2794 | 05 `RunState.ts` |
| Boss hitbox, hazard and projectile block; boss art placeholder; `applyDamageToBoss`; `bossUpdate` | 158 to 325, 2185 to 2264, 2796 to 2937, 1377 to 1417 (430) | 07 `BossDamageRouter.ts` |
| Dev UX and debug snapshots | 1194 to 1377, 3570 to 3704 (317) | 05 `GameDebugHooks.ts`, `DebugSnapshots.ts` |
| Player damage, death, respawn; kill plane; hit-stop and shake | 3388 to 3510, 971 to 1005, 171 to 185 | 05 `DeathSequence.ts`, `CameraDirector.ts` |
| Saber FX, damage, impact FX | 2148 to 2181, 2315 to 2422, 3204 to 3247 (180) | 05 |
| Hit wires, contact handlers, bullet recycle | 1101 to 1192, 2266 to 2315, 3247 to 3304 (190) | 07 `HitWires.ts` |
| Weapon cycling, energy, fire, labels | 2049 to 2148, 3355 to 3388 (130) | 07 `WeaponRuntime.ts` |
| Enemy framework init | 3510 to 3566 | 06 `EnemyRuntime.ts` |

About 2,500 extractable lines. The ceilings hold only if extraction is each prompt's first phase.

## Test infrastructure

- `executeSmokeScenario` rethrows (`scripts/smoke-test.mjs` about line 341) and `main()` exits 1; one failure hides every later scenario. Same in the sweep.
- `outputDir` is wiped at start; a focused rerun destroys the evidence a handoff cites.
- `tools/ts-node-loader.mjs` tries only `${specifier}.ts`, never `${specifier}/index.ts`; ten barrels exist and none is on a test path yet.
- `--experimental-loader` warns on every run under Node 22.
- `advanceTime` counts rAF callbacks, not Phaser steps; `waitForState` polls; every timing assertion is statistical.
- `page.evaluate` has no timeout; a rAF that never fires hangs the session.
- Both harnesses run `renderer=canvas`; players get WebGL; no WebGL path is exercised.
- `test:scenes` globs `tests/*.test.ts` only.

## Build, CI, dependencies

- JS about 2.0MB raw, 488KB gzipped; Phaser chunk 1,479KB; sourcemaps 11.6MB emitted; `dist/assets` 20MB of which 4.5MB is `assets/private/`.
- CI on push runs test and build only; the browser job is manual.
- No `base`, `build:public`, `verify:public`, `check-public-build.mjs`, `deploy.yml` or `package:itch` exists.
- Phaser `^3.80` at 3.90.0 (`HdCamera` and the text factories depend on internals; pin exact); TypeScript `^5.4` at 5.9.3; no `engines`, no `.nvmrc`; Playwright `^1.58.2`; `.venv` Python 3.14 + Pillow 12.1.1 with no `requirements.txt`; `sprites:slice` and `sprites:placeholders` call bare `python3`; two scripts hard-code `/Users/thristannewman` paths.

## Performance budget

Measure frame-time p50/p95/p99 and long frames, render scale, decoded texture memory, JS heap, Preload time and bytes, through `window.perfDebug()`; smoke `51-perf-budget` on WebGL at scale 4; the sweep records the snapshot per mission. Thresholds in prompt 08 §8.5. Today: 19.6MB decoded textures over 80 PNGs. The render scale is uncapped: a 1920px window at DPR 2 is scale 8, a 3584x2016 canvas.
