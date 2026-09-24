# Architecture

## Current Runtime Shape
The game boots from `src/main.ts`, loads shared assets and runtime placeholders in `src/scenes/Preload.ts`, enters mission selection through `src/scenes/StageSelect.ts`, and runs most active gameplay inside `src/scenes/Game.ts`.

Loading is per scene where it pays: `Preload` loads atlases, sound effects and the one background layer the prologue draws; `Game.preload()` loads the stage's own background layers and drops the previous stage's (`src/scenes/game/stageBackgroundLoading.ts`); music is fetched and decoded when its cue is first asked for and evicted when nothing plays it (`src/audio/MusicTrackLoader.ts`, `musicResidency.ts`). The footprint budget and its harness are described in `docs/prompts/09-footprint-and-performance.md`.

The repo is mid-transition from a scene-owned prototype into a more modular runtime:
- `src/player/` contains the new player runtime modules.
- `src/enemy/` contains the enemy framework and spawn/combat/AI helpers.
- `src/boss/` and `src/bosses/` split boss framework logic from runtime controller integration.
- `src/bosses/bossCombatProfiles.ts` is the authored combat-direction registry for every campaign boss. `BossMotionController.ts` turns its jump/dash/hover/dive/teleport/slam intents into collision-safe Phaser-edge commands, while `BossController` owns action lifecycle traces, landing, presentation, and locked facing.
- `src/projectiles/` owns projectile identity, damage, visuals, combat-sensor dimensions, and lifecycle quarantine. Gameplay platform recycling uses visible sprite bounds so forgiving combat sensors do not collide with floors early; invalid, disabled, expired, or unexpectedly stalled standard shots recycle through the same pool boundary.
- `src/content/dialogue/` owns validated story content; `src/narrative/` owns pure playback state; `src/ui/DialogueOverlayController.ts` is the Phaser presentation adapter.
- `src/config/gameplayLayout.ts` owns the fixed HUD/playfield boundary. Arcade world bounds keep actor bodies below the HUD while `Game` renders a stage-tinted backing layer behind authored parallax art.
- `src/content/weaponEnergyEconomy.ts` owns special-weapon cost normalization plus saber and passive recharge rules; `Game` only schedules those pure rules and synchronizes the HUD/save snapshot.
- `src/ui/pickups/PickupTextures.ts` owns the small procedural health, weapon-energy, bonus, upgrade, and tank silhouettes. `src/ui/HUD.ts` renders matching segmented energy bars and weapon-tinted chrome.
- `src/ui/menu/menuTheme.ts` owns shared title/controls/system-menu fonts, colors, backdrops, and panel chrome so scene menus retain one presentation language.
- `src/combat/`, `src/physics/`, `src/content/`, and `src/assets/` hold shared logic, registries, and data contracts.

## Architectural Boundaries
- Phaser bootstrapping and scene orchestration live in `src/main.ts` and `src/scenes/`.
- Pure or mostly pure gameplay logic should live outside scenes where practical.
- Asset/content contracts belong in `src/assets/` and `src/content/` plus the canonical docs in `docs/content/`.
- Dialogue never grants rewards or writes completion flags. `Game` gates combat/presentation, while canonical progression location claims remain the only clear/completion authority.
- `BossController` is the single visible boss actor and faces the same player target used for attack direction; scene-owned boss sprites are not layered over it.
- Attack facing is snapshotted at windup and shared by the boss sprite, motion, and projectile controller. Projectiles arm after the authored telegraph instead of starting dash or damage behavior at attack selection time.
- Browser automation and validation tooling live in `scripts/` and depend on stable runtime hooks.

## Input and Settings
`src/input/ActionState.ts` derives one immutable held/pressed/released snapshot per frame from the combined keyboard and touch sources. `InputActions.ts` owns a physical keyboard hub per game and an adapter per scene; only the top active input surface receives actions, including when its underlay remains active. Fast taps are latched between frames. Pause/resume and scene handoffs retain physical held state so a held confirmation cannot launch the next screen.

Scenes and the player controller consume named actions; keyboard aliases and supplemental menu/debug shortcuts stay at the adapter boundary. `DigitalButtonPad` retains its touch/automation interface. Gameplay edges wait through hitstop, but switching input ownership discards that queue. Opening the system menu cancels only a pending charge without firing; health, damage protection, cooldowns, and movement tuning are preserved. A fresh trigger starts the next charge after resume.

`src/systems/Settings.ts` validates and persists bindings in `settings.v1`, merges partial binding changes, falls back safely for malformed data, and preserves other settings fields for the options slice. Rebinding UI and gamepad input remain prompt 04 work.

## Campaign, upgrades and statistics

`NewCampaignScene` is the shared, cancel-safe entry from Title and both system menus. Its pure `newCampaignModel` defaults to Normal/Classic. Only a completed campaign or Shift held at entry exposes Relay Randomizer; no storage changes occur until Start. `Save.difficulty` stores the choice for the later difficulty system. `Settings` continues to own bindings; its full options schema arrives in Phase 1.4.

`progression/seed.ts` generates the fixed Classic world independently from the seeded Randomizer. Classic has the tutorial plus all eight wardens in its access set, the authored placement table, WeaknessTable-derived weaknesses and an eight-medal final gate. User-new saves explicitly use Classic; the one-argument seeded factory and missing-mode legacy saves/transports retain Randomizer semantics. Transport imports reject cross-mode/unknown-mode payloads before writing; Classic normalization restores its authored world rules. Stage Select uses a full-width nine-tile grid with 32×32 portrait reservations and a description/reward preview below.

`progression/upgrades.ts` resolves Classic modifiers for combat, motor and shot creation. Randomizer retains its prior checkpoint/HP/chip behavior. `projectiles/firePlayerShot.ts` checks the reduced cost before allocation and spends only after success. Classic Buster Plus changes only ordinary pellet damage at spawn, so boss damage cannot add the bonus twice. ArcSlash is an explicit saber-release projectile identity with no cycling slot or energy bank; pending input cancellation prevents a deferred release through a blocking overlay.

`progression/statistics.ts` holds each mission's elapsed time in memory. Existing checkpoint/claim/manual-save/return boundaries flush total active time; valid manual reload flushes outgoing total time while restoring the saved mission clock. Active time excludes pause/dialogue/victory and inactive-player intervals. Defeats count once per life; successful boss location claims record the first clear time, and unique heart/sub location claims count secrets. Progression imports reset run statistics because their payload carries no source timing. Finite positive fractional HP survives active-run normalization and scene restoration; fatal falls remain fatal despite body armor. Story flags are retained as bounded unique strings until the Phase 1.4 registry-aware filter.

## Identity and developer skin

`src/content/identity.ts` exports one frozen `IDENTITY` with exact public title/subtitle, hero/unit/operator/antagonist terms and a frozen map of the eight existing warden names. Title, HUD, campaign/roster, menus and dialogue speaker labels consume it. The generic dialogue registry and authored v1 JSON remain unchanged; the bundled-content adapter replaces proper display names from identity before registry construction, while the hero interpolation token always resolves to the canonical callsign.

The developer-only skin was retired in 05c (5.5, 2026-09-24): there is no private manifest, no `DEV_SKIN`, and every build shows WREN from `assets/sprites/manifest.v1.json`; the Vite copy step never ships `assets/private/`.

## Known Architectural Debt
- `src/scenes/Game.ts` is still the main complexity hotspot and remains under `@ts-nocheck`.
- The runtime currently mixes older scene-owned logic with newer subsystem modules.
- Production builds still print Vite's 500KB chunk warning: Phaser's Arcade-only build is 1.09MB minified (only a custom Phaser build goes lower) and the game chunk is 533KB. Do not split game code by folder with `manualChunks`: that created a chunk import cycle that crashed the production build at boot (fixed 2026-09-22). Split by scene with dynamic `import()` if a split is ever needed.
- Several planning docs describe future direction; use the docs index to distinguish current truth from historical intent.

## Canonical Deeper Reads
- Current-state architecture: `docs/architecture/current-state.md`
- Target modular direction: `docs/architecture/target-architecture.md`
- Boss framework details: `docs/architecture/boss-framework.md`
- Repo map: `docs/architecture/repo-map.md`
- Testing/merge gates: `docs/testing/quality-gates.md`
- Architecture ADRs: `docs/adr/0001-runtime-modularization.md`, `docs/adr/0002-bundle-size-strategy.md`

The boss controller finalizes its horizontal room clamp on scene `POST_UPDATE`, after Arcade applies pending body displacement, and synchronizes the body from the corrected container. The guard preserves vertical movement and removes its listener on destruction; scene/world-step clamps alone cannot enforce the rendered final position.
