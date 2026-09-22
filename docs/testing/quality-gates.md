# Quality Gates
- Status: canonical
- Owner scope: tools, gameplay
- Last reviewed: 2026-09-10

## Merge Gates
| Change type | Minimum required commands |
| --- | --- |
| Docs only | `npm run test`, `npm run build` |
| Logic, content contracts, save systems, scene rules | `npm run test` |
| Runtime or TypeScript integration | `npm run test`, `npm run build` |
| Gameplay flow, UI/input, scene transitions, automation hooks | `npm run test`, `npm run build`, `npm run test:smoke` |
| Production packaging, deploy, runtime asset-copy workflow | `npm run test`, `npm run build`, `npm run test:smoke:preview` |
| Sprite, atlas, mission-wide visuals, presentation | `npm run test`, `npm run build`, `npm run test:visual-sweep` |
| Substantive gameplay, tools, content, or asset-pipeline work | `npm run verify` |
| Loading, audio, asset families, render scale, per-frame loop | `npm run test`, `npm run build`, `npm run perf:footprint` (budget `tests/perf-budget.json`; also the only gate that boots `dist/` every run) |

## What Blocks Merge
- Failed required commands
- Smoke or visual harness runs that do not return cleanly, even if screenshots/state artifacts were produced; classify these explicitly via the generated `summary.json` artifact instead of treating them as silent passes
- Stale canonical docs after workflow or architecture changes
- Broken automation hooks (`render_game_to_text`, animation-frame waiting through `advanceTime`) without coordinated updates
- Regressed gameplay trace fields needed for deterministic feel checks: body profile, collision flags, timers, dash edges, wall side, landing speed, jump source, damage source/tier, knockback, projectile spawn frame, and touch-button state
- Undocumented new debt or regressions
- Missing `progress.md` handoff note for meaningful work

## Manual Review Checklist
- Canonical docs still match the commands and runtime behavior.
- The change did not expand `@ts-nocheck` usage.
- The change did not bypass smoke or visual checks for a high-risk gameplay area.
- Any archived or reclassified docs have an obvious replacement path.

## Browser Gate Settings and Evidence
- GitHub's push/pull-request job uses Node 22, `npm ci`, `npm run test`, and `npm run build`; `npm run ci` is the corresponding local gate. Browser smoke/sweep run only through the manual workflow and upload `output/` even on failure; see `TESTING.md` for operation.
- `TESTING.md` owns the complete automation hook and run-setting reference, including `SMOKE_ONLY`, `SMOKE_FROM`, `SMOKE_PORT`, `SWEEP_PORT`, and `SMOKE_SERVER=preview`.
- Browser scenarios use `?renderer=canvas&automation=1&startScene=StageSelect`; title scenarios omit `startScene`. Debug hooks and scene/boss overrides require automation mode.
- `window.advanceTime(ms)` waits for animation frames; it does not deterministically step Phaser. Prefer state predicates and pure logic checks for timing-sensitive assertions.
- A full smoke pass requires every registered scenario to pass with no filter skips; a focused `SMOKE_ONLY` pass proves only the selected scenarios.
- Preserve prior summaries and failure captures before another browser run replaces its output directory. Record exit code, result line, summary path, and inspected PNG paths together.

## Release-Readiness Focus
Before considering a broader release or handoff complete:
- `npm run verify` passes.
- Any new content/schema changes validate cleanly.
- Smoke automation reflects actual runtime behavior and writes `output/web-game-smoke/summary.json` with truthful per-scenario status.
- Input lifecycle smoke must retain fast taps, keep held confirmation unarmed through scene return, isolate modal underlays, preserve fresh controls after repeated pause/resume, and restore debug hooks on Game reentry. Opening pause cancels pending charge without a deferred shot or damage-protection reset.
- Saber-direction smoke must keep the locked animation direction, mirrored sprite facing, trail, and active hitbox aligned even if locomotion reverses during startup.
- Projectile lifecycle smoke must prove that a deliberately stopped standard shot is recycled instead of remaining active and visible.
- Short-enemy pellet smoke must retain the same live mine bot at 5→4 HP and attribute exactly one damage to one uncharged Buster shot; missing targets, charged shots, and unrelated damage must fail its evidence check.
- Viewport/energy smoke must prove actor bodies cannot enter the fixed HUD, health and weapon drops use distinct capsule textures, saber use can reboot an empty selected special, and holstered specials regain energy passively.
- Every visual-sweep boss room must report no legacy boss actor, one controller visual child, and exactly one visible boss sprite.
- Production preview smoke passes with `npm run test:smoke:preview` when a change touches packaging, deploy readiness, or runtime asset loading.
- `npm run perf:footprint` is 20/20 within `tests/perf-budget.json` with 0 page errors; a ceiling is only raised with a ledger row that says why (charter rule 14).
- Menus and overlays lay out in game pixels (`GAME_SIZE`); smoke `40-hd-render` keeps Title, Options and Stage Select text inside the frame at 2x, and `38`/`38b` keep one set of Options and pause-menu rows per visit.
- Visual sweep writes `output/mission-visual-sweep/summary.json` with truthful per-mission status, including `hung_after_artifacts` when cleanup times out after artifacts already exist.
- Known risks are called out in the final summary and `progress.md`.

## Phase 1.1 campaign coverage

The current smoke surface includes `33-classic-stage-select` (true empty-storage chooser, Classic tutorial clear/reward/weakness, native bounds and long seed) and `33b-classic-upgrade-runtime` (armor/save/time and actual shot consumers). Existing smoke pages explicitly initialize a legacy Randomizer fixture; `4b` asserts its mode, and `12` additionally checks independent ArcSlash release identity/count/energy. Existing movement/touch scenario bodies remain unchanged.

The two new mode fields, pending chooser state, layout evidence and automation-only weapon/upgrade grants are specified in [TESTING.md](../../TESTING.md#classic-campaign-automation-additions). Run focused new/legacy unit checks, then affected smoke; substantive campaign changes require all verify components and a visual sweep for the stage layout/global upgrade presentation. Open every generated PNG; a state/bounds assertion does not replace visual review.

Scenario `29-pellet-hits-short-enemy` isolates a live mine bot with its normal collider/HP and AI/projectile emission disabled, clears prior hostile projectiles, then requires one ordinary Buster shot to reduce that same target from 5 to 4 HP. Its retained clash trace distinguishes interception from a hitbox miss; separate projectile-clash scenarios cover interception.

Identity gate: `tests/identity-strings.test.ts` validates the actual object/skin truth table, naming authority and lexical source scan; `4-title-controls` captures native Title/Controls/Stage Select/HUD separately and checks geometry, actual HUD/manifest pairing and dialogue tokens. Run its focused development-server preview with `VITE_PUBLIC_BUILD=1` to require WREN and base/zero-private-overrides. Full smoke/sweep retain normal developer configuration. See `TESTING.md` for the capture contract; this preview does not satisfy the later public packaging/art gate.

Boss-room validation includes scenario 8’s actual post-update lifecycle probe: both horizontal bounds, body alignment, preserved vertical motion, inward release and listener cleanup. The screenshot is captured before the probe; `boundary-lifecycle.json` carries that evidence. The visual sweep saves raw movement samples before asserting the existing strict bounds, so a failed sample survives for diagnosis.
