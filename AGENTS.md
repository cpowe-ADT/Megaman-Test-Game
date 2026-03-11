# Agent Guide

## Purpose
This repository contains a retro Mega Man-style action platformer built with Phaser 3, TypeScript, and Vite. The game is playable and heavily instrumented, but the runtime is still in transition: core gameplay remains concentrated in `src/scenes/Game.ts`, while player, enemy, boss, content, and tooling modules are being pulled into more testable subsystems.

## Current State
- Main runtime entry: `src/main.ts`
- Scene flow: `Boot` -> `Preload` -> `StageSelect` -> `Game` plus pause/game-over/completion flows
- Tests and build are currently green via `npm run test` and `npm run build`
- Known debt:
  - `src/scenes/Game.ts` is still under `// @ts-nocheck`
  - production build warns about a large bundle
  - the repo contains both legacy scene-owned logic and newer modular runtime paths

## Start Here
1. Read `README.md` for quickstart and current-state notes.
2. Read `docs/README.md` for the documentation authority map.
3. Read `ARCHITECTURE.md` if your change touches runtime behavior or subsystem boundaries.
4. Read `TESTING.md` before changing gameplay, input, UI, assets, or automation hooks.
5. Read `progress.md` before editing anything. It is the canonical rolling handoff log.

## Authoritative Docs
- Project overview and setup: `README.md`
- Agent workflow and handoff rules: `AGENTS.md`
- Contribution rules and code-change expectations: `CONTRIBUTING.md`
- Testing policy and command usage: `TESTING.md`
- Current architecture summary: `ARCHITECTURE.md`
- Full doc index, status map, and historical references: `docs/README.md`

## High-Value Paths
- `src/main.ts`: Phaser bootstrap, renderer config, automation hooks
- `src/scenes/`: scene flow, gameplay, menus, pause/game-over/completion
- `src/player/`: modular player runtime, state machine, combat, animation, VFX/SFX routing
- `src/enemy/`: enemy framework, AI, combat, spawner, debug overlay
- `src/boss/` and `src/bosses/`: boss framework, config, runtime controller, diagnostics
- `src/content/`: content registries, campaign/enemy data, generated catalog assets
- `src/assets/`: sprite-manifest types, validation, runtime atlas helpers
- `tests/` and `src/boss/__tests__/`: logic and scene/system regression tests
- `scripts/`: smoke, visual sweep, sprite pipeline, asset validation tooling
- `progress.md`: required handoff log for the next agent

## Working in a Dirty Tree
- Assume the worktree may already contain unrelated user edits.
- Before editing, inspect the target file and preserve unrelated changes.
- Do not revert or clean up work you did not make unless explicitly asked.
- Avoid broad formatting passes or file moves outside the documentation scope unless they are required for the requested task.
- If you find unexpected new changes appearing while you work, stop and ask how to proceed.

## Change Rules
- Keep diffs narrow and reviewable.
- Prefer extracting pure logic into typed modules rather than expanding scene-local logic.
- Do not add new `@ts-nocheck` files. Reduce the existing `src/scenes/Game.ts` hotspot incrementally when touching that area.
- Keep Phaser-specific objects at adapter edges when practical; keep reusable logic testable without a scene.
- If you change architecture, workflows, commands, or content contracts, update the relevant docs in the same pass.
- If you change behavior meaningfully, append a concise note to `progress.md`.

## Validation Requirements
Run the smallest truthful gate for the change, then escalate when the change is broader.

- `npm run test`
  - Run for logic, scene, gameplay-rule, UI-flow, content-schema, and save-system changes.
- `npm run build`
  - Run for any TypeScript, runtime wiring, loader, asset-manifest, or bundling-impacting change.
- `npm run test:smoke`
  - Run for scene flow, gameplay loop, UI/input, automation-hook, or regression-risky runtime changes.
- `npm run test:visual-sweep`
  - Run for multi-mission visual changes, sprite-pipeline changes, atlas updates, and boss/enemy presentation updates.
- `npm run verify`
  - Run before merge for substantive gameplay, tooling, content, or asset-pipeline work.

For docs-only changes, `npm run test` and `npm run build` are the default minimum unless the edit changes documented behavior for smoke/visual workflows enough that a full `verify` is warranted.

## Automation Hooks
This repo already supports automated gameplay inspection. Preserve these contracts unless the change explicitly updates the scripts and docs together.

- `window.render_game_to_text`
  - Must keep exposing concise, decision-useful runtime state for automation.
- Deterministic stepping hooks such as `window.advanceTime`
  - Do not remove or silently change semantics without updating smoke tooling and docs.
- `scripts/smoke-test.mjs` and `scripts/mission-visual-sweep.mjs`
  - Treat these as part of the test surface, not disposable scripts.

## Definition of Done
A change is done when:
- the requested behavior or documentation update is implemented,
- the appropriate validation commands pass,
- relevant docs are updated and cross-linked,
- `progress.md` records what changed and any remaining risks,
- no unrelated work was reverted or broken.

## Handoff Checklist
Before ending your session:
1. Summarize what changed in `progress.md`.
2. Note commands run and whether they passed.
3. Call out any known regressions, debt, or follow-up work.
4. Link the next agent to canonical docs if you introduced new ones.
5. If a change touched automation hooks or test flows, state that explicitly.
