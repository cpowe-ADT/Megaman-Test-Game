# Current Architecture
- Status: canonical
- Owner scope: repo, gameplay, tools
- Last reviewed: 2026-03-06

## Runtime Entry Points
- `src/main.ts`
  - Creates the Phaser game, configures rendering, registers scenes, and exposes automation hooks.
- `src/scenes/Boot.ts`
  - Seeds shared registry state and transfers control to preload.
- `src/scenes/Preload.ts`
  - Builds placeholder assets, validates sprite manifests, and loads runtime atlases.
- `src/scenes/StageSelect.ts`
  - Handles mission selection, save-backed stage state, and entry into gameplay.
- `src/scenes/Game.ts`
  - Still owns most live gameplay integration: stage geometry, player runtime wiring, combat setup, boss/enemy spawn, HUD, pause/victory hooks, and debug plumbing.

## Major Runtime Areas
### Scene and navigation layer
- `src/scenes/`
- `src/core/navigation.ts`
- `src/input/`

### Player runtime
- `src/player/`
- Modular controller/state-machine/motor/combat/animation/VFX helpers exist here.
- The scene still owns some integration and bridging responsibilities.

### Enemy runtime
- `src/enemy/`
- Enemy entity, AI, combat, projectile, spawner, level data, and debug overlay logic live here.
- Runtime integration still depends on scene-owned orchestration and feature flags.

### Boss runtime
- `src/boss/`
- `src/bosses/`
- Boss framework, attack logic, config mapping, UI binding, and runtime controller integration are split across these areas.

### Shared gameplay systems
- `src/combat/`
- `src/physics/`
- `src/content/`
- `src/assets/`
- `src/audio/`
- `src/tools/debug/`

## Architectural Boundaries
- Scene files should orchestrate and render, not keep accumulating game rules.
- Shared gameplay contracts should live in plain TypeScript modules where possible.
- Content and asset contracts should be validated before runtime use.
- Automation hooks are part of the runtime contract because smoke and visual tests depend on them.

## Current Reality vs Target Direction
Current reality:
- `Game.ts` remains the integration hub.
- Legacy and newer modular systems coexist.
- Some runtime paths are still controlled by flags or compatibility layers.

Target direction:
- Move more behavior into typed, reusable modules.
- Keep Phaser-specific objects at adapter edges.
- Drive more runtime behavior from content registries and validated contracts.

## Known Debt
- `src/scenes/Game.ts` remains under `@ts-nocheck` and should shrink over time.
- Mixed legacy/new runtime ownership complicates onboarding.
- Production bundle size still needs follow-up work.

## Related Docs
- `ARCHITECTURE.md`
- `docs/architecture/target-architecture.md`
- `docs/architecture/boss-framework.md`
- `docs/testing/quality-gates.md`
