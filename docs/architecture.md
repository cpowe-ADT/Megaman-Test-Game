# Phaser Starter Architecture

This starter keeps the structure intentionally lean so new scenes, assets, or mechanics can be added without wrestling complex frameworks. The project is organized around Phaser's scene system and a handful of generated textures.

## Scenes

- **Boot** – Seeds a shared color palette inside the registry and immediately transitions to `Preload`.
- **Preload** – Builds a miniature sprite kit at runtime, drawing every player pose, projectile, hazard, and dummy target with `Graphics`. This keeps the project self-contained while still enabling animation-driven gameplay.
- **StageSelect** – Renders an eight-slot boss grid, handles keyboard navigation (arrows + Enter/Space), and starts the `Game` scene with the chosen boss identifier.
- **Game** – Evolves the sandbox into a combat playground. The player now has animated run/jump/fall/shoot/slide/hurt states, a buster projectile with cooldowns, hazards that inflict knockback, and a roaming dummy that can be destroyed.

## Rendering & Physics

- Phaser is configured at 320×180 with a zoom factor of 3, yielding a crisp 960×540 presentation ideal for retro pixels.
- Arcade Physics powers collisions between the player, ground, hazards, dummy enemy, moving platform, and projectiles. A tween updates the static platform's body every frame to keep collisions accurate.

## Tooling

- **Vite 5** provides instant dev-server feedback and production bundling.
- **TypeScript 5** is configured with strict mode and bundler-style module resolution to match modern ESM ecosystems.

This foundation is ready for layering in assets, additional scenes, UI, and gameplay systems while keeping the learning curve small for new contributors.
