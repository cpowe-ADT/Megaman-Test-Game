# Testing

## Testing Strategy
This repo uses a practical game-focused pyramid:
- Pure logic and contract tests first.
- Scene/system behavior tests second.
- Browser smoke and visual sweep checks last.
- Build/typecheck remains a required integration gate for runtime work.

The goal is fast feedback from deterministic tests, with browser automation reserved for scene flow, rendering, and interaction-risk areas.

## Commands
| Command | Purpose | Run when |
| --- | --- | --- |
| `npm run test` | Logic, content-contract, boss-framework, save-system, and scene/system regression tests | Any change to gameplay rules, scene flow, UI flow, schemas, save logic, or runtime modules |
| `npm run build` | TypeScript validation, production bundle build, and `dist/assets` runtime-asset completeness check | Any TypeScript, runtime wiring, loader, manifest, or bundling-impacting change |
| `npm run test:dist-assets` | Verifies built `dist/` still contains runtime assets and emitted JS/CSS references | After `vite build` changes or asset-copy workflow changes |
| `npm run test:smoke` | Automated browser smoke pass with screenshots, state capture, and console checks | Gameplay flow, stage flow, input, UI, pause/victory/game-over flow, automation-hook-sensitive changes |
| `npm run test:smoke:preview` | Builds, checks `dist/assets`, then runs the smoke suite against `vite preview` | Production packaging, deploy, runtime asset loading, or release-readiness changes |
| `npm run test:visual-sweep` | Cross-mission visual sweep and artifact capture | Sprite pipeline, atlas changes, boss/enemy presentation, mission-wide visual changes |
| `npm run verify` | Combined validation gate | Required before merge for substantive gameplay, tooling, content, or asset-pipeline work |

## Current Test Surface
- `tests/`
  - Logic, contracts, scene flow, save systems, render policy, platform rules, sprite validation, debug-state helpers
  - Dialogue schema/resolver coverage plus pure playback advance/skip parity
  - `tests/state-snapshot.test.ts` owns the shape/clamping contract for `combatDebug.player` feel traces
- `src/boss/__tests__/`
  - Boss-framework logic and controller behavior
- `scripts/smoke-test.mjs`
  - Browser smoke validation and artifact capture
  - Starts a dedicated Vite smoke server with HMR/watch reloads disabled for deterministic long-run scenarios
  - Includes player sword coverage for grounded slash, air slash, boss slash, moving-slash alignment, and west-facing pose/hitbox alignment after locomotion reverses
  - Includes an uncharged Buster regression against the shortest ground enemy so pellet-height hit detection cannot silently regress
  - Scenario `29-pellet-hits-short-enemy` requires the same live mine bot at exactly 5→4 HP, one uncharged Buster shot, and an accepted one-damage player bullet hit; its `pellet-evidence.json` retains identity, damage, and body geometry so despawns cannot masquerade as hits
  - Includes a frozen-projectile regression that deliberately zeros a live standard shot and verifies the lifecycle watchdog recycles it
  - Includes viewport/energy-economy coverage for the actor ceiling, distinct health/weapon capsule textures, saber reboot from empty, and passive holstered-weapon recharge
  - Includes valid active-run restore plus corrupt active-run rejection coverage
  - Writes `output/web-game-smoke/summary.json` with per-scenario `pass`/`fail`/`skipped` status and timeout classification
- `scripts/mission-visual-sweep.mjs`
  - Ten-mission visual verification pass: tutorial, eight wardens, and Omega Fortress
  - Launches Omega through the ninth Stage Select tile and verifies authored attacks plus phase-two transitions for every boss
  - Enforces one authoritative boss actor with exactly one visible sprite for every mission; runtime facing is exposed from the same player-target source used by attacks
  - Asserts typed boss attack starts, active lifecycle frames, action-specific animation families, motion intent, locked-facing agreement, room bounds, and authored active-hazard caps
  - Writes `output/mission-visual-sweep/summary.json` with per-mission `pass`/`fail`/`hung_after_artifacts` status and cleanup-timeout classification

## Required Gate Selection
- Docs-only changes: `npm run test` and `npm run build` by default
- Pure logic or schema changes: `npm run test`
- Runtime or integration changes: `npm run test` and `npm run build`
- Gameplay flow, scene flow, input, or UI changes: add `npm run test:smoke`
- Production packaging, deploy, or runtime asset-copy changes: add `npm run test:smoke:preview`
- Visual, sprite, atlas, or mission-presentation changes: add `npm run test:visual-sweep`
- Broad gameplay/tools/content work: finish with `npm run verify`

## Bug-Fix Workflow
1. Reproduce the bug.
2. Add or adjust the narrowest truthful test.
3. Implement the fix.
4. Re-run the affected gates.
5. Update docs and `progress.md` if behavior, tooling, or workflow changed.

## Browser Automation Contracts
Do not break these without updating scripts and docs together:
- `window.render_game_to_text`
- `window.advanceTime(ms)`, which waits for approximately `round(ms / (1000 / 60))` animation frames (at least one); it does not deterministically step Phaser or guarantee elapsed simulation time
- smoke harness expectations in `scripts/smoke-test.mjs`
- visual-sweep expectations in `scripts/mission-visual-sweep.mjs`
- production preview smoke mode via `SMOKE_SERVER=preview`

### Run settings

| Setting | Contract |
| --- | --- |
| `SMOKE_ONLY=29-pellet-hits-short-enemy` | Runs the exact named smoke scenario; accepts comma-separated exact names. Other scenarios are recorded as `skipped`, so a filtered green summary is not proof of a full pass. |
| `SMOKE_FROM=<name>` | Starts with that exact scenario and runs the remaining scenarios; earlier entries are recorded as `skipped`. |
| `SMOKE_PORT=4400` | Smoke server port; default `4173`, bound to `127.0.0.1` with strict port selection. |
| `SWEEP_PORT=4401` | Visual-sweep server port; default `4173`. Use different ports for concurrent browser runs. |
| `SMOKE_SERVER=preview` | Uses the already-built `dist/` through Vite preview. `npm run test:smoke:preview` builds first. Default smoke server mode is `dev`. |
| `WEB_GAME_CLIENT=<path>` | Legacy generic-helper client path (repository copy, then installed skill client by default). The harness checks that this path exists, but the currently registered scenarios use their own Playwright routines; run the skill client separately when required. |
| `?automation=1` | Enables automation scene selection, debug hooks, and `window.__phaserGame`. The dev smoke harness also sets `VITE_AUTOMATION=1` and `VITE_SMOKE=1`. |
| `?renderer=canvas` | Chooses Canvas rendering for readable headless captures. It is independent of automation mode. |
| `?startScene=StageSelect` | Selects the startup scene only in automation mode; ordinary launches keep the normal title flow. |
| `?bossId=<id>` | Automation-only boss selection override; ordinary launches ignore it. |

The standard smoke and sweep URLs are `/?renderer=canvas&automation=1&startScene=StageSelect`; title scenarios omit `startScene`. Both harnesses replace their output directory on startup. Preserve a prior `summary.json` and useful failure captures before a focused run overwrites them.

The gameplay trace payload should keep decision-useful feel fields available for automation: body profile, blocked/touching flags, drop-through state, coyote/buffer timers, dash edges, wall side, landing speed, jump source, damage source/tier, knockback, projectile spawn frame, touch-button state, weapon recharge state, and the single-boss visual/facing invariant.

Automation mode also exposes `stageDebug.playerViewport()`, `stageDebug.setWeaponEnergy()`, and `stageDebug.spawnPickup()` for deterministic viewport, energy-economy, and pickup-style checks. `render_game_to_text().weaponRecharge` reports the current inventory and recharge cadence; `bossState.runtime` reports body velocity/grounding, lifecycle phase, typed motion intent, locked facing, animation/frame, room dynamics, active hazards, and a bounded trace tail in addition to visible child counts.

Blocking dialogue is also part of the automation contract. `render_game_to_text().dialogue` exposes the active line and progress, while automation mode provides `stageDebug.advanceDialogue()` and `stageDebug.skipDialogue()` so browser tests converge through the same callbacks as player input. The automation-only `stageDebug.freezeLatestPlayerProjectile()` hook supports deterministic lifecycle quarantine regression coverage.

### Automation-only gameplay hooks

| Hook | Effect or returned state |
| --- | --- |
| `bossDebug.damage(amount = 1)` | Applies damage through the normal boss damage path; use this for new boss-clear scenarios. |
| `bossDebug.hp()` / `bossDebug.unlockIntro()` | Read boss HP; skip dialogue and unlock the boss intro. |
| `bossDebug.forceVictory()` | Legacy direct victory bypass; do not use in new scenarios. |
| `stageDebug.checkpointIndex()` / `stageDebug.enemyStream()` | Current checkpoint index and enemy stream snapshot. |
| `stageDebug.projectilePools()` | Active, visible, and allocated player/enemy projectile pool diagnostics. |
| `stageDebug.playerViewport()` | Player body top/bottom, viewport top, actor ceiling, and blocked-up flag. |
| `stageDebug.setWeaponEnergy(weaponId, amount)` | Clamp an owned special weapon's energy and reset its passive recharge accumulator; invalid IDs and Buster return `null`. |
| `stageDebug.freezeLatestPlayerProjectile()` | Zero the latest active player's projectile velocity for lifecycle regression coverage. |
| `stageDebug.advanceDialogue()` / `stageDebug.skipDialogue()` | Advance or skip through the normal overlay completion callbacks. |
| `stageDebug.damagePlayer(amount = 1)` | Normal player damage request; returns acceptance and current/max HP. |
| `stageDebug.forcePlayerDeath()` | Lethal system damage through the player damage pipeline, bypassing invulnerability. |
| `stageDebug.setPlayerX(x)` / `stageDebug.crossNextCheckpoint()` | Reposition the player horizontally; cross the next checkpoint trigger when one exists. |
| `stageDebug.crossBossGate()` / `stageDebug.activateBossRoom()` | Cross the authored boss trigger; activate the boss encounter directly for isolated tests. |
| `stageDebug.bossGateState()` | Lock position, room bounds, and camera-lock state. |
| `stageDebug.spawnPickup(type = 'health', offsetX = 0)` | Spawn a `health`, `ammo`, or `bonus` pickup and return its visual identity/position. |
| `stageDebug.spawnHostileProjectile()` | Spawn a normal hostile shot for damage and respawn tests. |
| `stageDebug.spawnProjectileClash({ strong })` | Set up ordinary or strong player/enemy shots for projectile-clash tests. |

When changing these contracts:
- update the relevant script,
- update this file and `docs/testing/quality-gates.md`,
- mention the change in `progress.md`.

## Handling Flaky Browser Validation
- Fix the smallest reproducible issue first.
- Prefer state predicates and pure deterministic tests over timing sleeps. `advanceTime` is an animation-frame wait, not a deterministic stepping guarantee.
- Use screenshots and text-state output together; neither is sufficient alone for gameplay assertions.
- Use the generated `summary.json` artifact before re-running a long smoke or visual pass; it is the quickest way to see the last completed scenario/mission and the failure classification.
- If a smoke or visual test is intentionally updated, document the new expected behavior in the same change.

## Merge Expectations
A change is not ready if the relevant gate for its risk profile was skipped. When in doubt, escalate to the next stronger command rather than documenting exceptions.
