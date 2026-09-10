# Mega Man Game

A Phaser 3 + TypeScript + Vite action-platformer prototype with a playable stage-select flow, boss encounters, a modularizing gameplay runtime, and local-first sprite/tooling pipelines.

## Current State
- The campaign is playable end to end: tutorial, eight authored warden stages, the selectable Omega Fortress finale, boss dialogue, completion, and replay.
- The game currently builds and tests cleanly; smoke covers the full interaction surface and the visual sweep covers all ten missions.
- The architecture is mid-refactor: reusable player, enemy, boss, combat, content, and asset modules exist, but `src/scenes/Game.ts` still owns too much of the runtime and remains under `@ts-nocheck`.
- The production build currently emits a large-bundle warning. This is known debt, not an active build failure.
- `progress.md` is the canonical running handoff log for ongoing work.

## Quickstart
### Prerequisites
- Node.js 18+
- npm

### Install and run
```bash
npm install
npm run dev
```

Optional macOS launchers:
- `Open-MegaMan-Dev.command`
- `Install-MegaMan-Launcher.command`

## Core Commands
```bash
npm run test
npm run build
npm run test:smoke
npm run test:visual-sweep
npm run verify
```

Command meanings and usage rules live in `TESTING.md`.

## Controls
| Action | Keys |
| --- | --- |
| Move | Left / Right arrows |
| Aim / crouch | Up / Down arrows |
| Confirm | Enter / Numpad Enter |
| Jump | Space |
| Dash | Z |
| Shoot / Charge | X |
| Saber combo | C |
| Cycle weapon | D / E |
| Cycle weapon backward | Q |
| Stage Select checkpoint cycle | L / R |
| Return / back | Esc |

You can also open the in-game `Controls` screen from the title menu and the system menu.

## Documentation
- Agent workflow: `AGENTS.md`
- Contribution rules: `CONTRIBUTING.md`
- Testing policy: `TESTING.md`
- Architecture summary: `ARCHITECTURE.md`
- Documentation index and authority map: `docs/README.md`

## Repo Map
- Runtime entry: `src/main.ts`
- Scenes: `src/scenes/`
- Player systems: `src/player/`
- Enemy systems: `src/enemy/`
- Boss systems: `src/boss/`, `src/bosses/`
- Content and registries: `src/content/`
- Narrative playback and dialogue UI: `src/narrative/`, `src/content/dialogue/`, `src/ui/DialogueOverlayController.ts`
- Asset manifest/runtime loading: `src/assets/`
- Tests: `tests/`, `src/boss/__tests__/`
- Tooling and smoke scripts: `scripts/`

## Quality Gates Before Merge
- Run `npm run test` for logic or scene-affecting work.
- Run `npm run build` for any TypeScript/runtime integration work.
- Run `npm run test:smoke` for gameplay, scene flow, UI/input, or automation-hook-sensitive work.
- Run `npm run test:visual-sweep` for cross-mission visual and sprite-pipeline work.
- Run `npm run verify` before merging substantive gameplay, tooling, content, or asset changes.

## Known Risks
- `src/scenes/Game.ts` is still the main complexity hotspot.
- Mixed legacy/new runtime paths increase documentation-drift risk.
- Historical planning docs exist; use `docs/README.md` to find the current source of truth.
