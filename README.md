# ⚡ Aegis-X — Boss Rush Action Platformer (Prototype Skeleton)

This repository contains the initial technical scaffolding for **Aegis-X**, an anime-inspired boss rush action platformer built with TypeScript, React, and Canvas2D. The goal of this milestone is to provide a playable-feeling sandbox that wires together the core systems, scenes, and data structures described in the project brief while leaving ample room for future iteration on combat depth, audiovisual polish, and content authoring.

## Highlights

- **Scene framework** with boot, title, stage select, fight, win, and end scenes wired through a simple scene stack.
- **Player controller** featuring acceleration-based movement, jump buffering, coyote time, dash i-frames, and a modular weapon inventory.
- **Boss abstraction** with a configurable `SimpleBoss` implementation powering all eight elemental encounters and driving projectile patterns, two-phase pacing, and VFX hooks.
- **Weapon system** that models the weakness loop and energy economy while providing room for bespoke behaviors per weapon.
- **HUD, FX, audio, input, and save systems** stitched together to match the MVP acceptance criteria from the design document.
- **Stage select grid** that surfaces weakness rumors once multiple bosses are defeated and highlights completion states.

## Getting Started

```bash
npm install
npm run dev
```

> **Note:** Package installation requires access to the npm registry. In restricted environments you may need to mirror dependencies or leverage an internal registry.

## Testing

Basic logic tests (weakness multiplier math) are defined with [Vitest](https://vitest.dev/):

```bash
npm run test
```

## Roadmap

- Flesh out per-boss AI behaviors, telegraphs, and signature weapon abilities.
- Implement cinematic boss intros, name cards, and win screen weapon showcases.
- Author bespoke audio, VFX, and HUD treatments per element while respecting accessibility settings.
- Expand save data to track play statistics and progression toward optional boss rush modifiers.

## License

MIT
