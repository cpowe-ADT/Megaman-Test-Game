# ⚡ Mega-Style Phaser Starter

This repository now ships a compact [Phaser 3](https://phaser.io/) + TypeScript + Vite starter tailored for a retro boss-rush prototype. It focuses on fast iteration and zero external art dependencies so you can immediately run, tweak, and extend the sandbox.

## Features

- **Scene flow** covering boot → preload → stage select → gameplay.
- **Generated sprite kit** with hand-crafted Megaman-style poses, buster shots, hazards, and a dummy foe — all drawn at runtime so no downloads are required.
- **Stage select grid** with keyboard navigation across eight themed bosses.
- **Combat-ready gameplay scene** featuring responsive movement, jump/fall/shoot/slide/hurt animations, buster projectiles, hazards, and a training dummy to demolish.
- **Modern tooling** via Vite 5 and TypeScript 5 for hot-module reloading and type safety.

## Getting Started

### Prerequisites
- Node.js 18 or newer (LTS recommended)
- npm, pnpm, or yarn (examples below use npm)

### Install & Run

```bash
npm install
npm run dev
```

Vite automatically opens your browser to the development server. Use the arrow keys to highlight a boss, press **Enter** to load the gameplay scene, then use the control map below once the stage loads.

### Default Controls

| Action | Keys | Notes |
| --- | --- | --- |
| Move | Left / Right arrows | Horizontal acceleration with air control |
| Confirm (menus) | **Enter** / **Numpad Enter** | Stage Select, pause overlays |
| Jump | **Space** | Gameplay only, triggers while grounded |
| Dash | **Z** | Short burst with cooldown |
| Shoot / Charge | **X** | Hold to charge, release to fire higher-level shots |
| Saber combo | **C** | Chains up to four swings |
| Cycle weapon | **S** (hold **Shift** for reverse) | Quick swap through unlocked weapons |
| Shoulder cycle | **L** / **R** | Optional rapid cycling |
| Pause (coming soon) | **Esc** | Reserved for pause/menu overlay |

Controls are wired through Phaser's keyboard system, so rebinding can be added later via scene-level helpers.

> Stage Select ignores **Space** — only Enter (or Numpad Enter) confirms a mission. Space exclusively drives grounded jumping once you enter gameplay, while Escape is reserved for the upcoming pause overlay.

### Build for Production

```bash
npm run build
```

The optimized build is emitted to `dist/`. You can preview it locally with:

```bash
npm run preview
```

### Troubleshooting

- If the dev server or HMR feels out of sync, run `npm run preview` to sanity-check the production build.

## Project Structure

```
src/
  main.ts            # Game bootstrap & Phaser configuration
  scenes/
    Boot.ts          # Seeds palette data and transitions into preload
    Preload.ts       # Draws the runtime sprite kit and registers animations
    StageSelect.ts   # Boss grid navigation and scene transition
    Game.ts          # Combat sandbox with movement, hazards, and buster logic
```

## Asset Workflow & Packaging

Guidelines for structuring sprite sheets, atlases, and other art deliverables live in [`docs/assets.md`](./docs/assets.md). It covers recommended folder layouts, JSON atlas examples, and notes on licensing when pulling fan-made Mega-style packs.

To share a downloadable bundle, run `npm run build` and zip the generated `dist/` directory. The output only depends on static files, making it easy to host on itch.io, Netlify, GitHub Pages, or similar services.

## License

MIT
