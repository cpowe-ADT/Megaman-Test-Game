# OMEGA RELAY

A Phaser 3 + TypeScript + Vite action-platformer prototype with a playable stage-select flow, boss encounters, a modularizing gameplay runtime, and local-first sprite/tooling pipelines.

## Current State
- Ten stages end to end: the Drill Hangar tutorial, eight authored warden districts, and the Central Core (Omega Fortress) in three acts, with boss dialogue, an ending record, and replay.
- Ten boss fights, each with a phase kit, a weakness break, a boss room and a pre-stage boss-intro card; nine weapons (the Buster plus eight warden specials), each with its own charged form and a post-reward weapon demo.
- The campaign beats: READY, the weapon-get card and demo, stage results, a low-HP warning, a district return debrief after every warden clear, LIVES, and a campaign record on the ending.
- A typewritten story, pickups v2 (grounded or floating by design), Assist/Normal/Veteran difficulty, and gamepad, touch and remap support.
- The game builds and tests cleanly; smoke covers the full interaction surface (a fast tier in CI, full and long tiers for release) and the visual sweep covers all ten missions.
- The architecture is mid-refactor: reusable player, enemy, boss, combat, content, mechanics, weapon, and asset modules exist, but `src/scenes/Game.ts` still owns some of the runtime and remains under `@ts-nocheck`.
- A public build, a GitHub Pages deploy workflow and an itch.io zip exist (`npm run build:public`, `npm run package:itch`); music and stage backgrounds load on demand, and `npm run perf:footprint` checks the footprint budget in `tests/perf-budget.json`.
- `progress.md` is the canonical running handoff log for ongoing work.

## Quickstart
### Prerequisites
- Node.js 18+
- npm

### Install and run
```bash
npm install
npm run dev     # local development server (Vite)
npm run build   # production bundle to dist/
npm run preview # serve the built dist/ locally
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
npm run perf:footprint   # after npm run build
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
| Pause menu (weapon, sub tank, options, quit) / back | Esc |
| Options (Title) | O |

You can also open the in-game `Controls` screen from the title menu and the system menu, where every binding can be remapped and reset.

### Gamepad and touch
- A connected gamepad works at Title and in-game with the standard mapping (A jump, X shoot, B back, Start pause, left stick or D-pad to move/aim); remap it on the `Controls` screen the same way as the keyboard.
- On a touch device a single on-screen overlay covers the whole game, not just a stage, laid out like
  a handheld emulator: a d-pad cross (arrow glyphs) at the left; at the right a diamond of round
  buttons — JUMP at the bottom (the largest), SHOT (hold to charge) on the right, DASH on the left,
  SABER on top, while you're in direct control, or just OK (bottom) and BACK (right) on every other
  screen (menus, the save slots, a dialogue, the pause menu, a card or results); L/R shoulder pills
  cycle weapons; SELECT and START pills sit bottom-centre (START pauses or confirms, SELECT backs
  out). The first time on a touch device, a "TAP TO START — TOUCH CONTROLS ON" card asks for one tap
  (a keyboard or pad press dismisses it without changing anything); a `TOUCH CONTROLS: ON/OFF` row on
  the Title screen and a small `TOUCH: AUTO/ON/OFF` corner button both flip the same setting as
  `Options > Touch Controls`, and if it's off, tapping anywhere shows a "tap to turn it back on" chip,
  so a phone player is never locked out. Every menu list (Title, the save slots, New Campaign, Warden
  Select, Options, Controls, the pause menu, Game Over, a dialogue line) takes a direct tap: the first
  tap on an item selects it, a tap on the item already selected confirms it. Each button presses the
  key your own bindings already use (remap it on `Controls`, as above), so it works anywhere that key
  does. In portrait it asks you to turn the phone sideways.

### Difficulty
New Campaign offers Assist, Normal and Veteran. Each sets its own boss HP and damage, enemy damage, and extra-life drop rate; Normal is the tuned default and Assist is the easiest. The choice is saved per profile and shown on the pause menu's route console.

## Documentation
- Agent workflow: `AGENTS.md`
- Contribution rules: `CONTRIBUTING.md`
- Testing policy: `TESTING.md`
- Architecture summary: `ARCHITECTURE.md`
- Documentation index and authority map: `docs/README.md`

## Art and Sound
- Every sprite, tileset, background, portrait and story panel is original art generated with Higgsfield (`gpt_image_2`), cut into frames and atlases by `scripts/sprites/`, and recorded with its prompt, job id and licence before runtime use (`assets/sprites/source/free-source-attribution.v1.json` and the `.prompts.md` beside each source sheet).
- Music and sound effects are either generated in this repository (`scripts/audio/compose.mjs` for music, `scripts/audio/sfx-synth.mjs` for SFX; both are seeded synthesis with no samples and no AI model) or CC0 downloads from OpenGameArt and Kenney. Higgsfield has no general-purpose music or SFX model, so none of the audio comes from it.
- The full per-file source, author and licence list is `assets/audio/credits/README.md`; `npm run audio:check` fails the build if a shipped audio file is missing from it.

## Credits
- Art: Higgsfield `gpt_image_2` (original generations for this project; see `assets/sprites/source/free-source-attribution.v1.json`).
- Music: `MintoDog`, `bart` and `Juhani Junkala` (CC0, OpenGameArt) plus original procedural tracks generated by this repository's own `scripts/audio/compose.mjs`.
- Sound effects: `Kenney` (CC0, kenney.nl) plus original procedural SFX generated by `scripts/audio/sfx-synth.mjs`.
- Full attribution: `assets/audio/credits/README.md`, `assets/sprites/source/free-source-attribution.v1.json`, and `src/content/credits.generated.ts` (in-game credits screen).
- Built by Claude Code, Codex and ChatGPT for Craig, who plans, reviews and plays.

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
