# Aegis-X Code Architecture

This document captures the major modules that make up the Aegis-X boss rush prototype. It is intended
as a quick orientation guide for engineers who need to navigate the codebase or extend combat systems.

## Runtime Overview

- **`Game`** – Owns the Canvas context, bootstraps input/audio/save subsystems, and drives the frame
  loop. Scenes are swapped through a simple stack to support modal overlays or cinematics.
- **Scenes** – Each scene encapsulates a discrete flow state (`Boot`, `Title`, `Select`, `Fight`,
  `Win`, `End`). Scenes receive an `Env` bundle exposing shared managers and are responsible for their
  own update/draw cycles.
- **Entities** – Player and boss classes encapsulate gameplay rules. Projectiles are small data
  objects updated each frame and rendered after primary actors to keep layering predictable.
- **Systems** – Input, audio, HUD, FX, save, and camera managers are decoupled from scenes to make
  orchestration explicit and testable.

## Data Flow

### Boss Canonical Data

`src/game/data/Bosses.ts` defines a single source of truth for every encounter:

- `BossDefinition` objects capture codename, element, weapon reward, stage select slot, hint text,
  arena tuning, and theme colors.
- Helper accessors (e.g. `getBossDefinition`, `getBossTheme`, `getBossWeaponReward`) expose these
  facts to scenes and systems without duplicating lookups.
- Stage grid utilities derive their structure from the same definitions, ensuring select screen and
  combat code stay synchronized.

### Elements & Weaknesses

`src/game/data/WeaknessTable.ts` houses the elemental rock-paper-scissors loop. It now derives the
`BossThemes` and `BossWeaponRewards` maps from the canonical boss definitions, eliminating manual
synchronisation between files.

### Combat Loop

`SceneFight` orchestrates encounters by combining:

- The `Player` controller – handles movement (acceleration, jump buffer, coyote time, dash),
  inventory state, and projectile spawning.
- `SimpleBoss` – a data-driven boss shell with configurable move speed, fire cadence, health, and
  projectile properties.
- `FXSystem` – responsible for screen shake and particle primitives when attacks connect.

Damage resolution leverages `computeMultiplier` so elemental weaknesses and resistances are applied
consistently between weapons and bosses.

## Asset & Extensibility Notes

- New bosses only require an additional `BossDefinition`. Existing scenes and systems automatically
  pick up the entry for stage select, win screens, and rewards.
- Weapon implementations live under `src/game/weapons`. `ElementalShot` and `Buster` illustrate how
  to share behaviour while allowing bespoke stats.
- HUD treatments rely on the `BossDefinition.theme` palette, so UI updates can stay data-driven.

For further expansion ideas and high-level goals, see the project `README.md` roadmap section.
