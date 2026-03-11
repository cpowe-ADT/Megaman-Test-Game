# Architecture

## Current Runtime Shape
The game boots from `src/main.ts`, loads shared assets and runtime placeholders in `src/scenes/Preload.ts`, enters mission selection through `src/scenes/StageSelect.ts`, and runs most active gameplay inside `src/scenes/Game.ts`.

The repo is mid-transition from a scene-owned prototype into a more modular runtime:
- `src/player/` contains the new player runtime modules.
- `src/enemy/` contains the enemy framework and spawn/combat/AI helpers.
- `src/boss/` and `src/bosses/` split boss framework logic from runtime controller integration.
- `src/combat/`, `src/physics/`, `src/content/`, and `src/assets/` hold shared logic, registries, and data contracts.

## Architectural Boundaries
- Phaser bootstrapping and scene orchestration live in `src/main.ts` and `src/scenes/`.
- Pure or mostly pure gameplay logic should live outside scenes where practical.
- Asset/content contracts belong in `src/assets/` and `src/content/` plus the canonical docs in `docs/content/`.
- Browser automation and validation tooling live in `scripts/` and depend on stable runtime hooks.

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
