# Repo Map
- Status: canonical
- Owner scope: repo
- Last reviewed: 2026-03-06

## High-Value Paths
- `src/main.ts`: app bootstrap, renderer policy, automation hooks
- `src/scenes/`: stage select, gameplay, menus, pause, win/game-over/completion scenes
- `src/player/`: player control, state machine, motor, combat, animation, debug hooks
- `src/enemy/`: enemy entity runtime, AI, spawner, level data, projectiles, debug overlay
- `src/boss/`: boss framework, attack logic, config, diagnostics, tests
- `src/bosses/`: runtime controller, roster definitions, compatibility integration
- `src/content/`: registries, campaign data, enemy content, validators
- `src/assets/`: manifest types, validation, atlas/runtime asset helpers
- `src/combat/`: damage, hitbox, hurtbox, knockback, i-frame logic
- `src/physics/`: platform rules and collision helpers
- `tests/`: broad logic and scene/system regression tests
- `scripts/`: smoke test, visual sweep, sprite validation/import/build helpers
- `debug/`: browser-facing debug pages and probe scenes
- `progress.md`: canonical handoff log, latest session notes, unresolved follow-ups

## First Files To Read By Task
- Runtime bug: `src/main.ts`, then the relevant scene or subsystem folder
- Scene-flow bug: `src/scenes/` plus `tests/scene-flow.test.ts`
- Boss bug: `src/boss/`, `src/bosses/`, `src/boss/__tests__/`
- Enemy/content bug: `src/enemy/`, `src/content/`, `tests/pilot-enemy-config.test.ts`
- Sprite pipeline change: `src/assets/`, `docs/content/`, `scripts/sprites/`
- Test or automation issue: `TESTING.md`, `scripts/smoke-test.mjs`, `scripts/mission-visual-sweep.mjs`
