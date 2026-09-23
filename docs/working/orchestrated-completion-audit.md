# Orchestrated Completion Audit
- Status: working
- Owner scope: gameplay, content, assets, saves, QA

Status update (2026-08-04): the P0 completion sequence described here is implemented. Production assets, save validation/import truth, unified projectile/player-damage paths, route retention, authored boss runtimes, and the Omega finale now pass unit, build, smoke, and ten-mission visual gates. Use `progress.md` and `docs/working/supervised-game-completion-plan.md` for the latest handoff; remaining entries in this audit are historical polish/debt context.
- Last reviewed: 2026-07-08

This is the consolidated plan from five focused mini-audits run against the current playable Mega Man-style game. Treat this as the working backlog for turning the current prototype/completion candidate into a more finished version. Canonical behavior still lives in `README.md`, `ARCHITECTURE.md`, `TESTING.md`, and the source.

## Audit Team
| Persona | Scope | Main Question |
| --- | --- | --- |
| Runtime architect | `src/scenes/Game.ts`, boss/player/projectile ownership, automation hooks | What is blocking safer implementation? |
| Save/progression UX lead | saves, imports, stage select, final gate, destructive actions | Can progress be trusted and understood? |
| Gameplay feel/combat lead | movement, damage, projectiles, traces, touch controls | Does play feel correct in the browser? |
| Level/content director | campaign routes, stage variety, enemy/boss/finale content | Is there enough authored game content? |
| Art/animation/performance QA lead | production assets, sprites, animation contracts, visual gates, bundle | Can the shipped build look complete and stay verified? |

## Executive Read
The game is playable and the baseline gates currently pass, but it is not finished. The largest finish risks are not a lack of systems; they are integration gaps where the older scene-owned runtime and newer modular systems disagree.

Release blockers:
- Production build asset completeness is not proven. `dist/` currently lacks runtime asset files even though preload paths resolve in dev.
- Save/progression imports can claim locations without reconstructing boss clears, tutorial clear, final-boss clear, or regenerated seed world truth.
- Active-run resume trusts stored stage, boss, weapon, and checkpoint ids too much.
- Projectile spawning, charge metadata, and boss damage are split across player combat, animation events, projectile metadata, and legacy scene state.
- Stage extension content is filtered out before runtime, leaving many stages much thinner than intended.
- Boss and final-fortress content are still mostly generic fallbacks.
- `src/scenes/Game.ts` remains the type-blind integration choke point and keeps duplicate legacy/new runtime paths alive.

The best path is a three-shot plan:
1. Stabilize correctness and release gates.
2. Finish game content and runtime ownership.
3. Polish art, animation, feel, performance, and release packaging.

## Current Validation Baseline
These gates were already run during the audit pass:
- `npm run test` passed.
- `npm run build` passed with the known large Phaser chunk warning.
- `npm run sprites:validate` passed.
- `SMOKE_PORT=4317 npm run test:smoke` passed, 30/30 scenarios.
- `VISUAL_SWEEP_PORT=4318 npm run test:visual-sweep` passed, 8/8 mission entries, but the script currently reads `SWEEP_PORT`, so the run still used the default 4173 port.

Passing gates do not mean the game is finished. The current gates miss production asset packaging, image-level visual regressions, exact browser feel measurements, save import round-trip truth, and much of the authored content depth.

## P0 Release Blocker Tickets

### PROD-001: Make production builds asset-complete
Owner: art/performance QA lead
Status: implemented on 2026-07-08; keep this ticket open only for future deploy-host checks.

Problem:
- `Preload` loads runtime files from `assets/...`, but the current `dist/` output only proves JS, sourcemaps, and `index.html`.
- Smoke and visual sweep run against the dev server, not a production preview with real copied assets.

Acceptance criteria:
- `dist/assets/sprites/manifest.v1.json`, player atlases, enemy/boss atlases, backgrounds, and audio needed by `Preload` exist after `npm run build`.
- Add a production-preview smoke path or extend the smoke command so one gate runs against built `dist/`.
- Asset-missing failures should fail CI or local verification before release.

Validation:
- `npm run build`
- production preview smoke command
- `npm run sprites:validate`

### SAVE-001: Rehydrate progression transport into canonical clear state
Owner: save/progression UX lead
Status: implemented on 2026-08-04.

Problem:
- `importProgressionTransport()` replays checked locations, but `claimLocationCheck()` applies item rewards and does not reconstruct `tutorialCleared`, `clearedBosses`, or `finalBossCleared`.
- Stage Select and final gating still depend on those clear flags.
- Importing a different seed mutates visible seed fields without regenerating all world truth such as stage chain, placements, weakness profiles, and received item mapping.

Acceptance criteria:
- A fresh profile importing a transport with tutorial, boss, and final clears shows the same stage medals, final gate readiness, inventory, and completion status as the source profile.
- Import either regenerates all seed-derived world data from the imported seed or rejects incompatible imported world fields explicitly.
- Round-trip tests cover boss clears, tutorial clear, final clear, final gate, received items, and invalid ids.

Validation:
- `npm run test`
- `npm run build`
- targeted progression-state tests

### SAVE-002: Validate active-run resume data before scene use
Owner: save/progression UX lead
Status: implemented on 2026-08-04.

Problem:
- Active-run snapshots can contain arbitrary stage ids, boss ids, weapon ids, checkpoint ids, HP, lives, and weapon-energy values.
- `Game.create()` can silently fall back or resume from inconsistent data.

Acceptance criteria:
- Active-run import/resume allowlists campaign stage ids, boss ids, checkpoint ids, and weapon ids before applying data.
- Invalid snapshots degrade to a safe new run or a clear user-facing resume rejection.
- Resource values are clamped to valid ranges.

Validation:
- `npm run test`
- `npm run build`
- one smoke scenario for corrupted resume fallback

### GAMEPLAY-001: Make projectile spawning and damage metadata single-source
Owner: gameplay feel/combat lead plus runtime architect

Problem:
- `PlayerCombat` emits projectiles directly, while animation entries also emit `projectile.spawn`.
- Charge release can reset `chargeLevel` before animation resolution.
- Projectile metadata stores charge level, but boss damage receives only weapon id, element, and kind, then falls back to legacy `isChargingShot`.

Acceptance criteria:
- One shoot or release input creates exactly one projectile.
- Charge level, projectile id, weapon id, element, pierce behavior, and energy spend travel together from input through projectile spawn, collision, boss damage, and trace output.
- Weakness rules use projectile metadata, not legacy scene charge state.
- Tests cover normal buster, max charge buster, special weapon, boss damage delta, and no duplicate projectile spawn.

Validation:
- `npm run test`
- `npm run build`
- `npm run test:smoke`

### GAMEPLAY-002: Fix movement clamp and browser feel traces
Owner: gameplay feel/combat lead

Problem:
- Player config expects dash and wall-jump speeds above the scene max X velocity clamp.
- Current smoke checks detect timer/cooldown state, not actual distance, speed, apex, or timing.

Acceptance criteria:
- Dash velocity and distance match config within an agreed tolerance in browser traces.
- Wall-jump X velocity reaches the configured value.
- Run speed modifiers do not clamp dash or wall jump incorrectly.
- Browser trace scenarios capture short hop, full hop, coyote time, jump buffer, dash, wall slide, wall jump, and drop-through.

Validation:
- `npm run test`
- `npm run build`
- `npm run test:smoke`
- `npm run verify` before merging a broad feel pass

### GAMEPLAY-003: Route all player damage through the new runtime pipeline
Owner: gameplay feel/combat lead plus runtime architect

Problem:
- Enemy melee and some direct scene damage paths bypass `NewPlayerRuntime.receiveDamage`.
- This risks inconsistent i-frames, hitstun, knockback, and combat trace counts.

Acceptance criteria:
- Enemy melee, contact, hazards, projectiles, boss contact, and boss projectiles all call one player damage acceptance path.
- I-frame rejection, accepted-hit count, knockback, source id, and HP delta are recorded once per hit.
- Trace totals no longer double-count enemy projectile and contact damage.

Validation:
- `npm run test`
- `npm run build`
- `npm run test:smoke`

### LEVEL-001: Fix stage route truncation
Owner: level/content director

Problem:
- Stage extension patches add late platforms, hazards, and enemies, but final normalization places the boss room and filters content before many authored extensions survive.
- Several robot stages keep only a small subset of intended enemies, platforms, and hazards.

Acceptance criteria:
- Stage world width, boss-room placement, checkpoints, enemy retire windows, and platform/hazard extents are normalized in one order that preserves authored extension content.
- Every robot stage has a measurable route budget: intro, mid-stage challenge, pre-boss challenge, checkpoint spacing, and boss room entry.
- Visual sweep summary reports stage length and retained marker counts so truncation cannot silently return.

Validation:
- `npm run test`
- `npm run build`
- `npm run test:visual-sweep`

### BOSS-001: Ship authored runtime boss configs for every robot master
Owner: level/content director plus runtime architect

Problem:
- The roster describes distinct boss intent, but most runtime behavior uses generic fallback mapping.
- The live runtime still mixes legacy boss sprites/bodies with `BossController`.

Acceptance criteria:
- Each robot master has an authored runtime boss config with distinct movement, attacks, tells, projectile behavior, vulnerability windows, and phase changes.
- `Game` delegates boss lifecycle and damage through `BossController` instead of owning duplicate boss state.
- Boss diagnostics and smoke traces identify active attack, phase, HP, weakness result, and projectile metadata.

Validation:
- `npm run test`
- `npm run build`
- `npm run test:smoke`
- `npm run test:visual-sweep`

### FINAL-001: Complete Omega Fortress as a finale, not a placeholder remix
Owner: level/content director

Problem:
- Omega Fortress currently reuses mixed enemies and a Volt Golem runtime config.
- There is no complete boss rush, multistage route, final boss identity, or finale-specific mechanic.

Acceptance criteria:
- Omega Fortress has its own route structure, encounter pacing, checkpoints, and final-boss content.
- Final gate requirements, save flow, completion state, and replay behavior are tested.
- Completion UI reflects finished-game state clearly.

Validation:
- `npm run test`
- `npm run build`
- `npm run test:smoke`
- `npm run test:visual-sweep`

### RUNTIME-001: Dispose runtime listeners and shrink the `Game.ts` ownership surface
Owner: runtime architect

Problem:
- `NewPlayerRuntime` registers scene and keyboard listeners, while destroy currently cleans up only part of the runtime.
- `Game.ts` remains under `@ts-nocheck` and owns too many systems, making regressions hard to isolate.

Acceptance criteria:
- Player runtime destroys all event, keyboard, timer, and scene subscriptions on shutdown/restart.
- Runtime adapter extraction starts with narrow seams: combat adapter, save/progression flow, boss adapter, automation snapshot adapter.
- No new `@ts-nocheck` files are added.

Validation:
- `npm run test`
- `npm run build`
- restart/load smoke coverage

## P1 Feature Completion Tickets

### SAVE-003: Add confirmation and clearer save semantics
Owner: save/progression UX lead

Acceptance criteria:
- Title and system menu destructive actions require confirmation.
- "Save Game" copy makes checkpoint-based resume clear.
- Stage Select summary shows seed, boss clears, final-gate progress, and import/export state without ambiguity.

### CONTENT-001: Add biome mechanics and encounter scripting
Owner: level/content director

Acceptance criteria:
- Each robot-master stage has one or two themed mechanics beyond generic platforms/spikes.
- Encounter rooms can lock, spawn waves, set clear conditions, and release exits.
- Enemy placement supports authored challenge beats, not only x-triggered markers.

### CONTENT-002: Author reward challenges and weapon-gated routes
Owner: level/content director

Acceptance criteria:
- Upgrade pickups are placed in intentional rooms with movement/combat requirements.
- Optional routes teach or reward special weapons.
- Stage Select or completion summary exposes what remains without spoiling every route.

### VISUAL-001: Enforce animation frame-count contracts
Owner: art/animation/performance QA lead

Acceptance criteria:
- Atlas validation checks required frame counts for slash, run, jump, hit, death, charge, enemy, and boss actions.
- Runtime preload does not silently clamp required multi-frame animation groups into single-frame animations.
- Tests fail when a required action is only partially present.

### VISUAL-002: Upgrade visual sweep from existence check to quality gate
Owner: art/animation/performance QA lead

Acceptance criteria:
- Visual sweep catches blank canvas, missing assets, HUD/player overlap, action text overlap, boss/player offscreen placement, and obvious frame stalls.
- Screenshots include stable named captures for start, mid-stage, pre-boss, boss room, and a combat moment.
- Failure output points to the mission, screenshot, and detected issue.

### AUTOMATION-001: Centralize automation hooks
Owner: runtime architect plus QA lead

Acceptance criteria:
- `window.render_game_to_text` and `window.advanceTime` are implemented through a stable adapter instead of ad hoc scene property reads.
- `advanceTime` either becomes a deterministic Phaser-step helper or is renamed/documented as a RAF wait helper.
- Smoke and visual sweep contracts are updated in docs when hook semantics change.

### MOBILE-001: Complete touch-control parity
Owner: gameplay feel/combat lead

Acceptance criteria:
- Touch supports drop-through with down+jump.
- Touch hit targets are tested with real pointer events, not only direct button-state mutation.
- Touch overlay does not block important playfield/HUD areas at supported viewports.

## P2 Polish And Release Tickets

### PERF-001: Bundle and load budget pass
Acceptance criteria:
- Keep Phaser in an expected vendor chunk, document the current budget, and fail only on meaningful growth.
- Add lazy or route-based loading only where it reduces real startup cost without breaking Phaser preload contracts.

### VISUAL-003: Replace numeric VFX/projectile frame coupling with semantic ids
Acceptance criteria:
- Projectile and VFX definitions refer to semantic atlas/action ids.
- Reordered atlas frames cannot silently change a projectile's visual meaning.

### CONTENT-003: Move campaign content toward validated data files
Acceptance criteria:
- Campaign, level, boss, enemy, and pickup definitions have schema validation.
- Generated catalogs are distinguished from hand-authored content.
- A content dashboard reports per-stage counts for enemies, hazards, pickups, mechanics, boss config, and sprite coverage.

### RUNTIME-002: Retire stale legacy movement/combat handlers
Acceptance criteria:
- Unused scene handlers are removed or isolated behind documented compatibility adapters.
- `Game.ts` line count and untyped surface shrink over time.
- Pure logic tests cover any moved behavior before scene glue changes.

## Three-Shot Execution Plan

### Shot 1: Correctness and gates
Goal: make the current game trustworthy to save, load, build, and test.

Work:
- `PROD-001`
- `SAVE-001`
- `SAVE-002`
- `GAMEPLAY-001`
- `GAMEPLAY-003`
- first slice of `AUTOMATION-001` if needed to validate traces

Exit criteria:
- Test, build, smoke, sprite validation, and production-preview smoke pass.
- Progression transport round-trips real clear state.
- Projectiles and player damage have single authoritative metadata paths.
- No new broad content work starts until these pass.

### Shot 2: Content and feel completion
Goal: turn the playable game into a complete campaign.

Work:
- `GAMEPLAY-002`
- `LEVEL-001`
- `BOSS-001`
- `FINAL-001`
- `CONTENT-001`
- `CONTENT-002`
- `MOBILE-001`

Exit criteria:
- Every robot-master stage has preserved route content and at least one authored mechanic.
- Every boss has an authored runtime config.
- Omega Fortress has a real finale structure.
- Browser traces prove jump, dash, wall, projectile, damage, and touch behavior.

### Shot 3: Polish, visuals, and release hardening
Goal: make the improved version present well and resist regressions.

Work:
- `VISUAL-001`
- `VISUAL-002`
- `PERF-001`
- `VISUAL-003`
- `CONTENT-003`
- `RUNTIME-001`
- `RUNTIME-002`
- remaining `AUTOMATION-001`

Exit criteria:
- Visual sweep detects meaningful presentation regressions.
- Animation contracts enforce actual frame coverage and no silent single-frame degradation.
- Runtime ownership is clearer and `Game.ts` has shrunk in the areas touched.
- `npm run verify` is the release gate, with visual sweep or production-preview coverage included or documented as an explicit separate release step.

## Suggested Ticket Order
1. `PROD-001`
2. `SAVE-001`
3. `SAVE-002`
4. `GAMEPLAY-001`
5. `GAMEPLAY-003`
6. `GAMEPLAY-002`
7. `LEVEL-001`
8. `BOSS-001`
9. `FINAL-001`
10. `VISUAL-001`
11. `VISUAL-002`
12. `AUTOMATION-001`
13. `SAVE-003`
14. `CONTENT-001`
15. `CONTENT-002`
16. `MOBILE-001`
17. `PERF-001`
18. `VISUAL-003`
19. `CONTENT-003`
20. `RUNTIME-001`
21. `RUNTIME-002`

## Definition Of Done For The Improved Version
- Built `dist/` includes all runtime assets and can pass a production-preview smoke run.
- Save, import, active-run resume, final gate, and completion state round-trip correctly.
- Projectiles, charge levels, damage, i-frames, boss weaknesses, and trace output agree.
- Every stage keeps intended route content and has authored challenge beats.
- Every boss and the final fortress have distinct runtime behavior.
- Sprites and animations meet manifest frame-count contracts.
- Visual sweep catches missing assets, blank screens, overlap, offscreen actors, and obvious animation stalls.
- Touch and keyboard controls have parity for core gameplay.
- `progress.md` and relevant docs are updated with each implementation slice.
