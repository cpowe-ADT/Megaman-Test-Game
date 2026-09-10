# Supervised Game Completion Plan
- Status: working
- Owner scope: gameplay, saves, content, narrative, assets, QA

Implementation status (2026-08-04): Steps 1–9 are complete. Save/progression truth, projectile and damage routing, movement feel, route retention, authored boss configs, the Omega finale, and narrative integration are implemented and passing their full gates. Remaining work is optional visual/content polish and release/deployment hardening rather than a P0 campaign blocker.
- Last reviewed: 2026-08-04

This is the execution plan for taking the current playable Mega Man-style game to a complete, reviewable release candidate. Canonical runtime and gate rules remain in `ARCHITECTURE.md`, `TESTING.md`, and `docs/testing/quality-gates.md`.

## Audit Verdict

The project is not a broken prototype. It is a playable, well-instrumented game with a strong automated baseline, but it is still a completion candidate rather than a finished campaign.

Current verified baseline on 2026-08-04:

- `npm run test`: pass, 120 scene/system tests plus 12 boss-framework tests.
- `npm run build`: pass; 151 runtime asset files and 5 emitted build references verified in `dist/`.
- `npm run sprites:validate`: pass; 24 ready manifest entries and all required source groups present.
- `SMOKE_PORT=4331 npm run test:smoke`: pass, 30/30 scenarios.
- `SWEEP_PORT=4332 npm run test:visual-sweep`: pass, 8/8 robot-master missions.
- Known production warning: the Phaser vendor chunk is about 1.48 MB minified.

Green gates do not yet prove finished quality. Current screenshots visibly show the player falling through/behind the fixed HUD at stage start, Stage Select text and preview overlap, and inconsistent boss scale/readability. The visual sweep also omits the tutorial and Omega Fortress.

## Confirmed Finish Blockers

1. Resolved 2026-08-04: save/progression import now rebuilds canonical clear/completion truth, regenerates the complete seeded world, replaces stale target progression, and applies sanitized received-item inventory.
2. Resolved 2026-08-04: active-run saves now pass a campaign/weapon/checkpoint/resource validator before menus or scenes can consume them; corrupt identity is rejected and drifted resources are normalized.
3. Player projectile ownership is duplicated. Combat events spawn projectiles, animation markers can spawn another pellet, and boss damage reconstructs charge state from legacy scene fields instead of projectile metadata.
4. Player damage ownership is incomplete. Some projectile/contact paths use `NewPlayerRuntime.receiveDamage`, but the scene remains capable of bypassing or double-recording the unified path.
5. Movement configuration and Arcade body clamps disagree. Dash and wall-jump targets can be limited by the scene's lower maximum X velocity; browser traces do not yet prove actual distance/speed.
6. Stage extension content is appended and then filtered against a newly normalized boss room. Authored late enemies, hazards, and platforms are removed, producing short/thin stages.
7. Every stage and checkpoint currently starts at `y: 40`. Visual captures show the player overlapping the fixed HUD before landing.
8. Only `volt_golem` has an authored runtime boss definition. Other bosses use the generic blueprint mapper.
9. Omega Fortress still uses `volt_hopper` with the `volt_golem` config and has no true final-boss/finale structure.
10. There is story flavor in campaign and roster data but no dialogue content contract, dialogue presenter, narrative state, boss exchanges, or real epilogue.
11. Visual/content gates prove files exist, not that action groups, scale, silhouettes, HUD layout, dialogue bounds, and full route presentation are good.
12. `src/scenes/Game.ts` remains a roughly 3,700-line `@ts-nocheck` integration hotspot. Completion work must extract narrow seams rather than expanding it further.

## Supervised Working Method

Each implementation slice follows the same loop:

1. Root agent owns all writes for the slice. Smaller agents may audit, design tests, inspect screenshots, or review contracts, but they do not edit the same files concurrently.
2. Start from a failing focused test or reproducible browser trace.
3. Implement one narrow behavior and keep `Game.ts` changes at adapter boundaries.
4. Run targeted tests first, then `npm run test` and `npm run build` when the slice is stable.
5. Run smoke only for gameplay/scene/input changes and visual sweep only for cross-stage/art changes.
6. Open and inspect the generated screenshots and JSON state; a green summary is not enough.
7. Stop at the supervision checkpoint. Present changed files, behavior evidence, screenshots, test results, and remaining risk before starting the next slice.
8. Append the outcome and next step to `progress.md`.

This is the token-efficient policy: one writer, small read-only specialist audits, focused tests during iteration, and expensive browser suites only at risk-appropriate checkpoints.

## Execution Sequence

### Step 0 — Protect the baseline and strengthen completion evidence

Goal: make later changes measurable without disturbing the current dirty worktree.

Work:

- Record current file ownership before every slice and preserve unrelated user changes.
- Add a small content/audit report for per-stage width, checkpoint count, retained enemy/hazard/platform counts, boss config ID, and sprite action coverage.
- Extend the visual sweep roster to tutorial plus all eight robot masters plus Omega Fortress.
- Add assertions/captures for grounded spawn, HUD overlap, stage start, mid-stage, pre-boss, boss intro, and active combat.
- Keep production-preview smoke as a release gate.

Exit criteria:

- Audit output names every campaign stage and cannot silently skip Omega.
- A spawn inside the HUD or a player still falling at the stage-start capture fails the quality check.

Validation: `npm run test`, `npm run build`, targeted visual sweep.

Supervision checkpoint: approve the new evidence surface before gameplay tuning.

### Step 1 — SAVE-001: canonical progression import

Status: completed 2026-08-04.

Goal: an imported snapshot represents the same completed world as its source.

Work:

- Choose one explicit import contract: regenerate the complete seeded world from the imported seed, then apply sanitized slot options; do not partially mutate the previous world's seed fields.
- Derive `tutorialCleared`, `clearedBosses`, `finalBossCleared`, and `gameCompleted` from imported checked boss-clear locations.
- Reconcile access, received items, checkpoints, selected checkpoints, pending consumables, upgrades, and final-gate state.
- Make repeated import idempotent.
- Keep legacy clear helpers as compatibility wrappers around the canonical location-claim path or deprecate their direct use.

Exit criteria:

- Fresh-profile import round-trips tutorial, robot-master medals, inventory, final gate, final clear, completion state, and seed-derived weakness/placement truth.
- Unknown IDs remain rejected and duplicate import does not duplicate rewards.

Validation: targeted progression/save tests, `npm run test`, `npm run build`.

Supervision checkpoint: inspect source/imported save diffs and Stage Select text state before proceeding.

### Step 2 — SAVE-002: active-run validation and safe resume

Status: completed 2026-08-04.

Goal: corrupt or stale active-run data never creates an inconsistent scene.

Work:

- Add a pure `validateActiveRun()`/normalizer at the save boundary.
- Allowlists: campaign stage IDs, the stage's boss ID, unlocked weapon IDs, and checkpoint IDs belonging to that stage.
- Clamp HP, max HP, lives, weapon index, weapon energy, checkpoint index, and timestamps.
- Return a discriminated result: valid normalized run or rejected run with a reason.
- On rejection, clear/quarantine the run and show a concise user-facing message before starting a safe new stage run.

Exit criteria:

- Invalid stage/boss/checkpoint/weapon IDs and extreme/NaN resources cannot reach `Game.create()`.
- Old compatible saves migrate; irrecoverable saves fail safely.

Validation: save tests, one corrupted-resume smoke scenario, `npm run test`, `npm run build`, `npm run test:smoke`.

Supervision checkpoint: review the rejection UX and corrupted fixtures.

### Step 3 — GAMEPLAY-001: one projectile command and metadata path

Goal: one input produces one projectile whose identity remains intact through impact.

Work:

- Define one typed player projectile command containing projectile ID, weapon ID, element, charge level, damage, speed, scale, pierce, energy cost, impact effect, facing, and source.
- Make `PlayerCombat` the gameplay authority for firing; animation markers become visual synchronization signals only, not a second spawn authority.
- Pass the same metadata through `NewPlayerRuntime`, `ProjectileSystem`, collision routing, boss weakness resolution, debug traces, and hit records.
- Remove boss damage inference from `isChargingShot`/`chargeStartedAt`.
- Spend weapon energy only after a projectile successfully spawns, or explicitly define/refund failed-spawn behavior.

Exit criteria:

- Pellet, all charge levels, and every special weapon spawn exactly once per accepted input.
- Boss damage/weakness and trace output use projectile metadata and agree with the HUD/energy delta.

Validation: player-combat, projectile registry/router, and boss-damage tests; `npm run test`, `npm run build`, `npm run test:smoke`.

Supervision checkpoint: inspect a trace table for pellet, max charge, special weapon, blocked weakness, and successful weakness.

### Step 4 — GAMEPLAY-003 and RUNTIME-001a: one player-damage path

Goal: every damaging source applies exactly one consistent hit.

Work:

- Introduce one typed player-damage request with amount, tier, source ID/type, direction/knockback intent, and optional element.
- Route enemy melee/contact, hazards, falls, enemy projectiles, boss contact, and boss projectiles through `NewPlayerRuntime.receiveDamage`.
- Centralize HP mutation, i-frame rejection, hitstun, knockback, tint/animation, death, and combat trace recording.
- Make runtime destroy unsubscribe scene events, keyboard listeners, timers, and debug hooks.

Exit criteria:

- One accepted contact reduces HP once and creates one accepted trace; i-frame repeats create rejected traces without HP loss.
- Restart/load cycles do not accumulate listeners or duplicate damage.

Validation: pure damage tests, restart/load smoke, representative source matrix, `npm run test`, `npm run build`, `npm run test:smoke`.

Supervision checkpoint: approve the damage-source matrix and restart trace.

### Step 5 — GAMEPLAY-002: movement clamp and browser feel proof

Goal: configured movement values are the values players actually experience.

Work:

- Replace the fixed scene max-X clamp with a value that accommodates run, upgrade, dash, slide, and wall-jump peaks.
- Remove or isolate stale scene movement handlers so they cannot fight `PlayerMotor`.
- Record trace scenarios for short/full hop, coyote time, jump buffer, dash distance/duration, wall slide, wall jump, one-way landing, and drop-through at 30/60 fps.
- Tune only after reviewing actual traces and screenshots.

Exit criteria:

- Dash and wall-jump reach configured velocity/distance within documented tolerance.
- Browser traces agree with deterministic motor tests.

Validation: motor/platform tests, focused browser feel scenarios, `npm run verify` at the end of the broad feel pass.

Supervision checkpoint: approve a before/after feel table before any subjective tuning round.

### Step 6 — LEVEL-001: route normalization, grounded spawns, and authored beats

Goal: every stage preserves its intended route and begins in a readable, playable state.

Work:

- Normalize world width and reserve the boss room before authoring/filtering route content, or express route content in a pre-boss coordinate range.
- Fail content validation when an authored enemy, platform, hazard, checkpoint, or pickup is unexpectedly filtered.
- Replace universal `y: 40` spawns/checkpoints with grounded coordinates or an intentional, unobscured entry sequence.
- Give each robot-master stage a route budget: intro, mechanic teaching beat, mid challenge, reward/optional route, pre-boss challenge, checkpoint spacing, gate, boss room.
- Add one or two biome mechanics per stage before adding decorative bulk.

Exit criteria:

- Per-stage retained counts match authored counts.
- Start, checkpoint, and boss-room respawns settle safely without HUD overlap or blind falls.
- Visual sweep captures start/mid/pre-boss/boss states for tutorial, eight masters, and Omega.

Validation: campaign/layout tests, `npm run test`, `npm run build`, `npm run test:smoke`, `npm run test:visual-sweep`.

Supervision checkpoint: review one pilot stage end to end, then apply the proven content contract to the other seven.

### Step 7 — BOSS-001: authored boss vertical slice, then roster rollout

Goal: each boss has a distinct readable fight instead of a generic mapped fallback.

Pilot first: Sentinel Rook or Pyro Maw.

Work:

- Add a validated runtime definition for movement, attack lifecycle, tells, projectiles/hazards, phase thresholds, vulnerability windows, arena hooks, and animation groups.
- Make `BossController` the boss HP, state, phase, attack, damage, defeat, and diagnostics authority.
- Validate each config against available atlas actions and projectile IDs.
- After pilot approval, author Tide Reaver, Volt Hopper, Basalt Titan, Ferro Blade, Mire Wraith, Gale Vixen, and Glacier Ronin in small batches.

Exit criteria:

- Every boss has distinct movement, at least two readable attacks, a meaningful phase change, safe spawn bounds, and weakness/charge tests.
- Debug state names the runtime config, phase, active attack, vulnerability, HP, projectile metadata, and weakness result.

Validation per boss: config/framework tests and focused smoke. Validation per batch: `npm run test`, `npm run build`, `npm run test:visual-sweep`.

Supervision checkpoint: approve the pilot boss and its art scale before roster rollout; approve each two-boss batch.

### Step 8 — FINAL-001: real Omega Fortress and ending loop

Goal: complete a finale that uses the full campaign rather than remixing a placeholder boss.

Work:

- Establish an original final-boss ID/config and remove the `volt_hopper`/`volt_golem` substitution.
- Build a multisection fortress route that cashes in on learned movement, weapons, biome mechanics, checkpoints, and selected rematches or boss-rush beats.
- Define final-boss phases, completion reward/state, retry checkpoint, credits/epilogue, return-to-title/stage-select behavior, and completed-save replay semantics.

Exit criteria:

- The final gate, fortress route, final clear, completion scene, reload, and replay all round-trip correctly.
- Omega appears in smoke and visual sweep and has distinct production-ready presentation.

Validation: `npm run test`, `npm run build`, `npm run test:smoke`, `npm run test:visual-sweep`, production-preview smoke.

Supervision checkpoint: approve the fortress route map before implementation and the complete ending flow before polish.

### Step 9 — Separate narrative and boss-dialogue lane

Goal: add a coherent original story without entangling progression or combat ownership.

This lane can write content in parallel, but runtime integration waits until Steps 1–4 are stable and finale text waits for Step 8.

Minimal premise: an independent recovery unit frees eight infrastructure wardens from the OMEGA CORE, which manufactured a citywide crisis to justify permanent centralized control. Each boss reveal works in any order; all eight restores the route to Omega Fortress.

Slices:

- `NARRATIVE-001`: story bible, registered speakers, validated dialogue JSON, all boss intro/defeat text, order-independent milestone text, and token interpolation such as `{hero}` and `{rewardLabel}`.
- `NARRATIVE-002`: reusable `DialogueScene`/overlay with speaker label, wrapped lines, optional atlas portrait, confirm/skip debounce, full combat freeze, and `render_game_to_text` state.
- `NARRATIVE-003`: tutorial briefing, boss-intro hook after gate lock, defeat dialogue before reward modal, and skip/full-read callback parity.
- `NARRATIVE-004`: versioned seen flags only after save import/migration truth is stable.
- `NARRATIVE-005`: final-boss exchange and real epilogue after Omega is authored.
- `NARRATIVE-006`: optional original portraits and audio polish.

Exit criteria:

- Every tutorial/robot/final boss resolves intro and defeat content.
- Dialogue never owns rewards, save mutation, boss death, or scene transitions.
- Gameplay is frozen during blocking dialogue, and skip/full-read paths produce identical state.

Validation: dialogue content/resolver tests, `npm run test`, `npm run build`, dialogue smoke, and visual-sweep text-bound captures.

Supervision checkpoint: approve the one-page story bible and complete text sheet before UI integration.

### Step 10 — Visual, UI, PNG, and animation completion

Goal: turn the mechanically complete build into a visually coherent release candidate.

Work:

- Fix Stage Select hierarchy, clipped names, text overflow, preview-art overlap, and dense footer information.
- Normalize player, enemy, boss, projectile, pickup, and portrait scale against a documented pixel grid.
- Enforce required animation groups and minimum frame counts; do not silently degrade critical actions to one frame.
- Upgrade visual sweep from asset-existence checks to presentation checks: bounds, overlap, offscreen actors, blank regions, frame stalls, silhouette contrast, and scale.
- Use existing original/free source sheets first. If new graphics are needed, generate original PNG concepts/portraits/effects, preserve source/prompts/licensing notes, then use the repository's deterministic intake/slice/atlas/manifest pipeline.
- Do not generate or ship direct copies of Capcom characters. Use the game's original warden identities.

Exit criteria:

- Native 448×252 and one larger responsive viewport are readable.
- All required action groups validate and every mission passes human screenshot review.

Validation: sprite validation, atlas/frame tests, `npm run build`, `npm run test:visual-sweep`, production-preview smoke.

Supervision checkpoint: approve a visual style sheet and one finished boss/player/UI pilot before batch PNG production.

### Step 11 — Release hardening, credits, and code cleanup

Goal: ship a stable, original-facing build and leave maintainable runtime seams.

Work:

- Add in-game credits/attribution for required free assets.
- Replace release-facing `Mega Man`, `Robot Master`, `X`, and `Zero` terminology with an approved original title/terms if this will be public.
- Make private sprite overrides development-only and fail public production builds if `dist/assets/private` or a private override manifest is present.
- Set a documented Phaser/vendor bundle budget and flag meaningful growth rather than chasing framework size blindly.
- Extract typed save/progression, combat, boss, and automation adapters from `Game.ts`; remove stale handlers only after their pure tests and smoke coverage exist.
- Run the complete release checklist and archive/supersede stale working plans.

Exit criteria:

- No private override assets are shipped publicly.
- Credits, save/reset semantics, controls, accessibility/readability, tutorial, full campaign, finale, and replay are reviewed.
- `Game.ts` is smaller in every area touched and no new `@ts-nocheck` files exist.
- `npm run verify`, production-preview smoke, and full visual sweep pass with manually approved artifacts.

Supervision checkpoint: final go/no-go review with known debt explicitly accepted or fixed.

## Recommended Work Packages

Use these as supervised sessions rather than attempting the whole roadmap in one pass:

1. Save truth: Steps 1–2.
2. Combat truth: Steps 3–4.
3. Movement evidence: Step 5.
4. One complete stage pilot: Step 6 for Pyro Maw.
5. One authored boss pilot: Step 7 for Pyro Maw or Sentinel Rook.
6. Roster/stage batches: two stages and two bosses per supervised pass.
7. Omega route and final boss: Step 8.
8. Narrative content, then narrative UI/integration: Step 9 split into at least two passes.
9. Visual/UI/PNG polish: Step 10 in approved asset batches.
10. Release hardening: Step 11.

The next implementation package should be **GAMEPLAY-001 + GAMEPLAY-003**: one authoritative projectile command/metadata path followed by one authoritative player-damage path.

## Definition of Finished

The game is finished when:

- Fresh, imported, active-run, completed, and replay saves are trustworthy.
- Projectile, damage, movement, boss, and trace state each have one runtime authority.
- Tutorial, eight authored stages/bosses, Omega Fortress, final boss, ending, and replay loop all work.
- Boss dialogue and story milestones work in any stage order and can be skipped safely.
- Keyboard and touch controls cover the complete core move set.
- Required original/free sprites, animations, portraits/effects, credits, and production assets are present and visually reviewed.
- Full tests, build, smoke, production-preview smoke, sprite validation, and visual sweep pass.
- `progress.md` records the final release state, accepted debt, and exact validation evidence.
