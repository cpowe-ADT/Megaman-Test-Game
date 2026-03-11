# Quality Gates
- Status: canonical
- Owner scope: tools, gameplay
- Last reviewed: 2026-03-06

## Merge Gates
| Change type | Minimum required commands |
| --- | --- |
| Docs only | `npm run test`, `npm run build` |
| Logic, content contracts, save systems, scene rules | `npm run test` |
| Runtime or TypeScript integration | `npm run test`, `npm run build` |
| Gameplay flow, UI/input, scene transitions, automation hooks | `npm run test`, `npm run build`, `npm run test:smoke` |
| Sprite, atlas, mission-wide visuals, presentation | `npm run test`, `npm run build`, `npm run test:visual-sweep` |
| Substantive gameplay, tools, content, or asset-pipeline work | `npm run verify` |

## What Blocks Merge
- Failed required commands
- Stale canonical docs after workflow or architecture changes
- Broken automation hooks (`render_game_to_text`, deterministic stepping) without coordinated updates
- Undocumented new debt or regressions
- Missing `progress.md` handoff note for meaningful work

## Manual Review Checklist
- Canonical docs still match the commands and runtime behavior.
- The change did not expand `@ts-nocheck` usage.
- The change did not bypass smoke or visual checks for a high-risk gameplay area.
- Any archived or reclassified docs have an obvious replacement path.

## Release-Readiness Focus
Before considering a broader release or handoff complete:
- `npm run verify` passes.
- Any new content/schema changes validate cleanly.
- Smoke automation reflects actual runtime behavior.
- Known risks are called out in the final summary and `progress.md`.
