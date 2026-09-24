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
| `npm run perf:footprint` | Builds nothing: serves `dist/` with `vite preview` and measures download before Title, time to Title, decoded audio, textures, JS heap, per-step CPU, growth across stage revisits and the hi-DPI canvas against `tests/perf-budget.json`; fails on a breach or any page error | After `npm run build`, for loading, asset, audio, render-scale or render-loop changes; `PERF_REPORT_ONLY=1` records a baseline without failing. Plan: `docs/prompts/09-footprint-and-performance.md` |

## Continuous Integration

`.github/workflows/ci.yml` runs on every push and pull request with Node 22 and `npm ci`.
The automatic job runs `npm run test` and `npm run build`; `npm run ci` runs the same checks locally.
Use GitHub's manual `workflow_dispatch` trigger for the separate browser job; smoke does not run on pushes.
That job installs Playwright Chromium, runs smoke with `SMOKE_PORT=4400`, then runs the visual sweep even if smoke fails.
The browser job uploads `output/` even on failure; record the remote run URL after pushing, without treating local results as a remote pass.

## Current Test Surface
- `tests/`
  - `identity-strings.test.ts` executes the actual frozen identity under six private/public flag combinations, checks the exact constants/eight-name map, scans source strings/comments with word boundaries, and proves stale bundled dialogue speaker names normalize to identity
  - `progression-classic.test.ts`, `upgrades.test.ts`, and `campaign-session.test.ts` cover authored worlds, mode-safe transport, actual combat/motor/shot consumers, fractional HP, and campaign timing
  - Logic, contracts, scene flow, save systems, render policy, platform rules, sprite validation, debug-state helpers
  - `tests/input-actions.test.ts` covers aggregated source edges, fast taps, immutable snapshots, hitstop queues/ownership, aliases, and persisted partial remaps
  - Dialogue schema/resolver coverage plus pure playback advance/skip parity
  - `tests/state-snapshot.test.ts` owns the shape/clamping contract for `combatDebug.player` feel traces
- `src/boss/__tests__/`
  - Boss-framework logic and controller behavior
- `scripts/smoke-test.mjs`
  - Browser smoke validation and artifact capture
  - Existing regression pages explicitly initialize a legacy Randomizer save; this preserves their original route/upgrades. Scenario 33 starts with genuinely empty storage and creates Classic through the chooser
  - `33-classic-stage-select` proves cancel-safe difficulty/mode selection, Shift eligibility, native layout bounds, a 64-character seed, tutorial clear, own reward and weakness discovery
  - `33b-classic-upgrade-runtime` proves fractional body armor and reload, helmet pose, outgoing play-time flush, two-damage enemy pellet, exact discounted-energy fire, neutral boss adapter damage and pending-charge cancellation at dialogue
  - `8-boss-room-activation` also runs the actual controller/Arcade post-update boundary sequence at both safe edges, preserving vertical motion, body alignment, inward movement and listener cleanup. Its `shot-0.png`/`state-0.json` precede the controlled probe; `boundary-lifecycle.json` records the probe before assertions
  - `12-weapon-switch-energy` also verifies ArcSlash emits once on saber release with its own identity and zero energy cost while a special remains equipped
  - Starts a dedicated Vite smoke server with HMR/watch reloads disabled for deterministic long-run scenarios
  - `13e-input-source-lifecycle` covers repeated pause/resume, pending-charge cancellation, fast menu taps, held Enter/Escape across nested menu return, held/repeated Numpad confirmation, modal underlay isolation, and debug hooks across Game shutdown/reentry
  - Required movement/touch scenarios `13d-movement-feel` and `4c-touch-controls` remain unchanged
  - Includes player sword coverage for grounded slash, air slash, boss slash, moving-slash alignment, and west-facing pose/hitbox alignment after locomotion reverses
  - Includes an uncharged Buster regression against the shortest ground enemy so pellet-height hit detection cannot silently regress
  - Scenario `29-pellet-hits-short-enemy` requires the same live mine bot at exactly 5→4 HP, one uncharged Buster shot, and an accepted one-damage player bullet hit; its `pellet-evidence.json` retains identity, damage, and body geometry so despawns cannot masquerade as hits
  - Includes a frozen-projectile regression that deliberately zeros a live standard shot and verifies the lifecycle watchdog recycles it
  - Includes viewport/energy-economy coverage for the actor ceiling, distinct health/weapon capsule textures, saber reboot from empty, and passive holstered-weapon recharge
  - Includes valid active-run restore plus corrupt active-run rejection coverage
  - Writes `output/smoke-runs/<ISO timestamp>/summary.json` with per-scenario `pass`/`fail`/`skipped` status and timeout classification; `output/web-game-smoke` is a symlink kept pointed at the latest run
  - Continues past a scenario failure by default and sets `process.exitCode = 1` if any failed; `SMOKE_FAIL_FAST=1` stops at the first failure like before
- `scripts/mission-visual-sweep.mjs`
  - Ten-mission visual verification pass: tutorial, eight wardens, and Omega Fortress
  - Launches Omega through the ninth Stage Select tile and verifies authored attacks plus phase-two transitions for every boss
  - Enforces one authoritative boss actor with exactly one visible sprite for every mission; runtime facing is exposed from the same player-target source used by attacks
  - Asserts typed boss attack starts, active lifecycle frames, action-specific animation families, motion intent, locked-facing agreement, room bounds, and authored active-hazard caps
  - Persists `boss-movement-samples.json` before movement assertions, including raw container X, body X and horizontal velocity; the strict room bounds and sample count remain unchanged
  - Writes `output/sweep-runs/<ISO timestamp>/summary.json` with per-mission `pass`/`fail`/`hung_after_artifacts` status and cleanup-timeout classification; `output/mission-visual-sweep` is a symlink kept pointed at the latest run
  - Continues past a mission failure by default and sets `process.exitCode = 1` if any failed; `SWEEP_FAIL_FAST=1` stops at the first failure like before

## Required Gate Selection
- Docs-only changes: `npm run test` and `npm run build` by default
- Pure logic or schema changes: `npm run test`
- Runtime or integration changes: `npm run test` and `npm run build`
- Gameplay flow, scene flow, input, or UI changes: add `npm run test:smoke`
- Production packaging, deploy, or runtime asset-copy changes: add `npm run test:smoke:preview`
- Loading, audio, asset, render-scale or per-frame changes: `npm run build` then `npm run perf:footprint` (it is also the only gate that boots the production bundle on every run)
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
- `window.stepFrames(n, options?)` (automation-only, `?automation=1`; pure stepper in `src/config/frameStepping.ts`) calls `Phaser.Game#step` exactly `n` times with a monotonic 60Hz clock (each step's delta is exactly `1000/60`) and returns the number of steps taken; unlike `advanceTime`, this is a deterministic simulation-frame guarantee, not a wall-clock wait. By default (`options.manageLoop` unset or `true`) it also sleeps Phaser's `TimeStep` before stepping and wakes it after, so a lone call is safe by itself. Pass `{ manageLoop: false }` when the caller already put the loop to sleep for a run of several calls and will wake it once itself (`stageDebug.replayInputs`, below) -- `TimeStep#wake()` calls `tick()` synchronously (an immediate real step at the wall-clock delta since sleep), so managing sleep/wake per call would reintroduce that stray step between every one of them. `window.stepFramesActive` is `true` for the duration of each call.
- smoke harness expectations in `scripts/smoke-test.mjs`
- visual-sweep expectations in `scripts/mission-visual-sweep.mjs`
- production preview smoke mode via `SMOKE_SERVER=preview`

### Run settings

| Setting | Contract |
| --- | --- |
| `SMOKE_ONLY=29-pellet-hits-short-enemy` | Runs the exact named smoke scenario; accepts comma-separated exact names. Other scenarios are recorded as `skipped`, so a filtered green summary is not proof of a full pass. |
| `SMOKE_FROM=<name>` | Starts with that exact scenario and runs the remaining scenarios; earlier entries are recorded as `skipped`. |
| `SMOKE_FAIL_FAST=1` | Stops the smoke run at the first scenario failure instead of continuing to the rest; default continues past a failure and exits `1` if any scenario failed. |
| `SMOKE_SCENARIO_TIMEOUT_MS=180000` | Per-scenario timeout; a scenario that runs longer fails with a clear timeout message and has any browser it opened force-closed. Default `120000`. |
| `SMOKE_FORCE_FAIL=<name>` | Test-only: forces the named scenario to throw instead of running, to prove continue-on-failure and `SMOKE_FAIL_FAST` without editing a real scenario. |
| `SMOKE_OUTPUT_DIR=<path>` | Overrides the smoke run folder instead of the default `output/smoke-runs/<ISO timestamp>`. |
| `SMOKE_PORT=4400` | Smoke server port; default `4173`, bound to `127.0.0.1` with strict port selection. |
| `SWEEP_PORT=4401` | Visual-sweep server port; default `4173`. Use different ports for concurrent browser runs. |
| `SWEEP_CLEANUP_TIMEOUT_MS=30000` | How long the sweep waits for the browser to close before failing as `hung_after_artifacts`; default `5000`. CI `browser-gates` sets 30000. |
| `SWEEP_FAIL_FAST=1` | Stops the visual sweep at the first mission failure instead of continuing to the rest; default continues past a failure and exits `1` if any mission failed. |
| `SWEEP_OUTPUT_DIR=<path>` | Overrides the sweep run folder instead of the default `output/sweep-runs/<ISO timestamp>`. |
| `SMOKE_SERVER=preview` | Uses the already-built `dist/` through Vite preview. `npm run test:smoke:preview` builds first. Default smoke server mode is `dev`. |
| `WEB_GAME_CLIENT=<path>` | Legacy generic-helper client path (repository copy, then installed skill client by default). The harness checks that this path exists, but the currently registered scenarios use their own Playwright routines; run the skill client separately when required. |
| `?automation=1` | Enables automation scene selection, debug hooks, and `window.__phaserGame`. The dev smoke harness also sets `VITE_AUTOMATION=1` and `VITE_SMOKE=1`. |
| `?renderer=canvas` | Chooses Canvas rendering for readable headless captures. It is independent of automation mode. |
| `?startScene=StageSelect` | Selects the startup scene only in automation mode; ordinary launches keep the normal title flow. |
| `?bossId=<id>` | Automation-only boss selection override; ordinary launches ignore it. |

The standard smoke and sweep URLs are `/?renderer=canvas&automation=1&startScene=StageSelect`; title scenarios omit `startScene`. Each run writes to a fresh timestamped run folder (`output/smoke-runs/<ts>`, `output/sweep-runs/<ts>`) rather than overwriting a prior run, and points the stable `output/web-game-smoke` / `output/mission-visual-sweep` symlink at it; `summary.json` also carries `runDir` with that path. Older run folders are not deleted automatically, so a focused run's evidence does not erase a prior full run's.

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
| `stageDebug.replayInputs(script, options?)` | Frame-exact input replay (prompt 05 §5.1 item 9): `script` is `[{ frame, held }, ...]`, a held-action-name array per row that applies from its `frame` until the next row's; the automation-only source it feeds is latched (presses/releases) the same way a keyboard change is. Throws on an unknown action name, a missing `window.stepFrames` (non-automation build) or a paused game, instead of silently stepping nothing. Sleeps the loop once for the whole script and wakes it once at the end (steps every row with `stepFrames(n, { manageLoop: false })` in between), so per-row sleep/wake cannot reintroduce a stray step (see `window.stepFrames` above). Resolves with `{ frames, finalPlayer: { x, y, vx, vy } }` (the state after the last row; a row with no next row just sets its held set without stepping, so a trailing "sentinel" row marks where the script ends). `options.trace: true` steps one frame at a time and adds `trace: [{ frame, x, y, vx, vy, grounded, dashing }, ...]`, one sample per stepped frame. `options.keepHeld: true` skips the default end-of-replay release of every automation-held action (otherwise `setAutomationHeld({})` fires real release edges, same as `cancelPendingInput`, so a held dash does not linger into whatever runs next). |
| `stageDebug.recordInputs()` / `stageDebug.stopRecording()` | Starts/stops capturing the held-action set per real-input frame into the same sparse `[{ frame, held }, ...]` shape (frame 0 at the `recordInputs()` call), a valid `replayInputs` input. A new `recordInputs()` call removes any previous handler first, and a scene shutdown mid-recording removes it too, so the preupdate listener cannot outlive its recording. |

`scripts/smoke/inputs/*.json` hold `replayInputs` scripts as `{ meta: { stage, spawn, purpose }, rows: [{ frame, held }, ...] }` (JSON has no comments, so `meta` documents the stage, spawn state and purpose instead); the smoke helper `replayInputs(page, scriptPath)` reads one and calls the hook (scenarios needing `trace`/`keepHeld` call `stageDebug.replayInputs` directly with rows and options instead, e.g. `runMovementFeelScenario`'s dash-jump and dash-recycle traces). `window.stepFrames` drives `Phaser.Game#step` directly, bypassing the rAF-bound `TimeStep#step`/`stepLimitFPS` that normally advance `loop.lastTime`/`loop.frame`, so `stepGameFrames` (`src/config/frameStepping.ts`) advances both itself; without that, per-step caches keyed on `loop.frame` (`SceneInputActions`'s action-sampling de-dup) would freeze, and scene timers keyed on elapsed time (i-frames, jump suppression, dash duration) would lose their anchor across separate `stepFrames` calls. A fresh input edge (e.g. a new `dash` press) takes one step to reach the body, so a script holding an action for N frames only moves it for N-1; see `scripts/smoke/inputs/dash-basic.json` and `dash-jump.json` for worked examples. Their rows are folded into one `replayInputs` call rather than issued as separate top-level `replayInputs`/`window.stepFrames` calls for two different reasons: within one call, `replayInputs` itself only sleeps/wakes once regardless of row count (see above), so there is no per-row wake to race; across *separate* top-level calls, each is its own async `page.evaluate` round-trip and the loop is briefly awake between them (the first call's own wake, the next call's own sleep), during which a real, uncontrolled-delta animation frame could still fire. (An earlier version of this paragraph attributed the former, within-a-script risk to the latter, between-calls one; they are different mechanisms and both matter.)

When changing these contracts:
- update the relevant script,
- update this file and `docs/testing/quality-gates.md`,
- mention the change in `progress.md`.

## Story Surfaces In Automation
- `?storyIntro=off` disables the prologue, stage card, briefing, radio ticker, Stage Select milestones and the ending pages. The smoke base URLs and the visual sweep set it, so existing scenarios never wait on story text. Boss intro and defeat dialogue still play (existing contracts) and honor seen flags.
- Scenarios `34-prologue-flow`, `35-radio-ticker`, `36-ending-flow` and `37-story-replay-skip` use `storyIntro=on` (`storyUrl` in `scripts/smoke-test.mjs`).
- `render_game_to_text()` adds `stageIntro` (`phase`, `active`), `ticker` (the toast and radio lane), `story` (intro state, policy, seen flags), `settings`, `save` (story flags, sub tanks, difficulty, completion), `prologue` and `ending` on their scenes, and `dialogue` on Stage Select while a milestone plays.
- Scenario `49-tutorial-verbs` (prompt 05 §5.7, `scripts/smoke/tutorial-verbs.mjs`, `storyIntro=on`) starts `tutorial_sentinel` on a fresh save and walks the five teach locks in order (jump, dash, wall jump in the two-screen shaft, charge, saber with three hits). For each lock it replays a wrong verb first and then the right one from `scripts/smoke/inputs/tutorial-*.json`, asserting the lock stays `locked` until its own verb and then opens. Walking into a closed gate (the jump gate and the scrap saber gate) must leave the hero short of it. The lane must show every key hint (`JUMP: SPACE`, `DASH: Z`, `WALL: JUMP OFF THE WALL`, `HOLD X TO CHARGE`, `SABER: C`) and every `tutorial_coach` line from Sentinel Rook inside its bounds (`lane-log.json`). The debug warps (`setPlayerX`, `crossBossGate`) stay automation tools: smoke 5 and the sweep use them on the tutorial, so the gate body, not the warp, is what the scenario proves.
- `render_game_to_text()` adds `mechanics.roomLocks` in `Game`: one entry per room lock (`id`, `requiredInput`, `phase` `dormant`, `locked` or `open`, `progress`, `hitsRequired`, `satisfied`, `gateX`, `gateClosed`, `cameraHeld`, `room`). It is `[]` on stages without locks. `ticker.kind` can now be `hint` (a UI key hint, never dialogue).
- `stageDebug.advanceStageIntro()` / `skipStageIntro()` / `storyState()` / `setLives(n)` / `setSubTanks(count, fills)` are automation-only. `window.narrativeDebug.advance()` / `skip()` / `state()` exist while the Prologue or Ending scene is active.
- Story flags mark at the moment a sequence starts, so reading every line and skipping produce identical `save.storyFlags`.
- `render_game_to_text()` also reports `systemMenu` (source, cursor index, option ids, `rowBackplates`) while the pause menu or route console is open, `options` (rows, cursor, `rowObjects`, `shownValues`: the text of the value rows actually on screen) while the Options scene is open, and `gameOver` (cursor, auto-continue countdown). `audio.musicCue` is the cue the game asked for; since 2026-09-22 music decodes on demand, so `audio.musicPlayingCue`, `audio.musicLoading` and `audio.residentMusicKeys` show what is audible and what is held in memory. The in-game `SystemMenu` still handles `save_game` / `load_game` programmatically for automation even though the visible menu autosaves.

## Handling Flaky Browser Validation
- Fix the smallest reproducible issue first.
- Prefer state predicates and pure deterministic tests over timing sleeps. `advanceTime` is an animation-frame wait, not a deterministic stepping guarantee.
- Use screenshots and text-state output together; neither is sufficient alone for gameplay assertions.
- Use the generated `summary.json` artifact before re-running a long smoke or visual pass; it is the quickest way to see the last completed scenario/mission and the failure classification.
- If a smoke or visual test is intentionally updated, document the new expected behavior in the same change.

## Merge Expectations
A change is not ready if the relevant gate for its risk profile was skipped. When in doubt, escalate to the next stronger command rather than documenting exceptions.

### Classic campaign automation additions

`render_game_to_text().stageSelect.progressionMode` and `.progression.progressionMode` report `classic` or `relay_randomizer`. Stage Select also reports tile and panel bounds/difficulty ratings; `newCampaign` reports the pending mode/difficulty/seed and confirmation readiness. These are diagnostic state, not a second gameplay authority.

With automation enabled, `stageDebug.grantWeapon(id)` accepts the eight warden weapon IDs and `stageDebug.grantUpgrade(id)` accepts armor/chips plus `arc_slash`. Both validate IDs, persist the grant and refresh the active Game/Stage Select consumer immediately; they return false for an unknown ID. Hooks are removed on scene shutdown. Existing boss damage and location-claim paths remain the authority for clears.

New Campaign interprets `?seed=` only when explicitly creating Randomizer. Classic always stores `classic`; existing saves are never reseeded by URL navigation. A mode-less v1 transport is Randomizer, and mismatched imports report an error without clearing the current active run. The complete current rules and legacy compatibility boundary are documented in `ARCHITECTURE.md`.

Scenario `29-pellet-hits-short-enemy` isolates a live mine bot with its normal collider/HP and AI/projectile emission disabled, clears prior hostile projectiles, then requires one ordinary Buster shot to reduce that same target from 5 to 4 HP. Its retained clash trace distinguishes interception from a hitbox miss; separate projectile-clash scenarios cover interception.

### Identity and private-skin preview

`render_game_to_text().identity` reports the canonical title/callsign, actual HUD hero label and private-skin flag; `.spriteManifest` reports the actual loaded atlas mode and private override count. These distinguish public naming from asset selection.

`4-title-controls` now captures the true native448×252 Title as `shot-0.png`, Controls as `shot-1-controls.png`, Warden Select as `shot-2-stage-select.png`, and the stage HUD as `shot-3-hud.png`. It asserts title/subtitle/header bounds, Controls return, actual HUD/manifest pairing and WREN in resolved tutorial dialogue. HUD capture waits for the actual entry fade to finish. All evidence is in `state-0.json`.

Run `VITE_PUBLIC_BUILD=1 SMOKE_ONLY=4-title-controls SMOKE_PORT=4400 npm run test:smoke` to preview public naming with the base manifest and zero private overrides on a development server. An ordinary run uses private art/label only when a private manifest exists. This flag preview is not a distributable public build: Vite still copies private files into ordinary developer builds, and the base artwork awaits original-art production. Packaging/stripping validation remains Prompt04; this identity slice does not produce a flagged dist.
