# ADR: Incremental Runtime Modularization

- Status: accepted
- Date: 2026-03-06
- Owners: repo maintainers, gameplay/tools contributors

## Context
The game is already playable, but active gameplay is still heavily concentrated in `src/scenes/Game.ts`. At the same time, the repo already contains newer subsystem folders for player, enemy, boss, combat, physics, content, and asset logic. Future contributors and agents need a durable rule for how to evolve the runtime without breaking scene flow or freezing development behind a large rewrite.

## Decision
The repo will continue using an incremental modularization strategy:

- keep the game playable at every step,
- move reusable gameplay logic out of scenes into typed modules over time,
- keep Phaser-specific objects and scene wiring at the edges where practical,
- use scene files primarily for orchestration, rendering, and integration,
- treat `src/scenes/Game.ts` as a shrinking integration hotspot rather than the place to add new long-lived systems,
- preserve compatibility layers and automation hooks while the migration is in progress.

This makes the existing split between `src/scenes/`, `src/player/`, `src/enemy/`, `src/boss/`, `src/content/`, `src/assets/`, and related modules an intentional direction, not accidental sprawl.

## Consequences
- New runtime behavior should prefer pure or mostly pure modules when possible.
- Changes that touch `Game.ts` should reduce local complexity where practical and must not spread `@ts-nocheck` patterns elsewhere.
- Refactor work should keep `npm run test`, `npm run build`, and the relevant smoke/visual gates runnable after each meaningful change.
- Docs must distinguish current runtime reality from target architecture so future agents do not mistake plans for shipped structure.

## Alternatives Considered
### Full rewrite before further feature work
Rejected because it would stall feature delivery, raise regression risk, and break the repo's existing playable-at-all-times workflow.

### Keep scene-owned architecture as the default indefinitely
Rejected because it would increase coupling, make automated testing harder, and leave onboarding dependent on a single oversized scene file.
