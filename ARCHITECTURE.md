# Architecture

## Current Runtime Shape
The game boots from `src/main.ts`, loads shared assets and runtime placeholders in `src/scenes/Preload.ts`, enters mission selection through `src/scenes/StageSelect.ts`, and runs most active gameplay inside `src/scenes/Game.ts`.

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

## Known Architectural Debt
- `src/scenes/Game.ts` is still the main complexity hotspot and remains under `@ts-nocheck`.
- The runtime currently mixes older scene-owned logic with newer subsystem modules.
- Production builds succeed but still warn about a large bundle.
- Several planning docs describe future direction; use the docs index to distinguish current truth from historical intent.

## Canonical Deeper Reads
- Current-state architecture: `docs/architecture/current-state.md`
- Target modular direction: `docs/architecture/target-architecture.md`
- Boss framework details: `docs/architecture/boss-framework.md`
- Repo map: `docs/architecture/repo-map.md`
- Testing/merge gates: `docs/testing/quality-gates.md`
- Architecture ADRs: `docs/adr/0001-runtime-modularization.md`, `docs/adr/0002-bundle-size-strategy.md`
